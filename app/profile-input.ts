import {
  CAMPUS_ROLES,
  DEPARTMENTS,
  GENDERS,
  SPORTS,
} from "./activity-data";
import { cleanNickname, normalizeNickname } from "./nickname";
import { RequestValidationError } from "./security";

export type ValidatedProfileInput = {
  nickname: string;
  nicknameNormalized: string;
  gender: string;
  campusRole: string;
  department: string;
  bio: string;
  preferredSports: string;
};

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function validateProfileInput(
  payload: Record<string, unknown>,
): ValidatedProfileInput {
  const nickname = cleanNickname(payload.nickname);
  const gender = cleanString(payload.gender, 20);
  const campusRole = cleanString(payload.campusRole, 20);
  const department = cleanString(payload.department, 30);
  const bio = cleanString(payload.bio, 100);

  if (!nickname) {
    throw new RequestValidationError("닉네임을 입력해 주세요.", 400);
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
