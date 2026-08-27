import { AttendanceStatus } from "@/lib/types/activity";

export type ParticipantActivity = {
  creator_email: string;
  title: string;
  starts_at: string;
  duration_minutes: number;
  status: string;
};

export type ViewerParticipantActivity = ParticipantActivity & {
  viewer_attendance_status: AttendanceStatus | null;
};

export type ActivityParticipant = {
  email: string;
  displayName: string;
  nickname: string;
  department: string;
  mannerScore: number | null;
  mannerRatingCount: number;
  sportSkillScore: number | null;
  sportSkillRatingCount: number;
  hasRated: boolean;
  attendanceStatus: AttendanceStatus;
  isHost: boolean;
};

type ParticipantRow = {
  user_email: string;
  display_name: string;
  attendance_status: AttendanceStatus;
  nickname: string;
  department: string;
  manner_score: number | null;
  manner_rating_count: number;
  sport_skill_score: number | null;
  sport_skill_rating_count: number;
  is_host: number;
  has_rated: number;
};

export function getParticipantActivity(db: D1Database, id: string) {
  return db
    .prepare(
      `SELECT creator_email, title, starts_at, duration_minutes, status
       FROM activities
       WHERE id = ?`,
    )
    .bind(id)
    .first<ParticipantActivity>();
}

export function getActivityForViewer(
  db: D1Database,
  id: string,
  viewerEmail: string,
) {
  return db
    .prepare(
      `SELECT
         a.creator_email,
         a.title,
         a.starts_at,
         a.duration_minutes,
         a.status,
         p.attendance_status AS viewer_attendance_status
       FROM activities a
       LEFT JOIN participants p
         ON p.activity_id = a.id AND p.user_email = ?
       WHERE a.id = ?`,
    )
    .bind(viewerEmail, id)
    .first<ViewerParticipantActivity>();
}

export function hasActivityEnded(activity: ParticipantActivity) {
  return (
    new Date(activity.starts_at).getTime() +
      activity.duration_minutes * 60_000 <
    Date.now()
  );
}

export async function listActivityParticipants(
  db: D1Database,
  activityId: string,
  creatorEmail: string,
  viewerEmail: string,
): Promise<ActivityParticipant[]> {
  const rows = await db
    .prepare(
      `WITH target_sport AS (
         SELECT sport FROM activities WHERE id = ?
       ),
       participant_rating_stats AS (
         SELECT
           r.rated_email,
           AVG(r.manner_score) AS manner_score,
           COUNT(*) AS manner_rating_count,
           AVG(CASE
             WHEN r.evaluation_version = 'skill_manner_v2'
               AND rated_activity.sport = target_sport.sport
             THEN r.skill_score
           END) AS sport_skill_score,
           SUM(CASE
             WHEN r.evaluation_version = 'skill_manner_v2'
               AND rated_activity.sport = target_sport.sport
             THEN 1 ELSE 0
           END) AS sport_skill_rating_count
         FROM ratings r
         INNER JOIN activities rated_activity ON rated_activity.id = r.activity_id
         CROSS JOIN target_sport
         INNER JOIN participants target
           ON target.user_email = r.rated_email AND target.activity_id = ?
         GROUP BY r.rated_email
       )
       SELECT
         p.user_email,
         p.display_name,
         p.attendance_status,
         COALESCE(up.nickname, '') AS nickname,
         COALESCE(up.department, '') AS department,
         stats.manner_score,
         COALESCE(stats.manner_rating_count, 0) AS manner_rating_count,
         stats.sport_skill_score,
         COALESCE(stats.sport_skill_rating_count, 0) AS sport_skill_rating_count,
         CASE WHEN p.user_email = ? THEN 1 ELSE 0 END AS is_host,
         CASE WHEN mine.id IS NULL THEN 0 ELSE 1 END AS has_rated
       FROM participants p
       LEFT JOIN user_profiles up ON up.email = p.user_email
       LEFT JOIN participant_rating_stats stats ON stats.rated_email = p.user_email
       LEFT JOIN ratings mine
         ON mine.activity_id = ?
        AND mine.rater_email = ?
        AND mine.rated_email = p.user_email
       WHERE p.activity_id = ?
       ORDER BY is_host DESC, p.joined_at ASC`,
    )
    .bind(
      activityId,
      activityId,
      creatorEmail,
      activityId,
      viewerEmail,
      activityId,
    )
    .all<ParticipantRow>();

  return rows.results.map((row) => ({
    email: row.user_email,
    displayName: row.display_name,
    nickname: row.nickname || row.display_name,
    department: row.department,
    mannerScore:
      row.manner_score == null
        ? null
        : Math.round(row.manner_score * 10) / 10,
    mannerRatingCount: Number(row.manner_rating_count),
    sportSkillScore:
      row.sport_skill_score == null
        ? null
        : Math.round(row.sport_skill_score * 10) / 10,
    sportSkillRatingCount: Number(row.sport_skill_rating_count),
    hasRated: Boolean(row.has_rated),
    attendanceStatus: row.attendance_status,
    isHost: Boolean(row.is_host),
  }));
}

export function getParticipantAttendance(
  db: D1Database,
  activityId: string,
  participantEmail: string,
) {
  return db
    .prepare(
      `SELECT attendance_status
       FROM participants
       WHERE activity_id = ? AND user_email = ?`,
    )
    .bind(activityId, participantEmail)
    .first<{ attendance_status: AttendanceStatus }>();
}

export function hasHostRatedParticipant(
  db: D1Database,
  activityId: string,
  hostEmail: string,
  participantEmail: string,
) {
  return db
    .prepare(
      `SELECT 1 FROM ratings
       WHERE activity_id = ? AND rater_email = ? AND rated_email = ?`,
    )
    .bind(activityId, hostEmail, participantEmail)
    .first();
}

export function updateParticipantAttendance(
  db: D1Database,
  activityId: string,
  participantEmail: string,
  attendanceStatus: AttendanceStatus,
) {
  return db
    .prepare(
      `UPDATE participants
       SET attendance_status = ?
       WHERE activity_id = ? AND user_email = ?`,
    )
    .bind(attendanceStatus, activityId, participantEmail)
    .run();
}
