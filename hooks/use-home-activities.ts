"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, SportFilter } from "@/lib/types/activity";
import {
  createDateFilters,
  getErrorMessage,
  localDateKey,
} from "@/lib/utils/ui";

export function useHomeActivities(canLoad: boolean) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedSport, setSelectedSport] = useState<SportFilter>("전체");
  const [selectedDate, setSelectedDate] = useState("전체");
  const [myOnly, setMyOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadActivities = useCallback(async (signal?: AbortSignal) => {
    if (!canLoad) {
      setActivities([]);
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/activities", {
        cache: "no-store",
        signal,
      });
      const payload = (await response.json()) as {
        activities?: Activity[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "모임을 불러오지 못했어요.");
      }
      setActivities(payload.activities ?? []);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") {
        return;
      }
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [canLoad]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(
      () => void loadActivities(controller.signal),
      0,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadActivities]);

  const visibleActivities = useMemo(
    () =>
      activities.filter((activity) => {
        const sportMatches =
          selectedSport === "전체" || activity.sport === selectedSport;
        const dateMatches =
          selectedDate === "전체" ||
          localDateKey(new Date(activity.startsAt)) === selectedDate;
        const ownerMatches =
          !myOnly ||
          activity.isOwner ||
          activity.isJoined ||
          activity.isWaitlisted;
        return sportMatches && dateMatches && ownerMatches;
      }),
    [activities, myOnly, selectedDate, selectedSport],
  );

  const stats = useMemo(
    () => ({
      open: activities.length,
      people: activities.reduce(
        (sum, activity) => sum + activity.participantCount,
        0,
      ),
      remaining: activities.reduce(
        (sum, activity) =>
          sum + Math.max(0, activity.capacity - activity.participantCount),
        0,
      ),
    }),
    [activities],
  );
  const dateFilters = useMemo(() => createDateFilters(), []);

  return {
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
  };
}
