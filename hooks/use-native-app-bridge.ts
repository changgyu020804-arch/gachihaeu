"use client";

import { useEffect, useState } from "react";
import type { Activity } from "@/lib/types/activity";

type NativeBridgeWindow = Window & {
  ReactNativeWebView?: { postMessage: (message: string) => void };
};

type NativeActivityEvent = CustomEvent<{
  activityId?: unknown;
}>;

export function postNativeSessionState(authenticated: boolean) {
  (window as NativeBridgeWindow).ReactNativeWebView?.postMessage(
    JSON.stringify({ type: "session", authenticated }),
  );
}

export function useNativeActivityNavigation(
  activities: Activity[],
  loading: boolean,
  onOpen: (activity: Activity) => void,
  onMissing: () => void,
) {
  const [pendingActivityId, setPendingActivityId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search)
      .get("activity")
      ?.slice(0, 80) ?? null;
  });

  useEffect(() => {
    const openActivity = (event: Event) => {
      const activityId = (event as NativeActivityEvent).detail?.activityId;
      if (typeof activityId === "string" && activityId) {
        setPendingActivityId(activityId.slice(0, 80));
      }
    };
    window.addEventListener("gachihaeu:open-activity", openActivity);
    return () => window.removeEventListener("gachihaeu:open-activity", openActivity);
  }, []);

  useEffect(() => {
    if (!pendingActivityId || loading) return;
    const timer = window.setTimeout(() => {
      const activity = activities.find((item) => item.id === pendingActivityId);
      if (activity) onOpen(activity);
      else onMissing();
      setPendingActivityId(null);

      const url = new URL(window.location.href);
      url.searchParams.delete("activity");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activities, loading, onMissing, onOpen, pendingActivityId]);
}
