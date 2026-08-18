import { Activity, ActivitySummary } from "@/lib/types/activity";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 20;

type ActivityRow = {
  id: string;
  creator_email: string;
  creator_name: string;
  sport: string;
  title: string;
  venue: string;
  starts_at: string;
  duration_minutes: number;
  capacity: number;
  level: string;
  description: string;
  notice: string;
  notice_updated_at: string | null;
  participant_count: number;
  is_joined: number;
  is_owner: number;
  waitlist_count: number;
  is_waitlisted: number;
  waitlist_position: number | null;
  facility_reserved: number;
  cancellation_deadline_minutes: number;
};

type ActivityCursor = {
  referenceMs: number;
  group: 0 | 1;
  startsAt: string;
  id: string;
};

export type ActivityListOptions = {
  limit?: number;
  cursor?: string | null;
  sport?: string | null;
  dateKey?: string | null;
  myOnly?: boolean;
  nowMs?: number;
};

export type ActivityPage = {
  activities: Activity[];
  nextCursor: string | null;
};

function toActivity(row: ActivityRow): Activity {
  return {
    id: row.id,
    sport: row.sport as Activity["sport"],
    title: row.title,
    venue: row.venue,
    startsAt: row.starts_at,
    durationMinutes: row.duration_minutes,
    capacity: row.capacity,
    level: row.level,
    description: row.description,
    notice: row.notice,
    noticeUpdatedAt: row.notice_updated_at,
    creatorName: row.creator_name,
    participantCount: Number(row.participant_count),
    isJoined: Boolean(row.is_joined),
    isOwner: Boolean(row.is_owner),
    waitlistCount: Number(row.waitlist_count),
    isWaitlisted: Boolean(row.is_waitlisted),
    waitlistPosition: row.waitlist_position ?? null,
    facilityReserved: Boolean(row.facility_reserved),
    cancellationDeadlineMinutes: Number(
      row.cancellation_deadline_minutes ?? 60,
    ),
  };
}

function readCursor(value: string | null | undefined): ActivityCursor | null {
  if (!value) return null;
  const [referenceText, groupText, startsText, id] = value.split(".");
  const referenceMs = Number(referenceText);
  const startsMs = Number(startsText);
  const group = Number(groupText);
  if (
    !Number.isFinite(referenceMs) ||
    !Number.isFinite(startsMs) ||
    (group !== 0 && group !== 1) ||
    !/^[A-Za-z0-9-]{1,80}$/.test(id ?? "")
  ) {
    return null;
  }
  return {
    referenceMs,
    group,
    startsAt: new Date(startsMs).toISOString(),
    id,
  };
}

function createCursor(row: ActivityRow, referenceMs: number) {
  const startsMs = new Date(row.starts_at).getTime();
  const group = startsMs >= referenceMs ? 0 : 1;
  return `${referenceMs}.${group}.${startsMs}.${row.id}`;
}

function getDateRange(dateKey: string | null | undefined) {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const startsAt = new Date(`${dateKey}T00:00:00+09:00`);
  if (!Number.isFinite(startsAt.getTime())) return null;
  return {
    startsAt: startsAt.toISOString(),
    endsAt: new Date(startsAt.getTime() + 24 * 60 * 60_000).toISOString(),
  };
}

