import { getSessionUser } from "../../../../auth";
import { ensureSchema, getD1 } from "../../../../../db";

function parseEmail(value: string) {
  return decodeURIComponent(value).trim().toLowerCase().slice(0, 100);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ email: string }> },
) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  const { email } = await params;
  const blockedEmail = parseEmail(email);
  if (!blockedEmail || blockedEmail === user.email) {
    return Response.json({ error: "자기 자신은 차단할 수 없어요." }, { status: 400 });
  }

  await ensureSchema();
  await getD1()
    .prepare(
      `INSERT OR IGNORE INTO user_blocks (blocker_email, blocked_email)
       VALUES (?, ?)`,
    )
    .bind(user.email, blockedEmail)
    .run();

  return Response.json({ blocked: true }, { status: 201 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ email: string }> },
) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  const { email } = await params;
  const blockedEmail = parseEmail(email);
  await ensureSchema();
  await getD1()
    .prepare(
      `DELETE FROM user_blocks
       WHERE blocker_email = ? AND blocked_email = ?`,
    )
    .bind(user.email, blockedEmail)
    .run();

  return Response.json({ blocked: false });
}
