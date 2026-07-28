import { getSessionUser } from "../../auth";
import { LEVELS, SPORTS, VENUES } from "../../activity-data";
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
  participant_count: number;
  is_joined: number;
  is_owner: number;
  waitlist_count: number;
  is_waitlisted: number;
  waitlist_position: number | null;
  facility_reserved: number;
};

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function userDisplayName(user: { fullName: string | null; email: string }) {
  return user.fullName?.trim() || user.email.split("@")[0];
}

export async function GET() {
  try {
    await ensureSchema();
    const user = await getSessionUser();
    const email = user?.email ?? "";
    const now = new Date(Date.now() - 30 * 60_000).toISOString();
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
          a.facility_reserved,
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
        WHERE a.status = 'open' AND a.starts_at >= ?
        GROUP BY a.id
        ORDER BY a.starts_at ASC
        LIMIT 100`,
      )
      .bind(email, email, email, email, now)
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
      creatorName: row.creator_name,
      participantCount: Number(row.participant_count),
      isJoined: Boolean(row.is_joined),
      isOwner: Boolean(row.is_owner),
      waitlistCount: Number(row.waitlist_count),
      isWaitlisted: Boolean(row.is_waitlisted),
      waitlistPosition: row.waitlist_position ?? null,
      facilityReserved: Boolean(row.facility_reserved),
    }));

    return Response.json({ activities });
  } catch (error) {
    const message = error instanceof Error ? error.message : "모임을 불러오지 못했어요.";
    return Response.json({ error: message }, { status: 500 });
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

    const id = crypto.randomUUID();
    const displayName = userDisplayName(user);
    const db = getD1();
    await db.batch([
      db
        .prepare(
          `INSERT INTO activities (
            id, creator_email, creator_name, sport, title, venue, starts_at,
            duration_minutes, capacity, level, description, status, facility_reserved
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
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
        ),
      db
        .prepare(
          `INSERT INTO participants (activity_id, user_email, display_name)
           VALUES (?, ?, ?)`,
        )
        .bind(id, user.email, displayName),
    ]);

    return Response.json({ id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "모임을 만들지 못했어요.";
    return Response.json({ error: message }, { status: 500 });
  }
}
