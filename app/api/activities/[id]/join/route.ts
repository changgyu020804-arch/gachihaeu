import { getChatGPTUser } from "../../../../chatgpt-auth";
import { ensureSchema, getD1 } from "../../../../../db";

function displayName(user: { fullName: string | null; email: string }) {
  return user.fullName?.trim() || user.email.split("@")[0];
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  await ensureSchema();
  const { id } = await params;
  const db = getD1();
  const activity = await db
    .prepare(
      `SELECT id, creator_email, capacity, starts_at, status
       FROM activities WHERE id = ?`,
    )
    .bind(id)
    .first<{
      id: string;
      creator_email: string;
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

  return Response.json({ joined: true }, { status: 201 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  await ensureSchema();
  const { id } = await params;
  const db = getD1();
  const activity = await db
    .prepare(`SELECT creator_email FROM activities WHERE id = ?`)
    .bind(id)
    .first<{ creator_email: string }>();

  if (!activity) return Response.json({ error: "모임을 찾을 수 없어요." }, { status: 404 });
  if (activity.creator_email === user.email) {
    return Response.json(
      { error: "모임장은 참가 취소 대신 모임을 취소해야 해요." },
      { status: 400 },
    );
  }

  await db
    .prepare(`DELETE FROM participants WHERE activity_id = ? AND user_email = ?`)
    .bind(id, user.email)
    .run();

  return Response.json({ joined: false });
}
