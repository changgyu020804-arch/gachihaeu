"use client";

import { useEffect, useState } from "react";
import { Activity, Sport, Viewer } from "./activity-data";
import { getErrorMessage } from "./components/utils";
import { LoginSheet } from "./components/login-sheet";
import { CreateSheet } from "./components/create-sheet";
import { DetailSheet } from "./components/detail-sheet";
import { ProfileSheet } from "./components/profile-sheet";
import { RatingSheet } from "./components/rating-sheet";
import { UserProfileSheet } from "./components/user-profile-sheet";
import {
  AppNotification,
  NotificationSheet,
} from "./components/notification-sheet";
import { HomeHeader } from "./components/home-header";
import { HomeHero } from "./components/home-hero";
import { VenueSection } from "./components/venue-section";
import { MatchesSection } from "./components/matches-section";
import {
  ActiveNav,
  BottomNavigation,
} from "./components/bottom-navigation";
import { useHomeActivities } from "./hooks/use-home-activities";
import { useNotificationCount } from "./hooks/use-notification-count";
import { useSessionUser } from "./hooks/use-session-user";

type HomeClientProps = {
  initialUser: Viewer | null;
};

export function HomeClient({ initialUser }: HomeClientProps) {
  const {
    currentUser,
    setCurrentUser,
    showLogin,
    setShowLogin,
    requireLogin,
  } = useSessionUser(initialUser);
  const {
    activities,
    visibleActivities,
    stats,
    dateFilters,
    selectedSport,
    setSelectedSport,
    selectedDate,
    setSelectedDate,
    myOnly,
    setMyOnly,
    loading,
    error,
    setError,
    loadActivities,
  } = useHomeActivities();
  const {
    unreadCount: unreadNotifications,
    setUnreadCount: setUnreadNotifications,
  } = useNotificationCount(currentUser);

  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeNav, setActiveNav] = useState<ActiveNav>("home");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");

  // 평가 시스템
  const [ratingActivityId, setRatingActivityId] = useState<string | null>(null);
  const [viewingUserEmail, setViewingUserEmail] = useState<string | null>(null);

  // 모임 만들기 기본값
  const [createDefaults, setCreateDefaults] = useState<{ sport?: Sport; venue?: string }>({});

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // --- 액션 핸들러 ---

  const openCreate = (sport?: Sport, venue?: string) => {
    requireLogin(() => {
      setCreateDefaults({ sport, venue });
      setShowCreate(true);
    });
  };

  const performAction = async (
    path: string,
    method: "POST" | "PATCH" | "DELETE",
    successMessage: string,
    body?: unknown,
  ) => {
    if (!currentUser || !currentUser.onboardingComplete) {
      setShowLogin(true);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "요청을 처리하지 못했어요.");
      setToast(successMessage);
      setSelectedActivity(null);
      await loadActivities();
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    } finally {
      setSubmitting(false);
    }
  };

  const openRating = (activityId: string) => {
    requireLogin(() => setRatingActivityId(activityId));
  };

  const reportActivity = async (activity: Activity) => {
    if (!window.confirm("이 모임을 부적절한 콘텐츠로 신고할까요?")) return;
    await performAction(`/api/activities/${activity.id}/report`, "POST", "신고가 접수됐어요.", { reason: "부적절한 모임 정보" });
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setCurrentUser(null);
    setShowProfile(false);
    setShowNotifications(false);
    setUnreadNotifications(0);
    setToast("로그아웃 되었어요.");
  };

  const handleOpenNotification = (notification: AppNotification) => {
    setShowNotifications(false);
    if (!notification.activityId) return;
    if (notification.type === "rating") {
      setRatingActivityId(notification.activityId);
      return;
    }
    const activity = activities.find((item) => item.id === notification.activityId);
    if (activity) setSelectedActivity(activity);
  };

  // --- 렌더링 ---

  return (
    <main className="page-shell">
      <div className="app-frame">
        <HomeHeader
          user={currentUser}
          unreadCount={unreadNotifications}
          onOpenNotifications={() => setShowNotifications(true)}
          onOpenProfile={() =>
            requireLogin(() => setShowProfile(true))
          }
          onOpenLogin={() => setShowLogin(true)}
        />
        <HomeHero
          openCount={stats.open}
          participantCount={stats.people}
          remainingCount={stats.remaining}
        />
        <VenueSection
          activities={activities}
          onSelectSport={(sport) => {
            setSelectedSport(sport);
            document.getElementById("matches")?.scrollIntoView({ behavior: "smooth" });
          }}
        />
        <MatchesSection
          activities={visibleActivities}
          dateFilters={dateFilters}
          selectedDate={selectedDate}
          selectedSport={selectedSport}
          myOnly={myOnly}
          loading={loading}
          submitting={submitting}
          error={error}
          onSelectDate={setSelectedDate}
          onSelectSport={setSelectedSport}
          onSelectActivity={setSelectedActivity}
          onPerformAction={(path, method, message) =>
            void performAction(path, method, message)
          }
          onOpenRating={openRating}
          onRetry={() => void loadActivities()}
          onBrowse={() => setMyOnly(false)}
          onCreate={() => openCreate()}
        />
        <BottomNavigation
          activeNav={activeNav}
          onHome={() => {
            setActiveNav("home");
            setMyOnly(false);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onMatches={() => {
            setActiveNav("matches");
            setMyOnly(false);
            document.getElementById("matches")?.scrollIntoView({ behavior: "smooth" });
          }}
          onCreate={() => openCreate()}
          onMine={() =>
            requireLogin(() => {
              setActiveNav("mine");
              setMyOnly(true);
              document.getElementById("matches")?.scrollIntoView({ behavior: "smooth" });
            })
          }
          onProfile={() => {
            setActiveNav("profile");
            if (currentUser?.onboardingComplete) {
              setShowProfile(true);
            } else {
              setShowLogin(true);
            }
          }}
        />

        {/* 모달들 */}
        {showLogin && (
          <LoginSheet
            existingUser={currentUser}
            onClose={() => setShowLogin(false)}
            onLogin={(user) => {
              setCurrentUser(user);
              setShowLogin(false);
              setShowProfile(true);
              setToast("로그인 되었어요! 환영합니다.");
              void loadActivities();
            }}
          />
        )}

        {showCreate && (
          <CreateSheet
            onClose={() => setShowCreate(false)}
            onCreated={() => void loadActivities()}
            onToast={setToast}
            defaultSport={createDefaults.sport}
            defaultVenue={createDefaults.venue}
          />
        )}

        {selectedActivity && (
          <DetailSheet
            activity={selectedActivity}
            submitting={submitting}
            onClose={() => setSelectedActivity(null)}
            onPerformAction={(path, method, msg, body) => void performAction(path, method, msg, body)}
            onOpenRating={openRating}
            onReport={(a) => void reportActivity(a)}
          />
        )}

        {showProfile && currentUser?.onboardingComplete && (
          <ProfileSheet
            user={currentUser}
            onClose={() => setShowProfile(false)}
            onLogout={() => void handleLogout()}
            onToast={setToast}
          />
        )}

        {showNotifications && currentUser && (
          <NotificationSheet
            onClose={() => setShowNotifications(false)}
            onUnreadChange={setUnreadNotifications}
            onOpenNotification={handleOpenNotification}
          />
        )}

        {ratingActivityId && currentUser && (
          <RatingSheet
            activityId={ratingActivityId}
            onClose={() => setRatingActivityId(null)}
            onToast={setToast}
            onViewProfile={setViewingUserEmail}
          />
        )}

        {viewingUserEmail && (
          <UserProfileSheet
            email={viewingUserEmail}
            onClose={() => setViewingUserEmail(null)}
            onToast={setToast}
            onRelationshipChanged={() => void loadActivities()}
          />
        )}

        {toast && <div className="toast" role="status">{toast}</div>}
      </div>
    </main>
  );
}
