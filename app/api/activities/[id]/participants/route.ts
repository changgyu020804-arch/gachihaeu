import { getSessionUser } from "../../../../auth";
import { ensureSchema, getD1 } from "../../../../../db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureSchema();
  const user = await getSessionUser();
  const currentEmail = user?.email ?? "";
  const { id } = await params;
  const db = getD1();

  // 참여자 목록 + 프로필 + 평균 점수 + 내가 이미 평가했는지 여부
  const rows = await db
    .prepare(
      `SELECT
        p.user_email,
        p.display_name,
        COALESCE(up.nickname, '') AS nickname,
        COALESCE(up.department, '') AS department,
        (SELECT AVG(trust_score) FROM ratings WHERE rated_email = p.user_email) AS avg_trust,
        (SELECT AVG(skill_score) FROM ratings WHERE rated_email = p.user_email) AS avg_skill,
        (SELECT AVG(manner_score) FROM ratings WHERE rated_email = p.user_email) AS avg_manner,
        (SELECT COUNT(*) FROM ratings WHERE rated_email = p.user_email) AS rating_count,
        CASE WHEN EXISTS (
          SELECT 1 FROM ratings
          WHERE activity_id = ? AND rater_email = ? AND rated_email = p.user_email
        ) THEN 1 ELSE 0 END AS has_rated
      FROM participants p
      LEFT JOIN user_profiles up ON up.email = p.user_email
      WHERE p.activity_id = ?
      ORDER BY p.joined_at ASC`,
    )
    .bind(id, currentEmail, id)
    .all<{
      user_email: string;
      display_name: string;
      nickname: string;
      department: string;
      avg_trust: number | null;
      avg_skill: number | null;
      avg_manner: number | null;
      rating_count: number;
      has_rated: number;
    }>();

  const participants = rows.results.map((row: {
    user_email: string;
    display_name: string;
    nickname: string;
    department: string;
    avg_trust: number | null;
    avg_skill: number | null;
    avg_manner: number | null;
    rating_count: number;
    has_rated: number;
  }) => ({
    email: row.user_email,
    displayName: row.display_name,
    nickname: row.nickname || row.display_name,
    department: row.department,
    avgTrust: row.avg_trust ? Math.round(row.avg_trust * 10) / 10 : null,
    avgSkill: row.avg_skill ? Math.round(row.avg_skill * 10) / 10 : null,
    avgManner: row.avg_manner ? Math.round(row.avg_manner * 10) / 10 : null,
    ratingCount: row.rating_count,
    hasRated: Boolean(row.has_rated),
  }));

  return Response.json({ participants });
}
