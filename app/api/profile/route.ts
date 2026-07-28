import { getSessionUser } from "../../auth";
import { DEPARTMENTS, SPORTS } from "../../activity-data";
import { getActivityStats, getRecentRatings, getReputation } from "../../reputation";
import { ensureSchema, getD1 } from "../../../db";

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  await ensureSchema();
  const db = getD1();

  const profile = await db
    .prepare(`SELECT email, nickname, department, bio, preferred_sports FROM user_profiles WHERE email = ?`)
    .bind(user.email)
    .first<{
      email: string;
      nickname: string;
      department: string;
      bio: string;
      preferred_sports: string;
    }>();

  const [reputation, activityStats, recentRatings] = await Promise.all([
    getReputation(db, user.email),
    getActivityStats(db, user.email),
    getRecentRatings(db, user.email),
  ]);

  const preferredSports = profile?.preferred_sports
    ? profile.preferred_sports.split(",").filter(Boolean)
    : [];

  return Response.json({
    profile: {
      email: user.email,
      nickname: profile?.nickname || user.fullName || user.email.split("@")[0],
      department: profile?.department || "",
      bio: profile?.bio || "",
      preferredSports,
      ...reputation,
      ...activityStats,
    },
    recentRatings,
  });
}

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  await ensureSchema();

  const payload = (await request.json()) as Record<string, unknown>;
  const nickname = cleanString(payload.nickname, 20);
  const department = cleanString(payload.department, 30);
  const bio = cleanString(payload.bio, 100);
  const preferredSportsRaw = Array.isArray(payload.preferredSports) ? payload.preferredSports : [];

  if (nickname.length < 1) {
    return Response.json({ error: "닉네임을 입력해 주세요." }, { status: 400 });
  }
  if (department && !DEPARTMENTS.includes(department as never)) {
    return Response.json({ error: "올바른 학과를 선택해 주세요." }, { status: 400 });
  }

  const validSports = preferredSportsRaw.filter(
    (s): s is string => typeof s === "string" && SPORTS.includes(s as never) && s !== "전체",
  );
  const preferredSports = validSports.slice(0, 6).join(",");

  const db = getD1();
  await db
    .prepare(
      `INSERT INTO user_profiles (email, nickname, department, bio, preferred_sports, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(email) DO UPDATE SET
         nickname = excluded.nickname,
         department = excluded.department,
         bio = excluded.bio,
         preferred_sports = excluded.preferred_sports,
         updated_at = excluded.updated_at`,
    )
    .bind(user.email, nickname, department, bio, preferredSports)
    .run();

  return Response.json({ success: true });
}
