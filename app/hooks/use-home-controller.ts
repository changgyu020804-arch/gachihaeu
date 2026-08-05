"use client";

import { useEffect, useState } from "react";
import { Activity, Sport, Viewer } from "../activity-data";
import type { ActiveNav } from "../components/bottom-navigation";
import type { AppNotification } from "../components/notification-sheet";
import { getErrorMessage } from "../components/utils";
import { useHomeActivities } from "./use-home-activities";
import { useNotificationCount } from "./use-notification-count";
import { useSessionUser } from "./use-session-user";

export function useHomeController(initialUser: Viewer | null) {
  const session = useSessionUser(initialUser);
  const activityState = useHomeActivities(
    Boolean(session.currentUser?.onboardingComplete),
  );
  const notifications = useNotificationCount(session.currentUser);

  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeNav, setActiveNav] = useState<ActiveNav>("home");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const [ratingActivityId, setRatingActivityId] = useState<string | null>(null);
  const [viewingUserEmail, setViewingUserEmail] = useState<string | null>(null);
  const [createDefaults, setCreateDefaults] = useState<{
    sport?: Sport;
    venue?: string;
  }>({});

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const openCreate = (sport?: Sport, venue?: string) => {
    session.requireLogin(() => {
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
    if (!session.currentUser?.onboardingComplete) {
      session.setShowLogin(true);
      return;
    }
    setSubmitting(true);
    activityState.setError("");
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
      await activityState.loadActivities();
    } catch (error) {
      activityState.setError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const openRating = (activityId: string) => {
    session.requireLogin(() => setRatingActivityId(activityId));
  };

  const reportActivity = async (activity: Activity) => {
    if (!window.confirm("이 모임을 부적절한 콘텐츠로 신고할까요?")) return;
    await performAction(
      `/api/activities/${activity.id}/report`,
      "POST",
      "신고가 접수됐어요.",
      { reason: "부적절한 모임 정보" },
    );
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    session.setCurrentUser(null);
    setShowProfile(false);
    setShowNotifications(false);
    notifications.setUnreadCount(0);
    setToast("로그아웃 되었어요.");
  };

  const handleAccountDeleted = () => {
    session.setCurrentUser(null);
    setShowProfile(false);
    setShowNotifications(false);
    notifications.setUnreadCount(0);
    setActiveNav("home");
    activityState.setMyOnly(false);
    setToast("회원 탈퇴가 완료됐어요.");
  };

  const handleOpenNotification = (notification: AppNotification) => {
    setShowNotifications(false);
    if (!notification.activityId) return;
    if (notification.type === "rating") {
      setRatingActivityId(notification.activityId);
      return;
    }
    const activity = activityState.activities.find(
      (item) => item.id === notification.activityId,
    );
    if (activity) setSelectedActivity(activity);
  };

  const handleLogin = (user: Viewer) => {
    session.setCurrentUser(user);
    session.setShowLogin(false);
    setShowProfile(true);
    setToast("로그인 되었어요! 환영합니다.");
    void activityState.loadActivities();
  };

  const goHome = () => {
    setActiveNav("home");
    activityState.setMyOnly(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goMatches = () => {
    setActiveNav("matches");
    activityState.setMyOnly(false);
    document.getElementById("matches")?.scrollIntoView({ behavior: "smooth" });
  };

  const goMine = () => {
    session.requireLogin(() => {
      setActiveNav("mine");
      activityState.setMyOnly(true);
      document.getElementById("matches")?.scrollIntoView({ behavior: "smooth" });
    });
  };

  const goProfile = () => {
    setActiveNav("profile");
    if (session.currentUser?.onboardingComplete) setShowProfile(true);
    else session.setShowLogin(true);
  };

  return {
    ...session,
    ...activityState,
    unreadNotifications: notifications.unreadCount,
    setUnreadNotifications: notifications.setUnreadCount,
    selectedActivity,
    setSelectedActivity,
    showCreate,
    setShowCreate,
    showProfile,
    setShowProfile,
    showNotifications,
    setShowNotifications,
    activeNav,
    submitting,
    toast,
    setToast,
    ratingActivityId,
    setRatingActivityId,
    viewingUserEmail,
    setViewingUserEmail,
    createDefaults,
    openCreate,
    performAction,
    openRating,
    reportActivity,
    handleLogout,
    handleAccountDeleted,
    handleOpenNotification,
    handleLogin,
    goHome,
    goMatches,
    goMine,
    goProfile,
  };
}
