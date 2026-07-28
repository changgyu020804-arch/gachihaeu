import { getSessionUser } from "../../../../auth";
import { ensureSchema, getD1 } from "../../../../../db";
import { createNotifications } from "../../../../notification-store";

function displayName(user: { fullName: string | null; email: string }) {
  return user.fullName?.trim() || user.email.split("@")[0];
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  await ensureSchema();
  const { id } = await params;
  const db = getD1();
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
    .bind(id, user.email, displayName(user), id, id)
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
            message: `${displayName(user)}님이 ${activity.title} 모임에 참가했어요.`,
            dedupeKey: `participant-joined:${id}:${user.email}`,
          },
        ]
      : []),
  ]);

  return Response.json({ joined: true }, { status: 201 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  await ensureSchema();
  const { id } = await params;
  const db = getD1();
  const activity = await db
    .prepare(`SELECT creator_email, title FROM activities WHERE id = ?`)
    .bind(id)
    .first<{ creator_email: string; title: string }>();

  if (!activity) return Response.json({ error: "모임을 찾을 수 없어요." }, { status: 404 });
  if (activity.creator_email === user.email) {
    return Response.json(
      { error: "모임장은 참가 취소 대신 모임을 취소해야 해요." },
      { status: 400 },
    );
  }

  // 참가 취소
  await db
    .prepare(`DELETE FROM participants WHERE activity_id = ? AND user_email = ?`)
    .bind(id, user.email)
    .run();

  // 대기열 첫 번째 사람 자동 승격
  const nextInLine = await db
    .prepare(
      `SELECT user_email, display_name FROM waitlist
       WHERE activity_id = ? AND status = 'waiting'
       ORDER BY position ASC LIMIT 1`,
    )
    .bind(id)
    .first<{ user_email: string; display_name: string }>();

  if (nextInLine) {
    // participants에 추가
    await db
      .prepare(
        `INSERT OR IGNORE INTO participants (activity_id, user_email, display_name)
         VALUES (?, ?, ?)`,
      )
      .bind(id, nextInLine.user_email, nextInLine.display_name)
      .run();

    // waitlist에서 상태 변경
    await db
      .prepare(
        `UPDATE waitlist SET status = 'promoted'
         WHERE activity_id = ? AND user_email = ? AND status = 'waiting'`,
      )
      .bind(id, nextInLine.user_email)
      .run();
  }

  await createNotifications([
    {
      userEmail: activity.creator_email,
      activityId: id,
      type: "participant_left",
      title: "구성원이 참가를 취소했어요",
      message: `${displayName(user)}님이 ${activity.title} 모임 참가를 취소했어요.`,
      dedupeKey: `participant-left:${id}:${user.email}:${crypto.randomUUID()}`,
    },
    ...(nextInLine
      ? [
          {
            userEmail: nextInLine.user_email,
            activityId: id,
            type: "promoted" as const,
            title: "참가가 확정됐어요",
            message: `${activity.title} 모임에 자리가 생겨 대기에서 참가로 전환됐어요.`,
            dedupeKey: `promoted:${id}:${nextInLine.user_email}`,
          },
        ]
      : []),
  ]);

  return Response.json({ joined: false });
}
