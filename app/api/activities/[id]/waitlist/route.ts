import { getSessionUser } from "../../../../auth";
import { enforceRateLimit, getClientIp } from "../../../../security";
import { ensureSchema, getD1 } from "../../../../../db";
import { createNotifications } from "../../../../notification-store";
import {
  getUserDisplayName,
  hasBlockedRelationship,
} from "../../../../activity-policy";

// GET: 내 대기 상태 + 대기 인원 수 조회
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureSchema();
  const user = await getSessionUser();
  const { id } = await params;
  const db = getD1();

  const waitlistCount = await db
    .prepare(`SELECT COUNT(*) as cnt FROM waitlist WHERE activity_id = ? AND status = 'waiting'`)
    .bind(id)
    .first<{ cnt: number }>();

  let position: number | null = null;
  if (user) {
    const myEntry = await db
      .prepare(`SELECT position FROM waitlist WHERE activity_id = ? AND user_email = ? AND status = 'waiting'`)
      .bind(id, user.email)
      .first<{ position: number }>();
    position = myEntry?.position ?? null;
  }

  return Response.json({
    waitlistCount: waitlistCount?.cnt ?? 0,
    position,
    isWaitlisted: position !== null,
  });
}

// POST: 대기 신청
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  await ensureSchema();
  const { id } = await params;
  const db = getD1();
  const rateError = await enforceRateLimit(db, {
    action: "waitlist-join",
    identifiers: [`user:${user.email}`, `ip:${getClientIp(request)}`],
    maximum: 60,
    windowSeconds: 15 * 60,
  });
  if (rateError) return rateError;

  // 모임 존재 확인
  const activity = await db
    .prepare(`SELECT id, creator_email, title, capacity, starts_at, status FROM activities WHERE id = ?`)
    .bind(id)
    .first<{
      id: string;
      creator_email: string;
      title: string;
      capacity: number;
      starts_at: string;
      status: string;
    }>();

  if (!activity || activity.status !== "open") {
    return Response.json({ error: "모임을 찾을 수 없어요." }, { status: 404 });
  }

  if (new Date(activity.starts_at).getTime() <= Date.now()) {
    return Response.json({ error: "이미 시작된 모임이에요." }, { status: 409 });
  }
  if (await hasBlockedRelationship(db, user.email, activity.creator_email)) {
    return Response.json(
      { error: "차단 관계인 사용자와 같은 모임에 대기할 수 없어요." },
      { status: 403 },
    );
  }

  // 이미 참여 중인지 확인
  const alreadyJoined = await db
    .prepare(`SELECT 1 FROM participants WHERE activity_id = ? AND user_email = ?`)
    .bind(id, user.email)
    .first();

  if (alreadyJoined) {
    return Response.json({ error: "이미 참여 중인 모임이에요." }, { status: 400 });
  }

  // 이미 대기 중인지 확인
  const alreadyWaiting = await db
    .prepare(`SELECT 1 FROM waitlist WHERE activity_id = ? AND user_email = ? AND status = 'waiting'`)
    .bind(id, user.email)
    .first();

  if (alreadyWaiting) {
    return Response.json({ error: "이미 대기 중이에요." }, { status: 400 });
  }

  // 실제로 자리가 없는지 확인
  const participantCount = await db
    .prepare(`SELECT COUNT(*) as cnt FROM participants WHERE activity_id = ?`)
    .bind(id)
    .first<{ cnt: number }>();

  if ((participantCount?.cnt ?? 0) < activity.capacity) {
    return Response.json({ error: "아직 자리가 있어요. 바로 참여해 주세요!" }, { status: 400 });
  }

  // 현재 대기열 마지막 position 조회
  const lastPosition = await db
    .prepare(`SELECT MAX(position) as max_pos FROM waitlist WHERE activity_id = ? AND status = 'waiting'`)
    .bind(id)
    .first<{ max_pos: number | null }>();

  const newPosition = (lastPosition?.max_pos ?? 0) + 1;

  // 대기 등록
  await db
    .prepare(
      `INSERT OR IGNORE INTO waitlist (activity_id, user_email, display_name, position, status)
       VALUES (?, ?, ?, ?, 'waiting')`,
    )
    .bind(id, user.email, getUserDisplayName(user), newPosition)
    .run();

  await createNotifications([
    {
      userEmail: user.email,
      activityId: id,
      type: "waitlisted",
      title: "대기 신청이 완료됐어요",
      message: `${activity.title} 모임 대기 ${newPosition}번이에요. 자리가 생기면 알려드릴게요.`,
      dedupeKey: `waitlisted:${id}:${user.email}`,
    },
    ...(activity.creator_email !== user.email
      ? [
          {
            userEmail: activity.creator_email,
            activityId: id,
            type: "participant_joined" as const,
            title: "새 대기자가 생겼어요",
            message: `${getUserDisplayName(user)}님이 ${activity.title} 모임 대기를 신청했어요.`,
            dedupeKey: `waitlisted-host:${id}:${user.email}`,
          },
        ]
      : []),
  ]);

  return Response.json({ position: newPosition, waitlisted: true }, { status: 201 });
}

// DELETE: 대기 취소
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  await ensureSchema();
  const { id } = await params;
  const db = getD1();
  const rateError = await enforceRateLimit(db, {
    action: "waitlist-leave",
    identifiers: [`user:${user.email}`, `ip:${getClientIp(request)}`],
    maximum: 60,
    windowSeconds: 15 * 60,
  });
  if (rateError) return rateError;

  await db
    .prepare(`UPDATE waitlist SET status = 'cancelled' WHERE activity_id = ? AND user_email = ? AND status = 'waiting'`)
    .bind(id, user.email)
    .run();

  return Response.json({ waitlisted: false });
}
