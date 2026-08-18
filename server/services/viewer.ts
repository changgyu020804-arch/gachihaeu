import { Viewer } from "@/lib/types/activity";
import { SessionUser } from "@/server/auth/session";

export function getViewerForSession(
  session: SessionUser,
): Viewer {
  const displayName =
    session.profile?.nickname ||
    session.displayName ||
    session.email.split("@")[0];

  return {
    email: session.email,
    displayName,
    fullName: displayName,
    onboardingComplete: Boolean(session.profile?.onboardingCompleted),
  };
}
