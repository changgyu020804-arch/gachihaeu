import { getSessionUser } from "@/server/auth/session";
import { enforceRateLimit, getClientIp } from "@/server/security/request";
import { getD1 } from "@/db/index";
import { syncScheduledNotifications } from "@/server/services/notification.service";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  await syncScheduledNotifications(user.email);
  const db = getD1();

  const [rows, unread] = await Promise.all([
    db
      .prepare(
        `SELECT id, activity_id, type, title, message, read_at, created_at
         FROM notifications
         WHERE user_email = ?
         ORDER BY created_at DESC
         LIMIT 50`,
      )
      .bind(user.email)
      .all<{
        id: string;
        activity_id: string | null;
        type: string;
        title: string;
        message: string;
        read_at: string | null;
        created_at: string;
      }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM notifications
         WHERE user_email = ? AND read_at IS NULL`,
      )
      .bind(user.email)
      .first<{ count: number }>(),
  ]);

  return Response.json({
    notifications: rows.results.map((row: {
      id: string;
      activity_id: string | null;
      type: string;
      title: string;
      message: string;
      read_at: string | null;
      created_at: string;
    }) => ({
      id: row.id,
      activityId: row.activity_id,
      type: row.type,
      title: row.title,
      message: row.message,
      readAt: row.read_at,
      createdAt: row.created_at,
    })),
    unreadCount: unread?.count ?? 0,
  });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  const payload = (await request.json()) as { id?: unknown; all?: unknown };
  const db = getD1();
  const rateError = await enforceRateLimit(db, {
    action: "notifications-read",
    identifiers: [`user:${user.email}`, `ip:${getClientIp(request)}`],
    maximum: 120,
    windowSeconds: 60 * 60,
  });
  if (rateError) return rateError;

  if (payload.all === true) {
    await db
      .prepare(
        `UPDATE notifications
         SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
         WHERE user_email = ?`,
      )
      .bind(user.email)
      .run();
    return Response.json({ updated: true });
  }

  const id = typeof payload.id === "string" ? payload.id : "";
  if (!id) {
    return Response.json({ error: "읽을 알림을 선택해 주세요." }, { status: 400 });
  }

  await db
    .prepare(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
       WHERE id = ? AND user_email = ?`,
    )
    .bind(id, user.email)
    .run();

  return Response.json({ updated: true });
}
