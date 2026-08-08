import { getSessionUser } from "../../auth";
import { LEVELS, SPORTS, VENUES } from "../../activity-data";
import { listActivities } from "../../activity-list-store";
import { getUserDisplayName } from "../../activity-policy";
import { enforceRateLimit, getClientIp } from "../../security";
import { ensureSchema, getD1 } from "../../../db";

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
    const activities = await listActivities(getD1(), user.email);

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
