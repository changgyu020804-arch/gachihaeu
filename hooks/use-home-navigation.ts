"use client";

import { useCallback, useState } from "react";
import type { ActiveNav } from "@/components/layout/bottom-navigation";
import type { Sport, SportFilter, Viewer } from "@/lib/types/activity";

type HomeNavigationOptions = {
  currentUser: Viewer | null;
  requireLogin: (callback: () => void) => void;
  setShowLogin: (show: boolean) => void;
  setMyOnly: (mine: boolean) => void;
  setSelectedSport: (sport: SportFilter) => void;
};

export function useHomeNavigation({
  currentUser,
  requireLogin,
  setShowLogin,
  setMyOnly,
  setSelectedSport,
}: HomeNavigationOptions) {
  const [showCreate, setShowCreate] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeNav, setActiveNav] = useState<ActiveNav>("home");
  const [createDefaults, setCreateDefaults] = useState<{
    sport?: Sport;
    venue?: string;
  }>({});

  const openCreate = useCallback(
    (sport?: Sport, venue?: string) => {
      requireLogin(() => {
        setCreateDefaults({ sport, venue });
        setShowCreate(true);
      });
    },
    [requireLogin],
  );

  const goHome = useCallback(() => {
    setActiveNav("home");
    setMyOnly(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [setMyOnly]);

  const goMatches = useCallback(() => {
    setActiveNav("matches");
    setMyOnly(false);
    document.getElementById("matches")?.scrollIntoView({ behavior: "smooth" });
  }, [setMyOnly]);

  const goMine = useCallback(() => {
    requireLogin(() => {
      setActiveNav("mine");
      setMyOnly(true);
      document.getElementById("matches")?.scrollIntoView({ behavior: "smooth" });
    });
  }, [requireLogin, setMyOnly]);

  const goProfile = useCallback(() => {
    setActiveNav("profile");
    if (currentUser?.onboardingComplete) setShowProfile(true);
    else setShowLogin(true);
  }, [currentUser?.onboardingComplete, setShowLogin]);

  const openNotifications = useCallback(() => setShowNotifications(true), []);
  const openProfile = useCallback(() => {
    requireLogin(() => setShowProfile(true));
  }, [requireLogin]);
  const openLogin = useCallback(() => setShowLogin(true), [setShowLogin]);
  const selectVenueSport = useCallback(
    (sport: Sport) => {
      setSelectedSport(sport);
      document.getElementById("matches")?.scrollIntoView({ behavior: "smooth" });
    },
    [setSelectedSport],
  );
  const browseActivities = useCallback(() => setMyOnly(false), [setMyOnly]);

  return {
    showCreate,
    setShowCreate,
    showProfile,
    setShowProfile,
    showNotifications,
    setShowNotifications,
    activeNav,
    setActiveNav,
    createDefaults,
    openCreate,
    goHome,
    goMatches,
    goMine,
    goProfile,
    openNotifications,
    openProfile,
    openLogin,
    selectVenueSport,
    browseActivities,
  };
}
