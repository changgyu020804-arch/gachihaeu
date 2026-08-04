import {
  constantTimeEqual,
  createJWT,
  createSessionCookie,
  deleteSessionCookies,
  hashAuthCode,
  isValidUosEmail,
} from "../../../auth";
import {
  enforceRateLimit,
  getClientIp,
  readJsonObject,
  recordSecurityEvent,
  rejectCrossOriginMutation,
  requestErrorResponse,
} from "../../../security";
import { ensureSchema, getD1 } from "../../../../db";

const MAX_CODE_ATTEMPTS = 5;

export async function POST(request: Request) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;

  try {
    const payload = await readJsonObject(request, 2_048);
    const email =
      typeof payload.email === "string"
        ? payload.email.trim().toLowerCase()
        : "";
    const code =
      typeof payload.code === "string" ? payload.code.trim() : "";

    if (!isValidUosEmail(email) || !/^\d{6}$/.test(code)) {
      return Response.json(
        { error: "이메일 또는 인증번호 형식을 확인해 주세요." },
        { status: 400 },
      );
    }

    await ensureSchema();
    const db = getD1();
    const clientIp = getClientIp(request);

    const emailRateError = await enforceRateLimit(db, {
      action: "auth-code-verify-email",
      identifiers: [`email:${email}`],
      maximum: 10,
      windowSeconds: 15 * 60,
    });
    if (emailRateError) return emailRateError;

    const ipRateError = await enforceRateLimit(db, {
      action: "auth-code-verify-ip",
      identifiers: [`ip:${clientIp}`],
      maximum: 30,
      windowSeconds: 15 * 60,
    });
    if (ipRateError) return ipRateError;

    const record = await db
      .prepare(
        `SELECT code_hash, attempts
         FROM auth_codes
         WHERE email = ? AND datetime(expires_at) > datetime('now')
         LIMIT 1`,
      )
      .bind(email)
      .first<{ code_hash: string; attempts: number }>();

    if (!record) {
      await recordSecurityEvent(
        db,
        "auth_verify_missing_code",
        email,
        request,
      );
      return Response.json(
        { error: "인증번호가 만료되었어요. 새로 요청해 주세요." },
        { status: 400 },
      );
    }

    const candidateHash = await hashAuthCode(email, code);
    if (!constantTimeEqual(record.code_hash, candidateHash)) {
      const updated = await db
        .prepare(
          `UPDATE auth_codes
           SET attempts = attempts + 1
           WHERE email = ?
           RETURNING attempts`,
        )
        .bind(email)
        .first<{ attempts: number }>();
      const attempts = updated?.attempts ?? record.attempts + 1;

      await recordSecurityEvent(
        db,
        "auth_verify_failed",
        email,
        request,
        `attempt:${Math.min(attempts, MAX_CODE_ATTEMPTS)}`,
      );

      if (attempts >= MAX_CODE_ATTEMPTS) {
        await db
          .prepare(`DELETE FROM auth_codes WHERE email = ?`)
          .bind(email)
          .run();
        return Response.json(
          { error: "인증번호를 너무 많이 틀렸어요. 새로 요청해 주세요." },
          { status: 429 },
        );
      }

      return Response.json(
        {
          error: `인증번호가 올바르지 않아요. ${
            MAX_CODE_ATTEMPTS - attempts
          }번 더 시도할 수 있어요.`,
        },
        { status: 400 },
      );
    }

    const consumed = await db
      .prepare(
        `DELETE FROM auth_codes
         WHERE email = ? AND code_hash = ?`,
      )
      .bind(email, candidateHash)
      .run();
    if ((consumed.meta.changes ?? 0) !== 1) {
      return Response.json(
        { error: "이미 사용한 인증번호예요. 새로 요청해 주세요." },
        { status: 409 },
      );
    }

    await db
      .prepare(
        `INSERT INTO user_profiles (
           email, nickname, department, bio, preferred_sports, updated_at
         ) VALUES (?, ?, '', '', '', CURRENT_TIMESTAMP)
         ON CONFLICT(email) DO NOTHING`,
      )
      .bind(email, email.split("@")[0])
      .run();

    const profile = await db
      .prepare(
        `SELECT nickname, gender, department, onboarding_completed
         FROM user_profiles
         WHERE email = ?`,
      )
      .bind(email)
      .first<{
        nickname: string;
        gender: string;
        department: string;
        onboarding_completed: number;
      }>();
    const displayName = profile?.nickname || email.split("@")[0];

    const token = await createJWT({
      email,
      displayName,
      fullName: displayName,
    });
    await recordSecurityEvent(db, "auth_login_succeeded", email, request);

    const headers = new Headers({
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    headers.append("Set-Cookie", createSessionCookie(token));
    headers.append("Set-Cookie", deleteSessionCookies()[1]);

    return new Response(
      JSON.stringify({
        success: true,
        email,
        displayName,
        gender: profile?.gender || "",
        department: profile?.department || "",
        onboardingComplete: Boolean(profile?.onboarding_completed),
      }),
      { status: 200, headers },
    );
  } catch (error) {
    console.error("Authentication verification failed");
    return requestErrorResponse(error);
  }
}
