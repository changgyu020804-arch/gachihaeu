import { getSessionUser } from "@/server/auth/session";
import { enforceRateLimit, getClientIp } from "@/server/security/request";
import { getD1 } from "@/db/index";

function parseEmail(value: string) {
  return decodeURIComponent(value).trim().toLowerCase().slice(0, 100);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ email: string }> },
) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  const { email } = await params;
  const blockedEmail = parseEmail(email);
  if (!blockedEmail || blockedEmail === user.email) {
    return Response.json({ error: "자기 자신은 차단할 수 없어요." }, { status: 400 });
  }
  const db = getD1();
  const rateError = await enforceRateLimit(db, {
    action: "user-block",
    identifiers: [`user:${user.email}`, `ip:${getClientIp(request)}`],
    maximum: 30,
    windowSeconds: 60 * 60,
  });
  if (rateError) return rateError;

  await db
    .prepare(
      `INSERT OR IGNORE INTO user_blocks (blocker_email, blocked_email)
       VALUES (?, ?)`,
    )
    .bind(user.email, blockedEmail)
    .run();

  return Response.json({ blocked: true }, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ email: string }> },
) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  const { email } = await params;
  const blockedEmail = parseEmail(email);
  const db = getD1();
  const rateError = await enforceRateLimit(db, {
    action: "user-unblock",
    identifiers: [`user:${user.email}`, `ip:${getClientIp(request)}`],
    maximum: 30,
    windowSeconds: 60 * 60,
  });
  if (rateError) return rateError;

  await db
    .prepare(
      `DELETE FROM user_blocks
       WHERE blocker_email = ? AND blocked_email = ?`,
    )
    .bind(user.email, blockedEmail)
    .run();

  return Response.json({ blocked: false });
}
