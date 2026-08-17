import { getSessionUser } from "@/server/auth/session";
import { enforceRateLimit, getClientIp } from "@/server/security/request";
import { getD1 } from "@/db/index";
import { createNotifications } from "@/server/services/notification.service";
import {
  cancellationDeadlineLabel,
  getUserDisplayName,
  hasBlockedRelationship,
} from "@/server/policies/activity-policy";
import { leaveActivityAndPromoteNext } from "@/server/repositories/activity-membership.repository";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const { id } = await params;
  const db = getD1();
  const rateError = await enforceRateLimit(db, {
    action: "activity-join",
    identifiers: [`user:${user.email}`, `ip:${getClientIp(request)}`],
    maximum: 60,
    windowSeconds: 15 * 60,
  });
  if (rateError) return rateError;

  const activity = await db
    .prepare(
      `SELECT id, creator_email, title, capacity, starts_at, status
       FROM activities WHERE id = ?`,
    )
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
      { error: "차단 관계인 사용자와 같은 모임에 참여할 수 없어요." },
      { status: 403 },
    );
  }

  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO participants (activity_id, user_email, display_name)
       SELECT ?, ?, ?
       WHERE (
         SELECT COUNT(*) FROM participants WHERE activity_id = ?
       ) < (
         SELECT capacity FROM activities WHERE id = ? AND status = 'open'
       )`,
    )
    .bind(id, user.email, getUserDisplayName(user), id, id)
    .run();

  if ((result.meta.changes ?? 0) === 0) {
    const existing = await db
      .prepare(
        `SELECT 1 FROM participants WHERE activity_id = ? AND user_email = ?`,
      )
      .bind(id, user.email)
      .first();
    if (existing) return Response.json({ joined: true });
    return Response.json({ error: "모집 인원이 모두 찼어요." }, { status: 409 });
  }

  await createNotifications([
    {
      userEmail: user.email,
      activityId: id,
      type: "joined",
      title: "참가가 확정됐어요",
      message: `${activity.title} 모임에 참가했어요. 시작 전에 장소와 시간을 확인해 주세요.`,
      dedupeKey: `joined:${id}`,
    },
    ...(activity.creator_email !== user.email
      ? [
          {
            userEmail: activity.creator_email,
            activityId: id,
            type: "participant_joined" as const,
            title: "새 구성원이 참가했어요",
            message: `${getUserDisplayName(user)}님이 ${activity.title} 모임에 참가했어요.`,
            dedupeKey: `participant-joined:${id}:${user.email}`,
          },
        ]
      : []),
  ]);

  return Response.json({ joined: true }, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const { id } = await params;
  const db = getD1();
  const rateError = await enforceRateLimit(db, {
    action: "activity-leave",
    identifiers: [`user:${user.email}`, `ip:${getClientIp(request)}`],
    maximum: 60,
    windowSeconds: 15 * 60,
  });
  if (rateError) return rateError;

  const activity = await db
    .prepare(
      `SELECT creator_email, title, starts_at, cancellation_deadline_minutes, status
       FROM activities WHERE id = ?`,
    )
    .bind(id)
    .first<{
      creator_email: string;
      title: string;
      starts_at: string;
      cancellation_deadline_minutes: number;
      status: string;
    }>();

  if (!activity) return Response.json({ error: "모임을 찾을 수 없어요." }, { status: 404 });
  if (activity.creator_email === user.email) {
    return Response.json(
      { error: "모임장은 참가 취소 대신 모임을 취소해야 해요." },
      { status: 400 },
    );
  }
  if (activity.status !== "open") {
    return Response.json({ error: "취소된 모임이에요." }, { status: 400 });
  }

  const cancellationClosesAt =
    new Date(activity.starts_at).getTime() -
    activity.cancellation_deadline_minutes * 60_000;
  if (Date.now() >= cancellationClosesAt) {
    const label = cancellationDeadlineLabel(
      activity.cancellation_deadline_minutes,
    );
    return Response.json(
      { error: `참가 취소 마감(${label})이 지났어요. 모임장에게 알려주세요.` },
      { status: 409 },
    );
  }

  const membership = await leaveActivityAndPromoteNext(db, id, user.email);
  if (!membership.left) {
    return Response.json({ joined: false });
  }

  await createNotifications([
    {
      userEmail: activity.creator_email,
      activityId: id,
      type: "participant_left",
      title: "구성원이 참가를 취소했어요",
      message: `${getUserDisplayName(user)}님이 ${activity.title} 모임 참가를 취소했어요.`,
      dedupeKey: `participant-left:${id}:${user.email}:${crypto.randomUUID()}`,
    },
    ...(membership.promoted
      ? [
          {
            userEmail: membership.promoted.userEmail,
            activityId: id,
            type: "promoted" as const,
            title: "참가가 확정됐어요",
            message: `${activity.title} 모임에 자리가 생겨 대기에서 참가로 전환됐어요.`,
            dedupeKey: `promoted:${id}:${membership.promoted.userEmail}`,
          },
        ]
      : []),
  ]);

  return Response.json({ joined: false });
}
