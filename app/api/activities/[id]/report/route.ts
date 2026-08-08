import { getSessionUser } from "@/server/auth/session";
import { enforceRateLimit, getClientIp } from "@/server/security/request";
import { ensureSchema, getD1 } from "@/db/index";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  await ensureSchema();
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
    .prepare(`SELECT creator_email FROM activities WHERE id = ? AND status = 'open'`)
    .bind(id)
    .first<{ creator_email: string }>();

  if (!activity) return Response.json({ error: "모임을 찾을 수 없어요." }, { status: 404 });
  if (activity.creator_email === user.email) {
    return Response.json({ error: "자신의 모임은 신고할 수 없어요." }, { status: 400 });
  }

  await db
    .prepare(
      `INSERT OR IGNORE INTO reports (id, activity_id, reporter_email, reason)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(crypto.randomUUID(), id, user.email, reason)
    .run();

  return Response.json({ reported: true }, { status: 201 });
}
