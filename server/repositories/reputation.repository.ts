import {
  RatingEvaluationVersion,
  RatingType,
  RecentRating,
  Sport,
  SportSkillRating,
} from "@/lib/types/activity";

function roundOne(value: number | null | undefined) {
  return value == null ? null : Math.round(value * 10) / 10;
}

function normalizeRatingType(value: string): RatingType {
  if (value === "host_to_member" || value === "member_to_host") return value;
  return "legacy";
}

function normalizeEvaluationVersion(value: string): RatingEvaluationVersion {
  return value === "skill_manner_v2" ? value : "role_v1";
}

export async function getReputation(db: D1Database, email: string) {
  const [stats, sportSkills] = await Promise.all([
    db
      .prepare(
        `SELECT
          AVG(manner_score) AS manner_score,
          COUNT(*) AS manner_rating_count
        FROM ratings
        WHERE rated_email = ?`,
      )
      .bind(email)
      .first<{
        manner_score: number | null;
        manner_rating_count: number;
      }>(),
    db
      .prepare(
        `SELECT
          a.sport,
          AVG(r.skill_score) AS skill_score,
          COUNT(*) AS rating_count
        FROM ratings r
        INNER JOIN activities a ON a.id = r.activity_id
        WHERE r.rated_email = ?
          AND r.evaluation_version = 'skill_manner_v2'
        GROUP BY a.sport
        ORDER BY rating_count DESC, a.sport ASC`,
      )
      .bind(email)
      .all<{
        sport: Sport;
        skill_score: number | null;
        rating_count: number;
      }>(),
  ]);

  const sportSkillScores: SportSkillRating[] = sportSkills.results.map((row) => ({
    sport: row.sport,
    score: roundOne(row.skill_score),
    ratingCount: Number(row.rating_count),
  }));

  return {
    mannerScore: roundOne(stats?.manner_score),
    mannerRatingCount: Number(stats?.manner_rating_count ?? 0),
    sportSkillScores,
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
        r.evaluation_version,
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
      evaluation_version: string;
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
    evaluationVersion: normalizeEvaluationVersion(row.evaluation_version),
    scoreOne: row.trust_score,
    scoreTwo: row.skill_score,
    scoreThree: row.manner_score,
    skillScore: row.skill_score,
    mannerScore: row.manner_score,
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
