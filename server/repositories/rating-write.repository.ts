import type {
  AttendanceStatus,
  RatingEvaluationVersion,
  RatingType,
} from "@/lib/types/activity";

export type RatingContext = {
  creatorEmail: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  status: string;
  raterAttendanceStatus: AttendanceStatus | null;
  ratedAttendanceStatus: AttendanceStatus | null;
  hasBlockedRelationship: boolean;
};

type RatingContextRow = {
  creator_email: string;
  title: string;
  starts_at: string;
  duration_minutes: number;
  status: string;
  rater_attendance_status: AttendanceStatus | null;
  rated_attendance_status: AttendanceStatus | null;
  has_blocked_relationship: number;
};

export async function getRatingContext(
  db: D1Database,
  activityId: string,
  raterEmail: string,
  ratedEmail: string,
): Promise<RatingContext | null> {
  const row = await db
    .prepare(
      `SELECT
         a.creator_email,
         a.title,
         a.starts_at,
         a.duration_minutes,
         a.status,
         (
           SELECT p.attendance_status
           FROM participants p
           WHERE p.activity_id = a.id AND p.user_email = ?
         ) AS rater_attendance_status,
         (
           SELECT p.attendance_status
           FROM participants p
           WHERE p.activity_id = a.id AND p.user_email = ?
         ) AS rated_attendance_status,
         CASE WHEN EXISTS (
           SELECT 1
           FROM user_blocks ub
           WHERE
             (ub.blocker_email = ? AND ub.blocked_email = ?)
             OR
             (ub.blocker_email = ? AND ub.blocked_email = ?)
         ) THEN 1 ELSE 0 END AS has_blocked_relationship
       FROM activities a
       WHERE a.id = ?`,
    )
    .bind(
      raterEmail,
      ratedEmail,
      raterEmail,
      ratedEmail,
      ratedEmail,
      raterEmail,
      activityId,
    )
    .first<RatingContextRow>();

  if (!row) return null;
  return {
    creatorEmail: row.creator_email,
    title: row.title,
    startsAt: row.starts_at,
    durationMinutes: row.duration_minutes,
    status: row.status,
    raterAttendanceStatus: row.rater_attendance_status,
    ratedAttendanceStatus: row.rated_attendance_status,
    hasBlockedRelationship: Boolean(row.has_blocked_relationship),
  };
}

type SaveRatingInput = {
  activityId: string;
  raterEmail: string;
  ratedEmail: string;
  trustScore: number;
  skillScore: number;
  mannerScore: number;
  ratingType: RatingType;
  evaluationVersion: RatingEvaluationVersion;
  comment: string;
};

export async function saveRating(db: D1Database, input: SaveRatingInput) {
  const proposedId = crypto.randomUUID();
  const saved = await db
    .prepare(
      `INSERT INTO ratings (
         id, activity_id, rater_email, rated_email,
         trust_score, skill_score, manner_score, rating_type,
         evaluation_version, comment
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(activity_id, rater_email, rated_email) DO UPDATE SET
         trust_score = excluded.trust_score,
         skill_score = excluded.skill_score,
         manner_score = excluded.manner_score,
         rating_type = excluded.rating_type,
         evaluation_version = excluded.evaluation_version,
         comment = excluded.comment
       RETURNING id`,
    )
    .bind(
      proposedId,
      input.activityId,
      input.raterEmail,
      input.ratedEmail,
      input.trustScore,
      input.skillScore,
      input.mannerScore,
      input.ratingType,
      input.evaluationVersion,
      input.comment,
    )
    .first<{ id: string }>();

  const id = saved?.id ?? proposedId;
  return { id, created: id === proposedId };
}
