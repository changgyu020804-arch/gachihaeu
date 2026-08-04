import { getSessionUser } from "../../auth";
import { LEVELS, SPORTS, VENUES } from "../../activity-data";
import { getUserDisplayName } from "../../activity-policy";
import { enforceRateLimit, getClientIp } from "../../security";
import { ensureSchema, getD1 } from "../../../db";

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

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  try {
    await ensureSchema();
    const email = user.email;
    const now = new Date().toISOString();
    const upcomingCutoff = new Date(Date.now() - 30 * 60_000).toISOString();
    const historyCutoff = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
    const result = await getD1()
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
          (SELECT COUNT(*) FROM waitlist w WHERE w.activity_id = a.id AND w.status = 'waiting') AS waitlist_count,
          CASE WHEN EXISTS (
            SELECT 1 FROM waitlist mw
            WHERE mw.activity_id = a.id AND mw.user_email = ? AND mw.status = 'waiting'
          ) THEN 1 ELSE 0 END AS is_waitlisted,
          (SELECT position FROM waitlist mw2
           WHERE mw2.activity_id = a.id AND mw2.user_email = ? AND mw2.status = 'waiting') AS waitlist_position
        FROM activities a
        LEFT JOIN participants p ON p.activity_id = a.id
        WHERE a.status = 'open'
          AND (
            a.starts_at >= ?
            OR (
              a.starts_at >= ?
              AND EXISTS (
                SELECT 1 FROM participants history
                WHERE history.activity_id = a.id AND history.user_email = ?
              )
            )
          )
          AND NOT EXISTS (
            SELECT 1 FROM user_blocks ub
            WHERE
              (ub.blocker_email = ? AND ub.blocked_email = a.creator_email)
              OR
              (ub.blocker_email = a.creator_email AND ub.blocked_email = ?)
          )
        GROUP BY a.id
        ORDER BY
          CASE WHEN a.starts_at >= ? THEN 0 ELSE 1 END,
          CASE WHEN a.starts_at >= ? THEN a.starts_at END ASC,
          CASE WHEN a.starts_at < ? THEN a.starts_at END DESC
        LIMIT 100`,
      )
      .bind(
        email,
        email,
        email,
        email,
        upcomingCutoff,
        historyCutoff,
        email,
        email,
        email,
        now,
        now,
        now,
      )
      .all<ActivityRow>();

    const activities = result.results.map((row: ActivityRow) => ({
      id: row.id,
      sport: row.sport,
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
      cancellationDeadlineMinutes: Number(row.cancellation_deadline_minutes ?? 60),
    }));

    return Response.json({ activities });
  } catch {
    console.error("Activity list request failed");
    return Response.json(
      { error: "모임을 불러오지 못했어요. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  try {
    await ensureSchema();
    const payload = (await request.json()) as Record<string, unknown>;
    const sport = cleanString(payload.sport, 20);
    const title = cleanString(payload.title, 50);
    const venue = cleanString(payload.venue, 80);
    const level = cleanString(payload.level, 30);
    const description = cleanString(payload.description, 280);
    const startsAt = cleanString(payload.startsAt, 40);
    const durationMinutes = Number(payload.durationMinutes);
    const capacity = Number(payload.capacity);
    const facilityReserved = Boolean(payload.facilityReserved);
    const cancellationDeadlineMinutes = Number(payload.cancellationDeadlineMinutes);
    const startDate = new Date(startsAt);

    if (!SPORTS.includes(sport as never) || sport === "전체") {
      return Response.json({ error: "올바른 운동 종목을 선택해 주세요." }, { status: 400 });
    }
    if (title.length < 2) {
      return Response.json({ error: "모임 제목을 두 글자 이상 입력해 주세요." }, { status: 400 });
    }
    if (!VENUES.includes(venue as never)) {
      return Response.json({ error: "교내 장소를 선택해 주세요." }, { status: 400 });
    }
    if (!LEVELS.includes(level as never)) {
      return Response.json({ error: "난이도를 선택해 주세요." }, { status: 400 });
    }
    if (!Number.isFinite(startDate.getTime())) {
      return Response.json({ error: "날짜와 시간을 확인해 주세요." }, { status: 400 });
    }
    if (startDate.getTime() < Date.now() + 10 * 60_000) {
      return Response.json({ error: "모임은 현재보다 10분 이후로 설정해 주세요." }, { status: 400 });
    }
    if (startDate.getTime() > Date.now() + 60 * 24 * 60 * 60_000) {
      return Response.json({ error: "모임은 60일 이내로 만들어 주세요." }, { status: 400 });
    }
    if (!Number.isInteger(capacity) || capacity < 2 || capacity > 30) {
      return Response.json({ error: "모집 인원은 2명에서 30명 사이여야 해요." }, { status: 400 });
    }
    if (![60, 90, 120].includes(durationMinutes)) {
      return Response.json({ error: "진행 시간을 확인해 주세요." }, { status: 400 });
    }
    if (![0, 60, 180, 1440].includes(cancellationDeadlineMinutes)) {
      return Response.json({ error: "참가 취소 마감 시간을 확인해 주세요." }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const displayName = getUserDisplayName(user);
    const db = getD1();
    const rateError = await enforceRateLimit(db, {
      action: "activity-create",
      identifiers: [`user:${user.email}`, `ip:${getClientIp(request)}`],
      maximum: 20,
      windowSeconds: 60 * 60,
    });
    if (rateError) return rateError;

    await db.batch([
      db
        .prepare(
          `INSERT INTO activities (
            id, creator_email, creator_name, sport, title, venue, starts_at,
            duration_minutes, capacity, level, description, status, facility_reserved,
            cancellation_deadline_minutes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
        )
        .bind(
          id,
          user.email,
          displayName,
          sport,
          title,
          venue,
          startDate.toISOString(),
          durationMinutes,
          capacity,
          level,
          description,
          facilityReserved ? 1 : 0,
          cancellationDeadlineMinutes,
        ),
      db
        .prepare(
          `INSERT INTO participants (activity_id, user_email, display_name)
           VALUES (?, ?, ?)`,
        )
        .bind(id, user.email, displayName),
    ]);

    return Response.json({ id }, { status: 201 });
  } catch {
    console.error("Activity creation failed");
    return Response.json(
      { error: "모임을 만들지 못했어요. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}
