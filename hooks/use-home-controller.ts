"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, ActivitySummary, Viewer } from "@/lib/types/activity";
import { clearActivityCache } from "@/lib/client/activity-cache";
import type { AppNotification } from "@/components/notifications/notification-sheet";
import { getErrorMessage } from "@/lib/utils/ui";
import { useHomeActivities } from "@/hooks/use-home-activities";
import {
  postNativeSessionState,
  useNativeActivityNavigation,
} from "@/hooks/use-native-app-bridge";
import { useNotificationCount } from "@/hooks/use-notification-count";
import { useSessionUser } from "@/hooks/use-session-user";
import { useHomeNavigation } from "@/hooks/use-home-navigation";

type HomeControllerOptions = {
  initialUser: Viewer | null;
  initialActivities: Activity[];
  initialNextCursor: string | null;
  initialSummary: ActivitySummary;
};

export function useHomeController({
  initialUser,
  initialActivities,
  initialNextCursor,
  initialSummary,
}: HomeControllerOptions) {
  const session = useSessionUser(initialUser);
  const {
    currentUser,
    setCurrentUser,
    setShowLogin,
    requireLogin,
  } = session;
  const activityState = useHomeActivities({
    canLoad: Boolean(currentUser?.onboardingComplete),
    userEmail: currentUser?.email ?? null,
    initialActivities,
    initialNextCursor,
    initialSummary,
  });
  const {
    activities,
    loading,
    loadActivities,
    setError,
    setMyOnly,
    setSelectedSport,
  } = activityState;
  const notifications = useNotificationCount(currentUser);
  const { unreadCount, setUnreadCount } = notifications;

  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const [ratingActivityId, setRatingActivityId] = useState<string | null>(null);
  const [viewingUserEmail, setViewingUserEmail] = useState<string | null>(null);
  const navigation = useHomeNavigation({
    currentUser,
    requireLogin,
    setShowLogin,
    setMyOnly,
    setSelectedSport,
  });
  const {
    setShowProfile,
    setShowNotifications,
    setActiveNav,
  } = navigation;

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    postNativeSessionState(Boolean(currentUser?.onboardingComplete));
  }, [currentUser?.onboardingComplete]);

  const handleMissingNativeActivity = useCallback(() => {
    setToast("알림에 연결된 모임을 찾지 못했어요.");
  }, []);

  useNativeActivityNavigation(
    activities,
    loading,
    setSelectedActivity,
    handleMissingNativeActivity,
  );

  const performAction = useCallback(
    async (
      path: string,
      method: "POST" | "PATCH" | "DELETE",
      successMessage: string,
      body?: unknown,
    ) => {
      if (!currentUser?.onboardingComplete) {
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
        if (!response.ok) {
          throw new Error(payload.error || "요청을 처리하지 못했어요.");
        }
        setToast(successMessage);
        setSelectedActivity(null);
        await loadActivities();
      } catch (error) {
        setError(getErrorMessage(error));
      } finally {
        setSubmitting(false);
      }
    },
    [
      currentUser?.onboardingComplete,
      loadActivities,
      setError,
      setShowLogin,
    ],
  );

  const openRating = useCallback(
    (activityId: string) => {
      requireLogin(() => setRatingActivityId(activityId));
    },
    [requireLogin],
  );

  const reportActivity = useCallback(
    async (activity: Activity) => {
      if (!window.confirm("이 모임을 부적절한 콘텐츠로 신고할까요?")) return;
      await performAction(
        `/api/activities/${activity.id}/report`,
        "POST",
        "신고가 접수됐어요.",
        { reason: "부적절한 모임 정보" },
      );
    },
    [performAction],
  );

  const handleLogout = useCallback(async () => {
    const currentEmail = currentUser?.email;
    const pushToken = window.localStorage.getItem("gachihaeu:push-token");
    if (pushToken) {
      await fetch("/api/push-tokens", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: pushToken }),
      }).catch(() => undefined);
      window.localStorage.removeItem("gachihaeu:push-token");
    }
    await fetch("/api/auth/logout", { method: "POST" });
    clearActivityCache(currentEmail);
    setCurrentUser(null);
    setShowProfile(false);
    setShowNotifications(false);
    setUnreadCount(0);
    setToast("로그아웃 되었어요.");
  }, [currentUser?.email, setCurrentUser, setShowNotifications, setShowProfile, setUnreadCount]);

  const handleAccountDeleted = useCallback(() => {
    clearActivityCache(currentUser?.email);
    setCurrentUser(null);
    setShowProfile(false);
    setShowNotifications(false);
    setUnreadCount(0);
    setActiveNav("home");
    setMyOnly(false);
    setToast("회원 탈퇴가 완료됐어요.");
  }, [
    currentUser?.email, setActiveNav, setCurrentUser, setMyOnly,
    setShowNotifications, setShowProfile, setUnreadCount,
  ]);

  const handleOpenNotification = useCallback((notification: AppNotification) => {
    setShowNotifications(false);
    if (!notification.activityId) return;
    if (notification.type === "rating") {
      setRatingActivityId(notification.activityId);
      return;
    }
    const activity = activities.find(
      (item) => item.id === notification.activityId,
    );
    if (activity) setSelectedActivity(activity);
  }, [activities, setShowNotifications]);

  const handleLogin = useCallback((user: Viewer) => {
    setCurrentUser(user);
    setShowLogin(false);
    setShowProfile(true);
    setToast("로그인 되었어요! 환영합니다.");
  }, [setCurrentUser, setShowLogin, setShowProfile]);

  return {
    ...session,
    ...activityState,
    ...navigation,
    unreadNotifications: unreadCount,
    setUnreadNotifications: setUnreadCount,
    selectedActivity,
    setSelectedActivity,
    submitting,
    toast,
    setToast,
    ratingActivityId,
    setRatingActivityId,
    viewingUserEmail,
    setViewingUserEmail,
    performAction,
    openRating,
    reportActivity,
    handleLogout,
    handleAccountDeleted,
    handleOpenNotification,
    handleLogin,
  };
}
