import {
  CAMPUS_ROLES,
  DEPARTMENTS,
  GENDERS,
  SPORTS,
} from "@/lib/types/activity";
import { cleanNickname, normalizeNickname } from "@/lib/validation/nickname";
import { RequestValidationError } from "@/server/security/request";
import {
  cleanUserText,
  hasUnsafeUserText,
} from "@/server/validation/content-moderation";

export type ValidatedProfileInput = {
  nickname: string;
  nicknameNormalized: string;
  gender: string;
  campusRole: string;
  department: string;
  bio: string;
  preferredSports: string;
};

export function validateProfileInput(
  payload: Record<string, unknown>,
): ValidatedProfileInput {
  const nickname = cleanNickname(payload.nickname);
  const gender = cleanUserText(payload.gender, 20);
  const campusRole = cleanUserText(payload.campusRole, 20);
  const department = cleanUserText(payload.department, 30);
  const bio = cleanUserText(payload.bio, 100);

  if (!nickname) {
    throw new RequestValidationError("닉네임을 입력해 주세요.", 400);
  }
  if (hasUnsafeUserText(nickname) || (bio && hasUnsafeUserText(bio))) {
    throw new RequestValidationError(
      "프로필에 연락처, 외부 계정 또는 부적절한 표현을 적을 수 없어요.",
      400,
    );
  }
  if (!GENDERS.includes(gender as never)) {
    throw new RequestValidationError("성별 항목을 선택해 주세요.", 400);
  }
  if (!CAMPUS_ROLES.includes(campusRole as never)) {
    throw new RequestValidationError("직위를 선택해 주세요.", 400);
  }
  if (
    !department ||
    department === "선택 안함" ||
    !DEPARTMENTS.includes(department as never)
  ) {
    throw new RequestValidationError("학과를 선택해 주세요.", 400);
  }

  const preferredSportsRaw = Array.isArray(payload.preferredSports)
    ? payload.preferredSports
    : [];
  const preferredSports = preferredSportsRaw
    .filter(
      (sport): sport is string =>
        typeof sport === "string" &&
        SPORTS.includes(sport as never) &&
        sport !== "전체",
    )
    .slice(0, 6)
    .join(",");

  return {
    nickname,
    nicknameNormalized: normalizeNickname(nickname),
    gender,
    campusRole,
    department,
    bio,
    preferredSports,
  };
}
