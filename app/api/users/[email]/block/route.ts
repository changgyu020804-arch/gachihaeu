import { getSessionUser } from "@/server/auth/session";
import {
  enforceRateLimit,
  getClientIp,
  readJsonObject,
  recordSecurityEvent,
  rejectCrossOriginMutation,
  requestErrorResponse,
} from "@/server/security/request";
import { getD1 } from "@/db/index";

function parseEmail(value: string) {
  return decodeURIComponent(value).trim().toLowerCase().slice(0, 100);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ email: string }> },
) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;

  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  try {
    const { email } = await params;
    const blockedEmail = parseEmail(email);
    const payload = await readJsonObject(request, 2_048);
    const reason =
      typeof payload.reason === "string"
        ? payload.reason.trim().slice(0, 300)
        : "악의적이거나 부적절한 사용자 행동";

    if (!blockedEmail || blockedEmail === user.email) {
      return Response.json({ error: "자기 자신은 차단할 수 없어요." }, { status: 400 });
    }
    if (reason.length < 5) {
      return Response.json(
        { error: "신고 사유를 다섯 글자 이상 입력해 주세요." },
        { status: 400 },
      );
    }

    const db = getD1();
    const rateError = await enforceRateLimit(db, {
      action: "user-block",
      identifiers: [`user:${user.email}`, `ip:${getClientIp(request)}`],
      maximum: 30,
      windowSeconds: 60 * 60,
    });
    if (rateError) return rateError;

    const target = await db
      .prepare(`SELECT 1 FROM user_profiles WHERE email = ? LIMIT 1`)
      .bind(blockedEmail)
      .first();
    if (!target) {
      return Response.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
    }

    await db.batch([
      db
        .prepare(
          `INSERT OR IGNORE INTO user_blocks (blocker_email, blocked_email)
           VALUES (?, ?)`,
        )
        .bind(user.email, blockedEmail),
      db
        .prepare(
          `INSERT INTO user_reports (
             id, reporter_email, reported_email, reason
           ) VALUES (?, ?, ?, ?)
           ON CONFLICT(reporter_email, reported_email) DO UPDATE SET
             reason = excluded.reason,
             created_at = CURRENT_TIMESTAMP`,
        )
        .bind(crypto.randomUUID(), user.email, blockedEmail, `[차단과 함께 신고] ${reason}`),
    ]);
    await recordSecurityEvent(
      db,
      "user_reported_and_blocked",
      user.email,
      request,
      `target:${blockedEmail}`,
    );

    return Response.json({ blocked: true, reported: true }, { status: 201 });
  } catch (error) {
    return requestErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ email: string }> },
) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;

  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  const { email } = await params;
  const blockedEmail = parseEmail(email);
  const db = getD1();
  const rateError = await enforceRateLimit(db, {
    action: "user-unblock",
    identifiers: [`user:${user.email}`, `ip:${getClientIp(request)}`],
    maximum: 30,
    windowSeconds: 60 * 60,
  });
  if (rateError) return rateError;

  await db
    .prepare(
      `DELETE FROM user_blocks
       WHERE blocker_email = ? AND blocked_email = ?`,
    )
    .bind(user.email, blockedEmail)
    .run();

  return Response.json({ blocked: false });
}
