import { getSecuritySubjectHash } from "@/server/security/request";

type AccountSecurityStateRow = {
  session_version: number;
  sanction_kind: string | null;
  sanction_expires_at: string | null;
};

async function readAccountSecurityState(db: D1Database, email: string) {
  const subjectHash = await getSecuritySubjectHash(email);
  return db
    .prepare(
      `SELECT session_version, sanction_kind, sanction_expires_at
       FROM account_security_state
       WHERE subject_hash = ?`,
    )
    .bind(subjectHash)
    .first<AccountSecurityStateRow>();
}

function hasActiveRestriction(state: AccountSecurityStateRow | null) {
  if (!state?.sanction_kind) return false;
  if (!state.sanction_expires_at) return true;
  return new Date(state.sanction_expires_at).getTime() > Date.now();
}

export async function getLoginSecurityState(
  db: D1Database,
  email: string,
) {
  const state = await readAccountSecurityState(db, email);
  if (hasActiveRestriction(state)) {
    return {
      allowed: false as const,
      sessionVersion: state?.session_version ?? 0,
      error:
        state?.sanction_kind === "banned"
          ? "운영 정책에 따라 이용이 제한된 계정이에요."
          : "계정 이용이 일시 정지됐어요.",
    };
  }

  return {
    allowed: true as const,
    sessionVersion: state?.session_version ?? 0,
  };
}

export async function getSessionBootstrap(
  db: D1Database,
  email: string,
) {
  const subjectHash = await getSecuritySubjectHash(email);
  const [securityResult, profileResult] = await db.batch([
    db
      .prepare(
        `SELECT session_version
         FROM account_security_state
         WHERE subject_hash = ?`,
      )
      .bind(subjectHash),
    db
      .prepare(
        `SELECT nickname, onboarding_completed
         FROM user_profiles
         WHERE email = ?`,
      )
      .bind(email),
  ]);
  const security = securityResult.results[0] as
    | { session_version: number }
    | undefined;
  const profile = profileResult.results[0] as
    | { nickname: string; onboarding_completed: number }
    | undefined;

  return {
    sessionVersion: security?.session_version ?? 0,
    profile: profile
      ? {
          nickname: profile.nickname,
          onboardingCompleted: Boolean(profile.onboarding_completed),
        }
      : null,
  };
}
