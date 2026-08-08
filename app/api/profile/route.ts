import {
  createJWT,
  createSessionCookie,
  getSessionUser,
} from "@/server/auth/session";
import {
  enforceRateLimit,
  getClientIp,
  readJsonObject,
  requestErrorResponse,
} from "@/server/security/request";
import {
  getActivityStats,
  getRecentRatings,
  getReputation,
} from "@/server/repositories/reputation.repository";
import { isNicknameConflictError } from "@/lib/validation/nickname";
import { ensureSchema, getD1 } from "@/db/index";
import { isAdminEmail } from "@/server/config/runtime-env";
import { validateProfileInput } from "@/server/validation/profile-input";
import { resolveProfileRole } from "@/server/policies/profile-role";

const NICKNAME_TAKEN_MESSAGE = "이미 사용 중인 닉네임이에요.";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  await ensureSchema();
  const db = getD1();
  const profile = await db
    .prepare(
      `SELECT email, nickname, gender, campus_role, requested_campus_role,
              role_verification_status, department, bio,
              preferred_sports, onboarding_completed
       FROM user_profiles
       WHERE email = ?`,
    )
    .bind(user.email)
    .first<{
      email: string;
      nickname: string;
      gender: string;
      campus_role: string;
      requested_campus_role: string;
      role_verification_status: "not_required" | "not_submitted" | "pending" | "approved" | "rejected";
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
      campusRole: profile?.campus_role || "",
      requestedCampusRole:
        profile?.requested_campus_role || profile?.campus_role || "",
      roleVerificationStatus:
        profile?.role_verification_status || "not_required",
      isAdmin: isAdminEmail(user.email),
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
    const profileInput = validateProfileInput(payload);
    const {
      nickname,
      nicknameNormalized,
      gender,
      campusRole,
      department,
      bio,
      preferredSports,
    } = profileInput;
    const db = getD1();
    const rateError = await enforceRateLimit(db, {
      action: "profile-update",
      identifiers: [`user:${user.email}`, `ip:${getClientIp(request)}`],
      maximum: 20,
      windowSeconds: 60 * 60,
    });
    if (rateError) return rateError;

    const duplicate = await db
      .prepare(
        `SELECT email
         FROM user_profiles
         WHERE nickname_normalized = ? AND email <> ?
         LIMIT 1`,
      )
      .bind(nicknameNormalized, user.email)
      .first<{ email: string }>();

    if (duplicate) {
      return Response.json(
        { error: NICKNAME_TAKEN_MESSAGE },
        { status: 409 },
      );
    }

    const currentRole = await db
      .prepare(
        `SELECT campus_role, requested_campus_role, role_verification_status
         FROM user_profiles
         WHERE email = ?`,
      )
      .bind(user.email)
      .first<{
        campus_role: string;
        requested_campus_role: string;
        role_verification_status: string;
      }>();

    const {
      publicCampusRole,
      requestedCampusRole,
      roleVerificationStatus,
    } = resolveProfileRole(campusRole, currentRole ?? null);

    try {
      await db
        .prepare(
          `INSERT INTO user_profiles (
             email, nickname, nickname_normalized, gender, campus_role,
             requested_campus_role, role_verification_status, department, bio,
             preferred_sports, onboarding_completed, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
           ON CONFLICT(email) DO UPDATE SET
             nickname = excluded.nickname,
             nickname_normalized = excluded.nickname_normalized,
             gender = excluded.gender,
             campus_role = excluded.campus_role,
             requested_campus_role = excluded.requested_campus_role,
             role_verification_status = excluded.role_verification_status,
             department = excluded.department,
             bio = excluded.bio,
             preferred_sports = excluded.preferred_sports,
             onboarding_completed = 1,
             updated_at = excluded.updated_at`,
        )
        .bind(
          user.email,
          nickname,
          nicknameNormalized,
          gender,
          publicCampusRole,
          requestedCampusRole,
          roleVerificationStatus,
          department,
          bio,
          preferredSports,
        )
        .run();
    } catch (error) {
      if (isNicknameConflictError(error)) {
        return Response.json(
          { error: NICKNAME_TAKEN_MESSAGE },
          { status: 409 },
        );
      }
      throw error;
    }

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
