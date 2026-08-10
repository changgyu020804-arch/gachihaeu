import { getSessionUser } from "@/server/auth/session";
import { enforceRateLimit, getClientIp } from "@/server/security/request";
import { getD1 } from "@/db/index";

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ email: string }> },
) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  const { email } = await params;
  const reportedEmail = decodeURIComponent(email).trim().toLowerCase().slice(0, 100);
  const payload = (await request.json()) as Record<string, unknown>;
  const reason = cleanString(payload.reason, 300);

  if (!reportedEmail || reportedEmail === user.email) {
    return Response.json({ error: "자기 자신은 신고할 수 없어요." }, { status: 400 });
  }
  if (reason.length < 5) {
    return Response.json({ error: "신고 사유를 다섯 글자 이상 입력해 주세요." }, { status: 400 });
  }
  const db = getD1();
  const rateError = await enforceRateLimit(db, {
    action: "user-report",
    identifiers: [`user:${user.email}`, `ip:${getClientIp(request)}`],
    maximum: 10,
    windowSeconds: 60 * 60,
  });
  if (rateError) return rateError;

  const sharedActivity = await db
    .prepare(
      `SELECT 1
       FROM participants mine
       INNER JOIN participants target ON target.activity_id = mine.activity_id
       WHERE mine.user_email = ? AND target.user_email = ?
       LIMIT 1`,
    )
    .bind(user.email, reportedEmail)
    .first();

  if (!sharedActivity) {
    return Response.json(
      { error: "같은 모임에 참여한 사용자만 신고할 수 있어요." },
      { status: 403 },
    );
  }

  await db
    .prepare(
      `INSERT INTO user_reports (
         id, reporter_email, reported_email, reason
       ) VALUES (?, ?, ?, ?)
       ON CONFLICT(reporter_email, reported_email) DO UPDATE SET
         reason = excluded.reason,
         created_at = CURRENT_TIMESTAMP`,
    )
    .bind(crypto.randomUUID(), user.email, reportedEmail, reason)
    .run();

  return Response.json({ reported: true }, { status: 201 });
}
