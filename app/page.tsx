import { HomeClient } from "@/app/home-client";
import { getSessionUser } from "@/server/auth/session";
import { getD1 } from "@/db/index";
import {
  getActivitySummary,
  listActivityPage,
} from "@/server/repositories/activity.repository";
import { getViewerForSession } from "@/server/services/viewer";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSessionUser();
  if (!session) {
    return (
      <HomeClient
        initialUser={null}
        initialActivities={[]}
        initialNextCursor={null}
        initialSummary={{ open: 0, people: 0, remaining: 0, venueCounts: {} }}
      />
    );
  }

  const db = getD1();
  const [user, activityPage, activitySummary] = await Promise.all([
    getViewerForSession(session),
    listActivityPage(db, session.email, { limit: 20 }),
    getActivitySummary(db, session.email),
  ]);

  return (
    <HomeClient
      initialUser={user}
      initialActivities={activityPage.activities}
      initialNextCursor={activityPage.nextCursor}
      initialSummary={activitySummary}
    />
  );
}