function prepareActivityPage(
  db: D1Database,
  email: string,
  options: ActivityListOptions = {},
) {
  const cursor = readCursor(options.cursor);
  const referenceMs = cursor?.referenceMs ?? options.nowMs ?? Date.now();
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(options.limit ?? DEFAULT_PAGE_SIZE)),
  );
  const now = new Date(referenceMs).toISOString();
  const upcomingCutoff = new Date(referenceMs - 30 * 60_000).toISOString();
  const historyCutoff = new Date(
    referenceMs - 30 * 24 * 60 * 60_000,
  ).toISOString();
  const conditions = [
    "a.status = 'open'",
    `(
      a.starts_at >= ?
      OR (
        a.starts_at >= ?
        AND EXISTS (
          SELECT 1 FROM participants history
          WHERE history.activity_id = a.id AND history.user_email = ?
        )
      )
    )`,
    `NOT EXISTS (
      SELECT 1 FROM user_blocks ub
      WHERE
        (ub.blocker_email = ? AND ub.blocked_email = a.creator_email)
        OR
        (ub.blocker_email = a.creator_email AND ub.blocked_email = ?)
    )`,
  ];
  const bindings: Array<string | number> = [
    upcomingCutoff,
    historyCutoff,
    email,
    email,
    email,
  ];

  if (options.sport) {
    conditions.push("a.sport = ?");
    bindings.push(options.sport);
  }

  const dateRange = getDateRange(options.dateKey);
  if (dateRange) {
    conditions.push("a.starts_at >= ? AND a.starts_at < ?");
    bindings.push(dateRange.startsAt, dateRange.endsAt);
  }

  if (options.myOnly) {
    conditions.push(`(
      a.creator_email = ?
      OR EXISTS (
        SELECT 1 FROM participants mine_filter
        WHERE mine_filter.activity_id = a.id AND mine_filter.user_email = ?
      )
      OR EXISTS (
        SELECT 1 FROM waitlist wait_filter
        WHERE wait_filter.activity_id = a.id
          AND wait_filter.user_email = ?
          AND wait_filter.status = 'waiting'
      )
    )`);
    bindings.push(email, email, email);
  }

  if (cursor) {
    conditions.push(`(
      (CASE WHEN a.starts_at >= ? THEN 0 ELSE 1 END) > ?
      OR (
        (CASE WHEN a.starts_at >= ? THEN 0 ELSE 1 END) = ?
        AND (
          (? = 0 AND (
            a.starts_at > ? OR (a.starts_at = ? AND a.id > ?)
          ))
          OR
          (? = 1 AND (
            a.starts_at < ? OR (a.starts_at = ? AND a.id > ?)
          ))
        )
      )
    )`);
    bindings.push(
      now,
      cursor.group,
      now,
      cursor.group,
      cursor.group,
      cursor.startsAt,
      cursor.startsAt,
      cursor.id,
      cursor.group,
      cursor.startsAt,
      cursor.startsAt,
      cursor.id,
    );
  }

  const queryBindings: Array<string | number> = [
    email,
    email,
    email,
    email,
    ...bindings,
    now,
    now,
    now,
  ];
  const statement = db
    .prepare(
      `SELECT
        a.id,
        a.creator_email,
        a.creator_name,
        a.sport,
        a.title,
        a.venue,
        a.starts_at,
        a.duration_minutes,
        a.capacity,
        a.level,
        a.description,
        a.notice,
        a.notice_updated_at,
        a.facility_reserved,
        a.cancellation_deadline_minutes,
        COUNT(p.user_email) AS participant_count,
        CASE WHEN EXISTS (
          SELECT 1 FROM participants mine
          WHERE mine.activity_id = a.id AND mine.user_email = ?
        ) THEN 1 ELSE 0 END AS is_joined,
        CASE WHEN a.creator_email = ? THEN 1 ELSE 0 END AS is_owner,
        (SELECT COUNT(*) FROM waitlist w
         WHERE w.activity_id = a.id AND w.status = 'waiting') AS waitlist_count,
        CASE WHEN EXISTS (
          SELECT 1 FROM waitlist mw
          WHERE mw.activity_id = a.id
            AND mw.user_email = ?
            AND mw.status = 'waiting'
        ) THEN 1 ELSE 0 END AS is_waitlisted,
        (SELECT position FROM waitlist mw2
         WHERE mw2.activity_id = a.id
           AND mw2.user_email = ?
           AND mw2.status = 'waiting') AS waitlist_position
      FROM activities a
      LEFT JOIN participants p ON p.activity_id = a.id
      WHERE ${conditions.join("\nAND ")}
      GROUP BY a.id
      ORDER BY
        CASE WHEN a.starts_at >= ? THEN 0 ELSE 1 END,
        CASE WHEN a.starts_at >= ? THEN a.starts_at END ASC,
        CASE WHEN a.starts_at < ? THEN a.starts_at END DESC,
        a.id ASC
      LIMIT ${limit + 1}`,
    )
    .bind(...queryBindings);

  return { statement, limit, referenceMs };
}

