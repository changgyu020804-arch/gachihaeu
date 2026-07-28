import { RatingType, RecentRating } from "./activity-data";

function roundOne(value: number | null | undefined) {
  return value == null ? null : Math.round(value * 10) / 10;
}

function normalizeRatingType(value: string): RatingType {
  if (value === "host_to_member" || value === "member_to_host") return value;
  return "legacy";
}

export async function getReputation(db: D1Database, email: string) {
  const stats = await db
    .prepare(
      `SELECT
        AVG((trust_score + skill_score + manner_score) / 3.0) AS reputation_score,
        COUNT(*) AS rating_count,
        SUM(CASE WHEN rating_type = 'host_to_member' THEN 1 ELSE 0 END) AS member_rating_count,
        SUM(CASE WHEN rating_type = 'member_to_host' THEN 1 ELSE 0 END) AS host_rating_count,
        AVG(CASE WHEN rating_type = 'host_to_member' THEN trust_score END) AS avg_punctuality,
        AVG(CASE WHEN rating_type = 'host_to_member' THEN skill_score END) AS avg_teamwork,
        AVG(CASE WHEN rating_type = 'host_to_member' THEN manner_score END) AS avg_member_manner,
        AVG(CASE WHEN rating_type = 'member_to_host' THEN trust_score END) AS avg_accuracy,
        AVG(CASE WHEN rating_type = 'member_to_host' THEN skill_score END) AS avg_facilitation,
        AVG(CASE WHEN rating_type = 'member_to_host' THEN manner_score END) AS avg_safety
      FROM ratings
      WHERE rated_email = ?`,
    )
    .bind(email)
    .first<{
      reputation_score: number | null;
      rating_count: number;
      member_rating_count: number;
      host_rating_count: number;
      avg_punctuality: number | null;
      avg_teamwork: number | null;
      avg_member_manner: number | null;
      avg_accuracy: number | null;
      avg_facilitation: number | null;
      avg_safety: number | null;
    }>();

  return {
    reputationScore: roundOne(stats?.reputation_score),
    ratingCount: Number(stats?.rating_count ?? 0),
    memberRatingCount: Number(stats?.member_rating_count ?? 0),
    hostRatingCount: Number(stats?.host_rating_count ?? 0),
    avgPunctuality: roundOne(stats?.avg_punctuality),
    avgTeamwork: roundOne(stats?.avg_teamwork),
    avgMemberManner: roundOne(stats?.avg_member_manner),
    avgAccuracy: roundOne(stats?.avg_accuracy),
    avgFacilitation: roundOne(stats?.avg_facilitation),
    avgSafety: roundOne(stats?.avg_safety),
  };
}

export async function getRecentRatings(
  db: D1Database,
  email: string,
  limit = 10,
): Promise<RecentRating[]> {
  const rows = await db
    .prepare(
      `SELECT
        r.id,
        r.rating_type,
        r.trust_score,
        r.skill_score,
        r.manner_score,
        r.comment,
        r.created_at,
        a.sport,
        a.title
      FROM ratings r
      LEFT JOIN activities a ON a.id = r.activity_id
      WHERE r.rated_email = ?
        AND TRIM(r.comment) <> ''
        AND r.comment_hidden = 0
      ORDER BY r.created_at DESC
      LIMIT ?`,
    )
    .bind(email, limit)
    .all<{
      id: string;
      rating_type: string;
      trust_score: number;
      skill_score: number;
      manner_score: number;
      comment: string;
      created_at: string;
      sport: string | null;
      title: string | null;
    }>();

  return rows.results.map((row) => ({
    id: row.id,
    ratingType: normalizeRatingType(row.rating_type),
    scoreOne: row.trust_score,
    scoreTwo: row.skill_score,
    scoreThree: row.manner_score,
    comment: row.comment,
    createdAt: row.created_at,
    sport: row.sport || "운동",
    title: row.title || "종료된 모임",
  }));
}

export async function getActivityStats(db: D1Database, email: string) {
  const stats = await db
    .prepare(
      `SELECT
        (
          SELECT COUNT(*)
          FROM participants p
          INNER JOIN activities a ON a.id = p.activity_id
          WHERE p.user_email = ?
            AND p.attendance_status = 'attended'
            AND a.status = 'open'
            AND datetime(a.starts_at, '+' || a.duration_minutes || ' minutes') <= datetime('now')
        ) AS participation_count,
        (
          SELECT COUNT(*)
          FROM activities a
          WHERE a.creator_email = ?
            AND a.status = 'open'
            AND datetime(a.starts_at, '+' || a.duration_minutes || ' minutes') <= datetime('now')
        ) AS host_count,
        (
          SELECT COUNT(*)
          FROM participants p
          WHERE p.user_email = ? AND p.attendance_status = 'no_show'
        ) AS no_show_count`,
    )
    .bind(email, email, email)
    .first<{
      participation_count: number;
      host_count: number;
      no_show_count: number;
    }>();

  return {
    participationCount: Number(stats?.participation_count ?? 0),
    hostCount: Number(stats?.host_count ?? 0),
    noShowCount: Number(stats?.no_show_count ?? 0),
  };
}
