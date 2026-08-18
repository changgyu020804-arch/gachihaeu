import { HomeClient } from "@/app/home-client";
import { getSessionUser } from "@/server/auth/session";
import { getD1 } from "@/db/index";
import { getActivityHomeData } from "@/server/repositories/activity.repository";
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
  const [user, homeData] = await Promise.all([
    getViewerForSession(session),
    getActivityHomeData(db, session.email, { limit: 20 }),
  ]);

  return (
    <HomeClient
      initialUser={user}
      initialActivities={homeData.page.activities}
      initialNextCursor={homeData.page.nextCursor}
      initialSummary={homeData.summary}
    />
  );
}