function toActivityPage(
  result: D1Result<ActivityRow>,
  limit: number,
  referenceMs: number,
): ActivityPage {
  const hasMore = result.results.length > limit;
  const rows = hasMore ? result.results.slice(0, limit) : result.results;
  return {
    activities: rows.map(toActivity),
    nextCursor:
      hasMore && rows.length > 0
        ? createCursor(rows[rows.length - 1], referenceMs)
        : null,
  };
}

export async function listActivityPage(
  db: D1Database,
  email: string,
  options: ActivityListOptions = {},
): Promise<ActivityPage> {
  const prepared = prepareActivityPage(db, email, options);
  const result = await prepared.statement.all<ActivityRow>();
  return toActivityPage(result, prepared.limit, prepared.referenceMs);
}

type ActivitySummaryRow = {
  venue: string;
  activity_count: number;
  participant_count: number;
  remaining_count: number;
};

function prepareActivitySummary(
  db: D1Database,
  email: string,
  nowMs = Date.now(),
) {
  const upcomingCutoff = new Date(nowMs - 30 * 60_000).toISOString();
  return db
    .prepare(
      `SELECT
         visible.venue,
         COUNT(*) AS activity_count,
         SUM(visible.participant_count) AS participant_count,
         SUM(MAX(visible.capacity - visible.participant_count, 0)) AS remaining_count
       FROM (
         SELECT
           a.id,
           a.venue,
           a.capacity,
           COUNT(p.user_email) AS participant_count
         FROM activities a
         LEFT JOIN participants p ON p.activity_id = a.id
         WHERE a.status = 'open'
           AND a.starts_at >= ?
           AND NOT EXISTS (
             SELECT 1 FROM user_blocks ub
             WHERE
               (ub.blocker_email = ? AND ub.blocked_email = a.creator_email)
               OR
               (ub.blocker_email = a.creator_email AND ub.blocked_email = ?)
           )
         GROUP BY a.id
       ) visible
       GROUP BY visible.venue`,
    )
    .bind(upcomingCutoff, email, email);
}

function toActivitySummary(
  result: D1Result<ActivitySummaryRow>,
): ActivitySummary {
  return result.results.reduce<ActivitySummary>(
    (summary, row) => {
      const activityCount = Number(row.activity_count);
      summary.open += activityCount;
      summary.people += Number(row.participant_count);
      summary.remaining += Number(row.remaining_count);
      summary.venueCounts[row.venue] = activityCount;
      return summary;
    },
    { open: 0, people: 0, remaining: 0, venueCounts: {} },
  );
}

export async function getActivitySummary(
  db: D1Database,
  email: string,
  nowMs = Date.now(),
): Promise<ActivitySummary> {
  const result = await prepareActivitySummary(db, email, nowMs).all<ActivitySummaryRow>();
  return toActivitySummary(result);
}

export async function getActivityHomeData(
  db: D1Database,
  email: string,
  options: ActivityListOptions = {},
) {
  const nowMs = options.nowMs ?? Date.now();
  const pageQuery = prepareActivityPage(db, email, { ...options, nowMs });
  const summaryQuery = prepareActivitySummary(db, email, nowMs);
  const [pageResult, summaryResult] = await db.batch([
    pageQuery.statement,
    summaryQuery,
  ]);

  return {
    page: toActivityPage(
      pageResult as D1Result<ActivityRow>,
      pageQuery.limit,
      pageQuery.referenceMs,
    ),
    summary: toActivitySummary(summaryResult as D1Result<ActivitySummaryRow>),
  };
}
