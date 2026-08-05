"use client";

import { Viewer } from "./activity-data";
import { BottomNavigation } from "./components/bottom-navigation";
import { CreateSheet } from "./components/create-sheet";
import { DetailSheet } from "./components/detail-sheet";
import { HomeHeader } from "./components/home-header";
import { HomeHero } from "./components/home-hero";
import { LoginSheet } from "./components/login-sheet";
import { MatchesSection } from "./components/matches-section";
import { NotificationSheet } from "./components/notification-sheet";
import { ProfileSheet } from "./components/profile-sheet";
import { RatingSheet } from "./components/rating-sheet";
import { UserProfileSheet } from "./components/user-profile-sheet";
import { VenueSection } from "./components/venue-section";
import { useHomeController } from "./hooks/use-home-controller";

type HomeClientProps = {
  initialUser: Viewer | null;
};

export function HomeClient({ initialUser }: HomeClientProps) {
  const home = useHomeController(initialUser);

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
          activities={home.activities}
          onSelectSport={(sport) => {
            home.setSelectedSport(sport);
            document
              .getElementById("matches")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        />
        <MatchesSection
          activities={home.visibleActivities}
          dateFilters={home.dateFilters}
          selectedDate={home.selectedDate}
          selectedSport={home.selectedSport}
          myOnly={home.myOnly}
          loading={home.loading}
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
          onBrowse={() => home.setMyOnly(false)}
          onCreate={() => home.openCreate()}
        />
        <BottomNavigation
          activeNav={home.activeNav}
          onHome={home.goHome}
          onMatches={home.goMatches}
          onCreate={() => home.openCreate()}
          onMine={home.goMine}
          onProfile={home.goProfile}
        />

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
            onRelationshipChanged={() => void home.loadActivities()}
          />
        )}

        {home.toast && <div className="toast" role="status">{home.toast}</div>}
      </div>
    </main>
  );
}
