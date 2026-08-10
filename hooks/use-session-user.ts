"use client";

import { useCallback, useState } from "react";
import { Viewer } from "@/lib/types/activity";

export function useSessionUser(initialUser: Viewer | null) {
  const [currentUser, setCurrentUser] = useState<Viewer | null>(initialUser);
  const [showLogin, setShowLogin] = useState(
    !initialUser || !initialUser.onboardingComplete,
  );

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
