import { Activity } from "./activity-data";
import { isReviewSessionEmail } from "./auth";

type ActivityRow = {
  id: string;
  creator_email: string;
  creator_name: string;
  sport: string;
  title: string;
  venue: string;
  starts_at: string;
  duration_minutes: number;
  capacity: number;
  level: string;
  description: string;
  notice: string;
  notice_updated_at: string | null;
  participant_count: number;
  is_joined: number;
  is_owner: number;
  waitlist_count: number;
  is_waitlisted: number;
  waitlist_position: number | null;
  facility_reserved: number;
  cancellation_deadline_minutes: number;
};

function toActivity(row: ActivityRow): Activity {
  return {
    id: row.id,
    sport: row.sport as Activity["sport"],
    title: row.title,
    venue: row.venue,
    startsAt: row.starts_at,
    durationMinutes: row.duration_minutes,
    capacity: row.capacity,
    level: row.level,
    description: row.description,
    notice: row.notice,
    noticeUpdatedAt: row.notice_updated_at,
    creatorName: row.creator_name,
    participantCount: Number(row.participant_count),
    isJoined: Boolean(row.is_joined),
    isOwner: Boolean(row.is_owner),
    waitlistCount: Number(row.waitlist_count),
    isWaitlisted: Boolean(row.is_waitlisted),
    waitlistPosition: row.waitlist_position ?? null,
    facilityReserved: Boolean(row.facility_reserved),
    cancellationDeadlineMinutes: Number(
      row.cancellation_deadline_minutes ?? 60,
    ),
  };
}

export async function listActivities(
  db: D1Database,
  email: string,
  nowMs = Date.now(),
) {
  const reviewMode = isReviewSessionEmail(email) ? 1 : 0;
  const now = new Date(nowMs).toISOString();
  const upcomingCutoff = new Date(nowMs - 30 * 60_000).toISOString();
  const historyCutoff = new Date(nowMs - 30 * 24 * 60 * 60_000).toISOString();
  const result = await db
    .prepare(
      `SELECT
        a.id,
        a.creator_email,
        a.creator_name,
        a.sport,
        a.title,
        a.venue,
        a.starts_at,
        a.duration_minutes,
        a.capacity,
        a.level,
        a.description,
        a.notice,
        a.notice_updated_at,
        a.facility_reserved,
        a.cancellation_deadline_minutes,
        COUNT(p.user_email) AS participant_count,
        CASE WHEN EXISTS (
          SELECT 1 FROM participants mine
          WHERE mine.activity_id = a.id AND mine.user_email = ?
        ) THEN 1 ELSE 0 END AS is_joined,
        CASE WHEN a.creator_email = ? THEN 1 ELSE 0 END AS is_owner,
        (SELECT COUNT(*) FROM waitlist w WHERE w.activity_id = a.id AND w.status = 'waiting') AS waitlist_count,
        CASE WHEN EXISTS (
          SELECT 1 FROM waitlist mw
          WHERE mw.activity_id = a.id AND mw.user_email = ? AND mw.status = 'waiting'
        ) THEN 1 ELSE 0 END AS is_waitlisted,
        (SELECT position FROM waitlist mw2
         WHERE mw2.activity_id = a.id AND mw2.user_email = ? AND mw2.status = 'waiting') AS waitlist_position
      FROM activities a
      LEFT JOIN participants p ON p.activity_id = a.id
      WHERE a.status = 'open'
        AND (
          (? = 1 AND a.creator_email LIKE '%@review.gachihaeu.com')
          OR
          (? = 0 AND a.creator_email NOT LIKE '%@review.gachihaeu.com')
        )
        AND (
          a.starts_at >= ?
          OR (
            a.starts_at >= ?
            AND EXISTS (
              SELECT 1 FROM participants history
              WHERE history.activity_id = a.id AND history.user_email = ?
            )
          )
        )
        AND NOT EXISTS (
          SELECT 1 FROM user_blocks ub
          WHERE
            (ub.blocker_email = ? AND ub.blocked_email = a.creator_email)
            OR
            (ub.blocker_email = a.creator_email AND ub.blocked_email = ?)
        )
      GROUP BY a.id
      ORDER BY
        CASE WHEN a.starts_at >= ? THEN 0 ELSE 1 END,
        CASE WHEN a.starts_at >= ? THEN a.starts_at END ASC,
        CASE WHEN a.starts_at < ? THEN a.starts_at END DESC
      LIMIT 100`,
    )
    .bind(
      email,
      email,
      email,
      email,
      reviewMode,
      reviewMode,
      upcomingCutoff,
      historyCutoff,
      email,
      email,
      email,
      now,
      now,
      now,
    )
    .all<ActivityRow>();

  return result.results.map(toActivity);
}
