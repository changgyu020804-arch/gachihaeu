import {
  generateAuthCode,
  hashAuthCode,
  isValidUosEmail,
} from "@/server/auth/session";
import { getResendConfig } from "@/server/config/runtime-env";
import {
  enforceRateLimit,
  getClientIp,
  readJsonObject,
  recordSecurityEvent,
  rejectCrossOriginMutation,
  requestErrorResponse,
} from "@/server/security/request";
import { getD1 } from "@/db/index";

const CODE_EXPIRY_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 60;

export async function POST(request: Request) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;

  try {
    const payload = await readJsonObject(request, 2_048);
    const email =
      typeof payload.email === "string"
        ? payload.email.trim().toLowerCase()
        : "";

    if (payload.termsAccepted !== true) {
      return Response.json(
        { error: "이용약관과 커뮤니티 운영정책에 동의해 주세요." },
        { status: 400 },
      );
    }

    if (!isValidUosEmail(email)) {
      return Response.json(
        { error: "서울시립대 이메일(@uos.ac.kr)을 확인해 주세요." },
        { status: 400 },
      );
    }
    const db = getD1();
    const clientIp = getClientIp(request);

    const emailRateError = await enforceRateLimit(db, {
      action: "auth-code-send-email",
      identifiers: [`email:${email}`],
      maximum: 3,
      windowSeconds: 15 * 60,
    });
    if (emailRateError) {
      await recordSecurityEvent(
        db,
        "auth_send_rate_limited",
        email,
        request,
        "email",
      );
      return emailRateError;
    }

    const ipRateError = await enforceRateLimit(db, {
      action: "auth-code-send-ip",
      identifiers: [`ip:${clientIp}`],
      maximum: 10,
      windowSeconds: 15 * 60,
    });
    if (ipRateError) {
      await recordSecurityEvent(
        db,
        "auth_send_rate_limited",
        email,
        request,
        "ip",
      );
      return ipRateError;
    }

    const recent = await db
      .prepare(
        `SELECT created_at
         FROM auth_codes
         WHERE email = ? AND created_at > datetime('now', ?)
         LIMIT 1`,
      )
      .bind(email, `-${RESEND_COOLDOWN_SECONDS} seconds`)
      .first();

    if (recent) {
      return Response.json(
        { error: "인증번호는 1분 후에 다시 요청할 수 있어요." },
        {
          status: 429,
          headers: { "Retry-After": String(RESEND_COOLDOWN_SECONDS) },
        },
      );
    }

    await db
      .prepare(
        `DELETE FROM auth_codes
         WHERE datetime(expires_at) <= datetime('now')`,
      )
      .run();

    const code = generateAuthCode();
    const codeHash = await hashAuthCode(email, code);
    const expiresAt = new Date(
      Date.now() + CODE_EXPIRY_MINUTES * 60_000,
    ).toISOString();

    await db
      .prepare(
        `INSERT INTO auth_codes (
           email, code_hash, attempts, expires_at, created_at
         ) VALUES (?, ?, 0, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(email) DO UPDATE SET
           code_hash = excluded.code_hash,
           attempts = 0,
           expires_at = excluded.expires_at,
           created_at = CURRENT_TIMESTAMP`,
      )
      .bind(email, codeHash, expiresAt)
      .run();

    const { apiKey, fromEmail } = getResendConfig();
    let sent = false;
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject: "[같이해U] 이메일 인증번호",
          html: `
            <div style="font-family: -apple-system, sans-serif; max-width: 400px; margin: 0 auto; padding: 32px 24px;">
              <h2 style="color: #176bff; margin: 0 0 8px;">같이해U</h2>
              <p style="color: #697386; font-size: 14px; margin: 0 0 24px;">서울시립대 운동 메이트</p>
              <div style="background: #f5f7fa; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                <p style="color: #697386; font-size: 14px; margin: 0 0 8px;">인증번호</p>
                <p style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #111827; margin: 0;">${code}</p>
              </div>
              <p style="font-size: 13px; color: #697386; margin: 0;">
                이 번호는 ${CODE_EXPIRY_MINUTES}분간 유효하며 한 번만 사용할 수 있습니다.<br/>
                본인이 요청하지 않았다면 이 메일을 무시하세요.
              </p>
            </div>
          `,
        }),
      });
      sent = response.ok;
    } catch {
      sent = false;
    }

    if (!sent) {
      await db.prepare(`DELETE FROM auth_codes WHERE email = ?`).bind(email).run();
      await recordSecurityEvent(
        db,
        "auth_email_delivery_failed",
        email,
        request,
      );
      return Response.json(
        { error: "이메일 발송에 실패했어요. 잠시 후 다시 시도해 주세요." },
        { status: 503 },
      );
    }

    await recordSecurityEvent(db, "auth_code_sent", email, request);
    return Response.json({
      sent: true,
      expiresInMinutes: CODE_EXPIRY_MINUTES,
    });
  } catch (error) {
    console.error("Authentication email request failed");
    return requestErrorResponse(error);
  }
}
