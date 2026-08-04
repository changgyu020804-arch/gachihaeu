import {
  createJWT,
  createSessionCookie,
  getSessionUser,
} from "../../auth";
import { DEPARTMENTS, GENDERS, SPORTS } from "../../activity-data";
import {
  enforceRateLimit,
  getClientIp,
  readJsonObject,
  requestErrorResponse,
} from "../../security";
import {
  getActivityStats,
  getRecentRatings,
  getReputation,
} from "../../reputation";
import { ensureSchema, getD1 } from "../../../db";

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  await ensureSchema();
  const db = getD1();
  const profile = await db
    .prepare(
      `SELECT email, nickname, gender, department, bio,
              preferred_sports, onboarding_completed
       FROM user_profiles
       WHERE email = ?`,
    )
    .bind(user.email)
    .first<{
      email: string;
      nickname: string;
      gender: string;
      department: string;
      bio: string;
      preferred_sports: string;
      onboarding_completed: number;
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
      gender: profile?.gender || "",
      department: profile?.department || "",
      bio: profile?.bio || "",
      preferredSports,
      onboardingComplete: Boolean(profile?.onboarding_completed),
      ...reputation,
      ...activityStats,
    },
    recentRatings,
  });
}

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  try {
    await ensureSchema();
    const payload = await readJsonObject(request, 8_192);
    const nickname = cleanString(payload.nickname, 20);
    const gender = cleanString(payload.gender, 20);
    const department = cleanString(payload.department, 30);
    const bio = cleanString(payload.bio, 100);
    const preferredSportsRaw = Array.isArray(payload.preferredSports)
      ? payload.preferredSports
      : [];

    if (nickname.length < 1) {
      return Response.json(
        { error: "닉네임을 입력해 주세요." },
        { status: 400 },
      );
    }
    if (!GENDERS.includes(gender as never)) {
      return Response.json(
        { error: "성별 항목을 선택해 주세요." },
        { status: 400 },
      );
    }
    if (
      !department ||
      department === "선택 안함" ||
      !DEPARTMENTS.includes(department as never)
    ) {
      return Response.json(
        { error: "학과를 선택해 주세요." },
        { status: 400 },
      );
    }

    const validSports = preferredSportsRaw.filter(
      (sport): sport is string =>
        typeof sport === "string" &&
        SPORTS.includes(sport as never) &&
        sport !== "전체",
    );
    const preferredSports = validSports.slice(0, 6).join(",");
    const db = getD1();
    const rateError = await enforceRateLimit(db, {
      action: "profile-update",
      identifiers: [`user:${user.email}`, `ip:${getClientIp(request)}`],
      maximum: 20,
      windowSeconds: 60 * 60,
    });
    if (rateError) return rateError;

    await db
      .prepare(
        `INSERT INTO user_profiles (
           email, nickname, gender, department, bio,
           preferred_sports, onboarding_completed, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'))
         ON CONFLICT(email) DO UPDATE SET
           nickname = excluded.nickname,
           gender = excluded.gender,
           department = excluded.department,
           bio = excluded.bio,
           preferred_sports = excluded.preferred_sports,
           onboarding_completed = 1,
           updated_at = excluded.updated_at`,
      )
      .bind(
        user.email,
        nickname,
        gender,
        department,
        bio,
        preferredSports,
      )
      .run();

    const token = await createJWT({
      email: user.email,
      displayName: nickname,
      fullName: nickname,
      auth_time: user.authenticatedAt,
    });
    const headers = new Headers({
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    headers.append(
      "Set-Cookie",
      createSessionCookie(token, user.authenticatedAt),
    );

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          email: user.email,
          displayName: nickname,
          fullName: nickname,
          onboardingComplete: true,
        },
      }),
      { status: 200, headers },
    );
  } catch (error) {
    return requestErrorResponse(error);
  }
}
