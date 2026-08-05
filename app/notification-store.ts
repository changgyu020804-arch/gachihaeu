import { getD1 } from "../db";

export type NotificationType =
  | "joined"
  | "participant_joined"
  | "participant_left"
  | "waitlisted"
  | "promoted"
  | "cancelled"
  | "reminder"
  | "rating"
  | "attendance"
  | "rated"
  | "notice"
  | "comment"
  | "role_verification";

type NewNotification = {
  userEmail: string;
  activityId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  dedupeKey: string;
};

export async function createNotifications(items: NewNotification[]) {
  if (items.length === 0) return;
  const db = getD1();

  await db.batch(
    items.map((item) =>
      db
        .prepare(
          `INSERT OR IGNORE INTO notifications (
             id, user_email, activity_id, type, title, message, dedupe_key
           ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          item.userEmail,
          item.activityId ?? null,
          item.type,
          item.title,
          item.message,
          item.dedupeKey,
        ),
    ),
  );
}

export async function syncScheduledNotifications(userEmail: string) {
  const db = getD1();
  const rows = await db
    .prepare(
      `SELECT
         a.id,
         a.title,
         a.sport,
         a.starts_at,
         a.duration_minutes,
         a.creator_email
       FROM activities a
       INNER JOIN participants p ON p.activity_id = a.id
       WHERE p.user_email = ?
         AND a.status = 'open'
         AND datetime(a.starts_at) >= datetime('now', '-30 days')
         AND datetime(a.starts_at) <= datetime('now', '+1 hour')`,
    )
    .bind(userEmail)
    .all<{
      id: string;
      title: string;
      sport: string;
      starts_at: string;
      duration_minutes: number;
      creator_email: string;
    }>();

  const now = Date.now();
  const notifications: NewNotification[] = [];

  for (const activity of rows.results) {
    const startsAt = new Date(activity.starts_at).getTime();
    const endsAt = startsAt + activity.duration_minutes * 60_000;

    if (startsAt > now && startsAt - now <= 60 * 60_000) {
      notifications.push({
        userEmail,
        activityId: activity.id,
        type: "reminder",
        title: "모임이 곧 시작해요",
        message: `${activity.title} 모임이 1시간 안에 시작돼요. 장소와 시간을 확인해 주세요.`,
        dedupeKey: `reminder:${activity.id}`,
      });
    }

    if (endsAt <= now && now - endsAt <= 30 * 24 * 60 * 60_000) {
      notifications.push({
        userEmail,
        activityId: activity.id,
        type: "rating",
        title: "운동은 즐거우셨나요?",
        message:
          activity.creator_email === userEmail
            ? `${activity.title}의 출석을 확인하고 구성원을 평가해 주세요.`
            : `${activity.title} 모임장을 평가해 주세요.`,
        dedupeKey: `rating:${activity.id}`,
      });
    }
  }

  await createNotifications(notifications);
}
