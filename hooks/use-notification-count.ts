"use client";

import { useCallback, useEffect, useState } from "react";
import { Viewer } from "@/lib/types/activity";

export function useNotificationCount(currentUser: Viewer | null) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!currentUser) {
      setUnreadCount(0);
      return;
    }
    try {
      const response = await fetch("/api/notifications", {
        cache: "no-store",
        signal,
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { unreadCount?: number };
      setUnreadCount(payload.unreadCount ?? 0);
    } catch {
      // 알림 실패가 모임 탐색을 방해하지 않도록 다음 주기에 재시도한다.
    }
  }, [currentUser]);

  useEffect(() => {
    const controller = new AbortController();
    const initialTimer = window.setTimeout(
      () => void refresh(controller.signal),
      1_500,
    );
    if (!currentUser) {
      return () => {
        window.clearTimeout(initialTimer);
        controller.abort();
      };
    }

    const interval = window.setInterval(
      () => void refresh(controller.signal),
      60_000,
    );
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void refresh(controller.signal);
      }
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      controller.abort();
    };
  }, [currentUser, refresh]);

  return { unreadCount, setUnreadCount };
}
