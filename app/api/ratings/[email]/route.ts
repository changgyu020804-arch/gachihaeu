import { getSessionUser } from "../../../auth";
import { getRecentRatings, getReputation } from "../../../reputation";
import { ensureSchema, getD1 } from "../../../../db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ email: string }> },
) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  await ensureSchema();
  const { email } = await params;
  const decodedEmail = decodeURIComponent(email).trim().slice(0, 100);
  if (!decodedEmail) {
    return Response.json({ error: "사용자 정보가 필요해요." }, { status: 400 });
  }

  const db = getD1();
  const profile = await db
    .prepare(
      `SELECT nickname, department, bio, preferred_sports
       FROM user_profiles
       WHERE email = ?`,
    )
    .bind(decodedEmail)
    .first<{
      nickname: string;
      department: string;
      bio: string;
      preferred_sports: string;
    }>();

  const [reputation, recentRatings] = await Promise.all([
    getReputation(db, decodedEmail),
    getRecentRatings(db, decodedEmail),
  ]);

  return Response.json({
    profile: {
      email: decodedEmail,
      nickname: profile?.nickname || decodedEmail.split("@")[0],
      department: profile?.department || "",
      bio: profile?.bio || "",
      preferredSports: profile?.preferred_sports
        ? profile.preferred_sports.split(",").filter(Boolean)
        : [],
      ...reputation,
    },
    recentRatings,
  });
}
