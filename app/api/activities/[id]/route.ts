import { getSessionUser } from "@/server/auth/session";
import { enforceRateLimit, getClientIp } from "@/server/security/request";
import { ensureSchema, getD1 } from "@/db/index";
import { createNotifications } from "@/server/services/notification.service";

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

async function getRecipients(db: D1Database, id: string, ownerEmail: string) {
  return db
    .prepare(
      `SELECT user_email
       FROM participants
       WHERE activity_id = ? AND user_email != ?
       UNION
       SELECT user_email
       FROM waitlist
       WHERE activity_id = ? AND status = 'waiting' AND user_email != ?`,
    )
    .bind(id, ownerEmail, id, ownerEmail)
    .all<{ user_email: string }>();
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  const payload = (await request.json()) as Record<string, unknown>;
  const notice = cleanString(payload.notice, 300);
  if (!notice) {
    return Response.json({ error: "공지 내용을 입력해 주세요." }, { status: 400 });
  }

  await ensureSchema();
  const { id } = await params;
  const db = getD1();
  const rateError = await enforceRateLimit(db, {
    action: "activity-notice",
    identifiers: [`user:${user.email}`, `ip:${getClientIp(request)}`],
    maximum: 30,
    windowSeconds: 60 * 60,
  });
  if (rateError) return rateError;

  const activity = await db
    .prepare(`SELECT title, creator_email, status FROM activities WHERE id = ?`)
    .bind(id)
    .first<{ title: string; creator_email: string; status: string }>();

  if (!activity || activity.creator_email !== user.email) {
    return Response.json({ error: "모임장만 공지를 작성할 수 있어요." }, { status: 403 });
  }
  if (activity.status !== "open") {
    return Response.json({ error: "취소된 모임에는 공지를 작성할 수 없어요." }, { status: 400 });
  }

  await db
    .prepare(
      `UPDATE activities
       SET notice = ?, notice_updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(notice, id)
    .run();

  const recipients = await getRecipients(db, id, user.email);
  await createNotifications(
    recipients.results.map((recipient) => ({
      userEmail: recipient.user_email,
      activityId: id,
      type: "notice",
      title: "모임장 공지가 등록됐어요",
      message: `${activity.title}: ${notice}`,
      dedupeKey: `notice:${id}:${crypto.randomUUID()}`,
    })),
  );

  return Response.json({ updated: true, notice });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  await ensureSchema();
  const { id } = await params;
  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const cancellationReason = cleanString(payload.cancellationReason, 120);
  if (cancellationReason.length < 2) {
    return Response.json({ error: "참가자에게 전달할 취소 사유를 입력해 주세요." }, { status: 400 });
  }
  const db = getD1();
  const rateError = await enforceRateLimit(db, {
    action: "activity-cancel",
    identifiers: [`user:${user.email}`, `ip:${getClientIp(request)}`],
    maximum: 20,
    windowSeconds: 60 * 60,
  });
  if (rateError) return rateError;

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

  const recipients = await getRecipients(db, id, user.email);

  const result = await db
    .prepare(
      `UPDATE activities
       SET status = 'cancelled', cancellation_reason = ?
       WHERE id = ? AND creator_email = ? AND status = 'open'`,
    )
    .bind(cancellationReason, id, user.email)
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
      message: `${activity.title} 모임이 취소됐어요. 사유: ${cancellationReason}`,
      dedupeKey: `cancelled:${id}`,
    })),
  );

  return Response.json({ cancelled: true });
}
