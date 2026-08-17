import { getSessionUser } from "@/server/auth/session";
import { enforceRateLimit, getClientIp } from "@/server/security/request";
import { getD1 } from "@/db/index";
import { sendModerationAlert } from "@/server/services/moderation-alert.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const { id } = await params;
  const db = getD1();
  const rateError = await enforceRateLimit(db, {
    action: "activity-report",
    identifiers: [`user:${user.email}`, `ip:${getClientIp(request)}`],
    maximum: 10,
    windowSeconds: 60 * 60,
  });
  if (rateError) return rateError;

  const payload = (await request.json()) as { reason?: string };
  const reason = payload.reason?.trim().slice(0, 200) || "부적절한 모임 정보";
  const activity = await db
    .prepare(`SELECT creator_email, title FROM activities WHERE id = ? AND status = 'open'`)
    .bind(id)
    .first<{ creator_email: string; title: string }>();

  if (!activity) return Response.json({ error: "모임을 찾을 수 없어요." }, { status: 404 });
  if (activity.creator_email === user.email) {
    return Response.json({ error: "자신의 모임은 신고할 수 없어요." }, { status: 400 });
  }

  const report = await db
    .prepare(
      `INSERT OR IGNORE INTO reports (id, activity_id, reporter_email, reason)
       VALUES (?, ?, ?, ?)
       RETURNING id`,
    )
    .bind(crypto.randomUUID(), id, user.email, reason)
    .first<{ id: string }>();

  if (report) {
    await sendModerationAlert(db, {
      reportType: "activity",
      reportId: report.id,
      reporterEmail: user.email,
      targetEmail: activity.creator_email,
      reason,
      content: activity.title,
    });
  }

  return Response.json({ reported: true }, { status: 201 });
}
