import { getSessionUser } from "../../../auth";
import { ensureSchema, getD1 } from "../../../../db";
import { createNotifications } from "../../../notification-store";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  await ensureSchema();
  const { id } = await params;
  const db = getD1();
  const activity = await db
    .prepare(
      `SELECT title, creator_email
       FROM activities
       WHERE id = ? AND status = 'open'`,
    )
    .bind(id)
    .first<{ title: string; creator_email: string }>();

  if (!activity || activity.creator_email !== user.email) {
    return Response.json(
      { error: "모임장만 모임을 취소할 수 있어요." },
      { status: 403 },
    );
  }

  const recipients = await db
    .prepare(
      `SELECT user_email
       FROM participants
       WHERE activity_id = ? AND user_email != ?
       UNION
       SELECT user_email
       FROM waitlist
       WHERE activity_id = ? AND status = 'waiting' AND user_email != ?`,
    )
    .bind(id, user.email, id, user.email)
    .all<{ user_email: string }>();

  const result = await db
    .prepare(
      `UPDATE activities
       SET status = 'cancelled'
       WHERE id = ? AND creator_email = ? AND status = 'open'`,
    )
    .bind(id, user.email)
    .run();

  if ((result.meta.changes ?? 0) === 0) {
    return Response.json(
      { error: "모임장만 모임을 취소할 수 있어요." },
      { status: 403 },
    );
  }

  await createNotifications(
    recipients.results.map((recipient) => ({
      userEmail: recipient.user_email,
      activityId: id,
      type: "cancelled",
      title: "모임이 취소됐어요",
      message: `${activity.title} 모임이 모임장에 의해 취소됐어요.`,
      dedupeKey: `cancelled:${id}`,
    })),
  );

  return Response.json({ cancelled: true });
}
