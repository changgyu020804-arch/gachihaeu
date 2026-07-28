import { ensureSchema, getD1 } from "../../../../db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ email: string }> },
) {
  await ensureSchema();
  const { email } = await params;
  const decodedEmail = decodeURIComponent(email);
  const db = getD1();

  // 프로필 정보
  const profile = await db
    .prepare(`SELECT nickname, department, bio, preferred_sports FROM user_profiles WHERE email = ?`)
    .bind(decodedEmail)
    .first<{
      nickname: string;
      department: string;
      bio: string;
      preferred_sports: string;
    }>();

  // 평균 점수
  const stats = await db
    .prepare(
      `SELECT
        AVG(trust_score) AS avg_trust,
        AVG(skill_score) AS avg_skill,
        AVG(manner_score) AS avg_manner,
        COUNT(*) AS rating_count
      FROM ratings WHERE rated_email = ?`,
    )
    .bind(decodedEmail)
    .first<{
      avg_trust: number | null;
      avg_skill: number | null;
      avg_manner: number | null;
      rating_count: number;
    }>();

  // 최근 평가 목록 (최대 10개)
  const recentRatings = await db
    .prepare(
      `SELECT r.trust_score, r.skill_score, r.manner_score, r.comment, r.created_at,
              a.sport, a.title
       FROM ratings r
       LEFT JOIN activities a ON a.id = r.activity_id
       WHERE r.rated_email = ?
       ORDER BY r.created_at DESC
       LIMIT 10`,
    )
    .bind(decodedEmail)
    .all<{
      trust_score: number;
      skill_score: number;
      manner_score: number;
      comment: string;
      created_at: string;
      sport: string;
      title: string;
    }>();

  return Response.json({
    profile: {
      email: decodedEmail,
      nickname: profile?.nickname || decodedEmail.split("@")[0],
      department: profile?.department || "",
      bio: profile?.bio || "",
      preferredSports: profile?.preferred_sports ? profile.preferred_sports.split(",").filter(Boolean) : [],
      avgTrust: stats?.avg_trust ? Math.round(stats.avg_trust * 10) / 10 : null,
      avgSkill: stats?.avg_skill ? Math.round(stats.avg_skill * 10) / 10 : null,
      avgManner: stats?.avg_manner ? Math.round(stats.avg_manner * 10) / 10 : null,
      ratingCount: stats?.rating_count || 0,
    },
    recentRatings: recentRatings.results.map((r: {
      trust_score: number;
      skill_score: number;
      manner_score: number;
      comment: string;
      created_at: string;
      sport: string;
      title: string;
    }) => ({
      trustScore: r.trust_score,
      skillScore: r.skill_score,
      mannerScore: r.manner_score,
      comment: r.comment,
      createdAt: r.created_at,
      sport: r.sport,
      title: r.title,
    })),
  });
}
