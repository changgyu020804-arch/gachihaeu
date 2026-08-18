"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ActivitySummary,
  SportFilter,
} from "@/lib/types/activity";
import {
  readActivityCache,
  writeActivityCache,
} from "@/lib/client/activity-cache";
import { createDateFilters, getErrorMessage } from "@/lib/utils/ui";

type UseHomeActivitiesOptions = {
  canLoad: boolean;
  userEmail: string | null;
  initialActivities: Activity[];
  initialNextCursor: string | null;
  initialSummary: ActivitySummary;
};

type ActivityPayload = {
  activities?: Activity[];
  nextCursor?: string | null;
  summary?: ActivitySummary;
  error?: string;
};

const EMPTY_SUMMARY: ActivitySummary = {
  open: 0,
  people: 0,
  remaining: 0,
  venueCounts: {},
};

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export function useHomeActivities({
  canLoad,
  userEmail,
  initialActivities,
  initialNextCursor,
  initialSummary,
}: UseHomeActivitiesOptions) {
  const [activities, setActivities] = useState<Activity[]>(initialActivities);
  const [summary, setSummary] = useState<ActivitySummary>(initialSummary);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [selectedSport, setSelectedSport] = useState<SportFilter>("전체");
  const [selectedDate, setSelectedDate] = useState("전체");
  const [myOnly, setMyOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const firstLoadRef = useRef(true);
  const initialEmailRef = useRef(userEmail);
  const summaryRef = useRef(initialSummary);

  const isDefaultFilter =
    selectedSport === "전체" && selectedDate === "전체" && !myOnly;

  const createRequestUrl = useCallback(
    (cursor: string | null, includeSummary: boolean) => {
      const params = new URLSearchParams();
      if (selectedSport !== "전체") params.set("sport", selectedSport);
      if (selectedDate !== "전체") params.set("date", selectedDate);
      if (myOnly) params.set("mine", "1");
      if (cursor) params.set("cursor", cursor);
      if (includeSummary) params.set("summary", "1");
      const query = params.toString();
      return `/api/activities${query ? `?${query}` : ""}`;
    },
    [myOnly, selectedDate, selectedSport],
  );

  const loadActivities = useCallback(
    async (signal?: AbortSignal, background = false) => {
      if (!canLoad || !userEmail) {
        setActivities([]);
        setNextCursor(null);
        setSummary(EMPTY_SUMMARY);
        summaryRef.current = EMPTY_SUMMARY;
        setLoading(false);
        setError("");
        return;
      }
      if (!background) setLoading(true);
      setError("");
      try {
        const response = await fetch(createRequestUrl(null, true), {
          cache: "no-store",
          signal,
        });
        const payload = (await response.json()) as ActivityPayload;
        if (!response.ok) {
          throw new Error(payload.error || "모임을 불러오지 못했어요.");
        }
        const nextActivities = payload.activities ?? [];
        const nextSummary = payload.summary ?? summaryRef.current;
        setActivities(nextActivities);
        setNextCursor(payload.nextCursor ?? null);
        setSummary(nextSummary);
        summaryRef.current = nextSummary;
        if (isDefaultFilter) {
          writeActivityCache(userEmail, {
            activities: nextActivities,
            nextCursor: payload.nextCursor ?? null,
            summary: nextSummary,
          });
        }
      } catch (loadError) {
        if (!isAbortError(loadError)) setError(getErrorMessage(loadError));
      } finally {
        if (!background) setLoading(false);
      }
    },
    [canLoad, createRequestUrl, isDefaultFilter, userEmail],
  );

  useEffect(() => {
    if (!canLoad || !userEmail) {
      firstLoadRef.current = false;
      const resetTimer = window.setTimeout(() => {
        setActivities([]);
        setNextCursor(null);
        setSummary(EMPTY_SUMMARY);
        summaryRef.current = EMPTY_SUMMARY;
        setLoading(false);
        setError("");
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }

    let background = false;
    let cached: ReturnType<typeof readActivityCache> = null;
    if (isDefaultFilter) {
      const isInitialServerPage =
        firstLoadRef.current &&
        initialEmailRef.current === userEmail;
      if (isInitialServerPage) {
        writeActivityCache(userEmail, {
          activities: initialActivities,
          nextCursor: initialNextCursor,
          summary: initialSummary,
        });
        firstLoadRef.current = false;
        return;
      } else {
        cached = readActivityCache(userEmail);
        background = Boolean(cached);
      }
    }

    firstLoadRef.current = false;
    const controller = new AbortController();
    const cacheTimer = cached
      ? window.setTimeout(() => {
          if (!cached) return;
          setActivities(cached.activities);
          setNextCursor(cached.nextCursor);
          setSummary(cached.summary);
          summaryRef.current = cached.summary;
          setLoading(false);
        }, 0)
      : null;
    const timer = window.setTimeout(
      () => void loadActivities(controller.signal, background),
      background ? 700 : 0,
    );
    return () => {
      if (cacheTimer !== null) window.clearTimeout(cacheTimer);
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    canLoad,
    initialActivities,
    initialNextCursor,
    initialSummary,
    isDefaultFilter,
    loadActivities,
    userEmail,
  ]);

  const loadMore = useCallback(async () => {
    if (!canLoad || !userEmail || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const response = await fetch(createRequestUrl(nextCursor, false), {
        cache: "no-store",
      });
      const payload = (await response.json()) as ActivityPayload;
      if (!response.ok) {
        throw new Error(payload.error || "추가 모임을 불러오지 못했어요.");
      }
      setActivities((current) => {
        const knownIds = new Set(current.map((activity) => activity.id));
        return [
          ...current,
          ...(payload.activities ?? []).filter(
            (activity) => !knownIds.has(activity.id),
          ),
        ];
      });
      setNextCursor(payload.nextCursor ?? null);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoadingMore(false);
    }
  }, [
    canLoad,
    createRequestUrl,
    loadingMore,
    nextCursor,
    userEmail,
  ]);

  const dateFilters = useMemo(() => createDateFilters(), []);

  return {
    activities,
    visibleActivities: activities,
    stats: summary,
    venueCounts: summary.venueCounts,
    dateFilters,
    selectedSport,
    setSelectedSport,
    selectedDate,
    setSelectedDate,
    myOnly,
    setMyOnly,
    loading,
    loadingMore,
    hasMore: Boolean(nextCursor),
    error,
    setError,
    loadActivities: () => loadActivities(),
    loadMore,
  };
}
