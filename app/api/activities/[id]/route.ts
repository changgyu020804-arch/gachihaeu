import { getSessionUser } from "../../../auth";
import { ensureSchema, getD1 } from "../../../../db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  await ensureSchema();
  const { id } = await params;
  const result = await getD1()
    .prepare(
      `UPDATE activities
       SET status = 'cancelled'
       WHERE id = ? AND creator_email = ? AND status = 'open'`,
    )
    .bind(id, user.email)
    .run();

  if ((result.meta.changes ?? 0) === 0) {
    return Response.json(
      { error: "모임장만 모임을 취소할 수 있어요." },
      { status: 403 },
    );
  }

  return Response.json({ cancelled: true });
}
