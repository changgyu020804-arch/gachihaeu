import { Viewer } from "@/lib/types/activity";
import { SessionUser } from "@/server/auth/session";
import { getD1 } from "@/db/index";

type ProfileIdentity = {
  nickname: string;
  onboarding_completed: number;
};

export async function getViewerForSession(
  session: SessionUser,
): Promise<Viewer> {
  const profile = await getD1()
    .prepare(
      `SELECT nickname, onboarding_completed
       FROM user_profiles
       WHERE email = ?`,
    )
    .bind(session.email)
    .first<ProfileIdentity>();
  const displayName =
    profile?.nickname || session.displayName || session.email.split("@")[0];

  return {
    email: session.email,
    displayName,
    fullName: displayName,
    onboardingComplete: Boolean(profile?.onboarding_completed),
  };
}
