import { Activity, ActivitySummary } from "@/lib/types/activity";

const CACHE_VERSION = 1;
const CACHE_TTL_MS = 6 * 60 * 60_000;
const CACHE_PREFIX = "gachihaeu:activities:v1:";

export type CachedActivities = {
  activities: Activity[];
  nextCursor: string | null;
  summary: ActivitySummary;
};

type StoredActivities = CachedActivities & {
  version: number;
  savedAt: number;
};

function cacheKey(email: string) {
  return `${CACHE_PREFIX}${encodeURIComponent(email.trim().toLowerCase())}`;
}

function isSummary(value: unknown): value is ActivitySummary {
  if (!value || typeof value !== "object") return false;
  const summary = value as Partial<ActivitySummary>;
  return (
    typeof summary.open === "number" &&
    typeof summary.people === "number" &&
    typeof summary.remaining === "number" &&
    Boolean(summary.venueCounts) &&
    typeof summary.venueCounts === "object"
  );
}

export function readActivityCache(email: string): CachedActivities | null {
  if (typeof window === "undefined" || !email) return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(email));
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<StoredActivities>;
    if (
      stored.version !== CACHE_VERSION ||
      typeof stored.savedAt !== "number" ||
      Date.now() - stored.savedAt > CACHE_TTL_MS ||
      !Array.isArray(stored.activities) ||
      !stored.activities.every(
        (activity) =>
          activity &&
          typeof activity === "object" &&
          typeof (activity as Activity).id === "string",
      ) ||
      !isSummary(stored.summary)
    ) {
      window.localStorage.removeItem(cacheKey(email));
      return null;
    }
    return {
      activities: stored.activities.slice(0, 20) as Activity[],
      nextCursor:
        typeof stored.nextCursor === "string" ? stored.nextCursor : null,
      summary: stored.summary,
    };
  } catch {
    return null;
  }
}

export function writeActivityCache(
  email: string,
  value: CachedActivities,
) {
  if (typeof window === "undefined" || !email) return;
  try {
    const stored: StoredActivities = {
      version: CACHE_VERSION,
      savedAt: Date.now(),
      activities: value.activities.slice(0, 20),
      nextCursor: value.nextCursor,
      summary: value.summary,
    };
    window.localStorage.setItem(cacheKey(email), JSON.stringify(stored));
  } catch {
    // A full or unavailable cache must never block the live activity list.
  }
}

export function clearActivityCache(email: string | null | undefined) {
  if (typeof window === "undefined" || !email) return;
  window.localStorage.removeItem(cacheKey(email));
}
