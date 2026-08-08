"use client";

import { useCallback, useEffect, useState } from "react";
import { Viewer } from "@/lib/types/activity";

export function useSessionUser(initialUser: Viewer | null) {
  const [currentUser, setCurrentUser] = useState<Viewer | null>(initialUser);
  const [showLogin, setShowLogin] = useState(
    !initialUser || !initialUser.onboardingComplete,
  );

  useEffect(() => {
    if (!initialUser) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { user?: Viewer | null };
        setCurrentUser(payload.user ?? null);
        if (payload.user && !payload.user.onboardingComplete) {
          setShowLogin(true);
        }
      } catch {
        // 다음 방문 때 안전하게 다시 갱신한다.
      }
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [initialUser]);

  const requireLogin = useCallback(
    (callback: () => void) => {
      if (!currentUser?.onboardingComplete) {
        setShowLogin(true);
        return;
      }
      callback();
    },
    [currentUser],
  );

  return {
    currentUser,
    setCurrentUser,
    showLogin,
    setShowLogin,
    requireLogin,
  };
}
