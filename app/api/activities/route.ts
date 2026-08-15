import { getSessionUser } from "@/server/auth/session";
import { LEVELS, SPORTS, VENUES } from "@/lib/types/activity";
import {
  getActivitySummary,
  listActivityPage,
} from "@/server/repositories/activity.repository";
import { getUserDisplayName } from "@/server/policies/activity-policy";
import { enforceRateLimit, getClientIp } from "@/server/security/request";
import {
  cleanUserText,
  hasUnsafeUserText,
} from "@/server/validation/content-moderation";
import { getD1 } from "@/db/index";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const requestedSport = cleanUserText(url.searchParams.get("sport"), 20);
    const sport =
      requestedSport &&
      requestedSport !== "전체" &&
      SPORTS.includes(requestedSport as never)
        ? requestedSport
        : null;
    const requestedDate = cleanUserText(url.searchParams.get("date"), 10);
    const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
      ? requestedDate
      : null;
    const cursor = cleanUserText(url.searchParams.get("cursor"), 180) || null;
    const includeSummary = url.searchParams.get("summary") === "1";
    const db = getD1();
    const [page, summary] = await Promise.all([
      listActivityPage(db, user.email, {
        limit: 20,
        cursor,
        sport,
        dateKey,
        myOnly: url.searchParams.get("mine") === "1",
      }),
      includeSummary
        ? getActivitySummary(db, user.email)
        : Promise.resolve(null),
    ]);

    return Response.json({
      activities: page.activities,
      nextCursor: page.nextCursor,
      ...(summary ? { summary } : {}),
    });
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
    const payload = (await request.json()) as Record<string, unknown>;
    const sport = cleanUserText(payload.sport, 20);
    const title = cleanUserText(payload.title, 50);
    const venue = cleanUserText(payload.venue, 80);
    const level = cleanUserText(payload.level, 30);
    const description = cleanUserText(payload.description, 280);
    const startsAt = cleanUserText(payload.startsAt, 40);
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
    if (hasUnsafeUserText(title) || hasUnsafeUserText(description)) {
      return Response.json(
        { error: "모임 정보에 연락처, 외부 계정 또는 부적절한 표현을 적을 수 없어요." },
        { status: 400 },
      );
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
