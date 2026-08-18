"use client";

import { lazy, Suspense } from "react";
import { Activity, ActivitySummary, Viewer } from "@/lib/types/activity";
import { BottomNavigation } from "@/components/layout/bottom-navigation";
import { HomeHeader } from "@/components/layout/home-header";
import { HomeHero } from "@/components/layout/home-hero";
import { ActivitiesSection } from "@/components/activity/activities-section";
import { VenueSection } from "@/components/activity/venue-section";
import { useHomeController } from "@/hooks/use-home-controller";
import { PolicyLinks } from "@/components/layout/policy-links";

const CreateSheet = lazy(() =>
  import("@/components/activity/create-sheet").then((module) => ({
    default: module.CreateSheet,
  })),
);
const DetailSheet = lazy(() =>
  import("@/components/activity/detail-sheet").then((module) => ({
    default: module.DetailSheet,
  })),
);
const LoginSheet = lazy(() =>
  import("@/components/auth/login-sheet").then((module) => ({
    default: module.LoginSheet,
  })),
);
const NotificationSheet = lazy(() =>
  import("@/components/notifications/notification-sheet").then((module) => ({
    default: module.NotificationSheet,
  })),
);
const ProfileSheet = lazy(() =>
  import("@/components/profile/profile-sheet").then((module) => ({
    default: module.ProfileSheet,
  })),
);
const RatingSheet = lazy(() =>
  import("@/components/rating/rating-sheet").then((module) => ({
    default: module.RatingSheet,
  })),
);
const UserProfileSheet = lazy(() =>
  import("@/components/profile/user-profile-sheet").then((module) => ({
    default: module.UserProfileSheet,
  })),
);

type HomeClientProps = {
  initialUser: Viewer | null;
  initialActivities: Activity[];
  initialNextCursor: string | null;
  initialSummary: ActivitySummary;
};

export function HomeClient({
  initialUser,
  initialActivities,
  initialNextCursor,
  initialSummary,
}: HomeClientProps) {
  const home = useHomeController({
    initialUser,
    initialActivities,
    initialNextCursor,
    initialSummary,
  });

  return (
    <main className="page-shell">
      <div className="app-frame">
        <HomeHeader
          user={home.currentUser}
          unreadCount={home.unreadNotifications}
          onOpenNotifications={() => home.setShowNotifications(true)}
          onOpenProfile={() =>
            home.requireLogin(() => home.setShowProfile(true))
          }
          onOpenLogin={() => home.setShowLogin(true)}
        />
        <HomeHero
          openCount={home.stats.open}
          participantCount={home.stats.people}
          remainingCount={home.stats.remaining}
        />
        <VenueSection
          venueCounts={home.venueCounts}
          onSelectSport={(sport) => {
            home.setSelectedSport(sport);
            document
              .getElementById("matches")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        />
        <ActivitiesSection
          activities={home.visibleActivities}
          dateFilters={home.dateFilters}
          selectedDate={home.selectedDate}
          selectedSport={home.selectedSport}
          myOnly={home.myOnly}
          loading={home.loading}
          loadingMore={home.loadingMore}
          hasMore={home.hasMore}
          submitting={home.submitting}
          error={home.error}
          onSelectDate={home.setSelectedDate}
          onSelectSport={home.setSelectedSport}
          onSelectActivity={home.setSelectedActivity}
          onPerformAction={(path, method, message) =>
            void home.performAction(path, method, message)
          }
          onOpenRating={home.openRating}
          onRetry={() => void home.loadActivities()}
          onLoadMore={() => void home.loadMore()}
          onBrowse={() => home.setMyOnly(false)}
          onCreate={() => home.openCreate()}
        />
        <PolicyLinks />
        <BottomNavigation
          activeNav={home.activeNav}
          onHome={home.goHome}
          onMatches={home.goMatches}
          onCreate={() => home.openCreate()}
          onMine={home.goMine}
          onProfile={home.goProfile}
        />

        <Suspense fallback={null}>
          {home.showLogin && (
            <LoginSheet
              existingUser={home.currentUser}
              onClose={() => home.setShowLogin(false)}
              onLogin={home.handleLogin}
            />
          )}

          {home.showCreate && (
            <CreateSheet
              onClose={() => home.setShowCreate(false)}
              onCreated={() => void home.loadActivities()}
              onToast={home.setToast}
              defaultSport={home.createDefaults.sport}
              defaultVenue={home.createDefaults.venue}
            />
          )}

          {home.selectedActivity && (
            <DetailSheet
              activity={home.selectedActivity}
              submitting={home.submitting}
              onClose={() => home.setSelectedActivity(null)}
              onPerformAction={(path, method, message, body) =>
                void home.performAction(path, method, message, body)
              }
              onOpenRating={home.openRating}
              onReport={(activity) => void home.reportActivity(activity)}
              onViewProfile={home.setViewingUserEmail}
              onToast={home.setToast}
            />
          )}

          {home.showProfile && home.currentUser?.onboardingComplete && (
            <ProfileSheet
              user={home.currentUser}
              onClose={() => home.setShowProfile(false)}
              onLogout={() => void home.handleLogout()}
              onAccountDeleted={home.handleAccountDeleted}
              onToast={home.setToast}
            />
          )}

          {home.showNotifications && home.currentUser && (
            <NotificationSheet
              onClose={() => home.setShowNotifications(false)}
              onUnreadChange={home.setUnreadNotifications}
              onOpenNotification={home.handleOpenNotification}
            />
          )}

          {home.ratingActivityId && home.currentUser && (
            <RatingSheet
              activityId={home.ratingActivityId}
              onClose={() => home.setRatingActivityId(null)}
              onToast={home.setToast}
              onViewProfile={home.setViewingUserEmail}
            />
          )}

          {home.viewingUserEmail && (
            <UserProfileSheet
              email={home.viewingUserEmail}
              onClose={() => home.setViewingUserEmail(null)}
              onToast={home.setToast}
              onRelationshipChanged={async () => {
                home.setSelectedActivity(null);
                await home.loadActivities();
              }}
            />
          )}
        </Suspense>

        {home.toast && <div className="toast" role="status">{home.toast}</div>}
      </div>
    </main>
  );
}
