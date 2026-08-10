import { getSessionUser } from "@/server/auth/session";
import {
  enforceRateLimit,
  getClientIp,
  readJsonObject,
  rejectCrossOriginMutation,
  requestErrorResponse,
} from "@/server/security/request";
import { getD1 } from "@/db/index";

const EXPO_PUSH_TOKEN = /^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]{16,180}\]$/;

function readToken(value: unknown) {
  const token = typeof value === "string" ? value.trim() : "";
  return EXPO_PUSH_TOKEN.test(token) ? token : "";
}

function readPlatform(value: unknown) {
  return value === "ios" || value === "android" ? value : "";
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;

  try {
    const payload = await readJsonObject(request, 1_024);
    const token = readToken(payload.token);
    const platform = readPlatform(payload.platform);
    if (!token || !platform) {
      return Response.json({ error: "푸시 토큰이 올바르지 않아요." }, { status: 400 });
    }
    const db = getD1();
    const rateError = await enforceRateLimit(db, {
      action: "push-token-register",
      identifiers: [`user:${user.email}`, `ip:${getClientIp(request)}`],
      maximum: 30,
      windowSeconds: 60 * 60,
    });
    if (rateError) return rateError;

    await db
      .prepare(
        `INSERT INTO push_tokens (
           token, user_email, platform, enabled, last_seen_at
         ) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
         ON CONFLICT(token) DO UPDATE SET
           user_email = excluded.user_email,
           platform = excluded.platform,
           enabled = 1,
           last_seen_at = CURRENT_TIMESTAMP`,
      )
      .bind(token, user.email, platform)
      .run();

    return Response.json({ registered: true });
  } catch (error) {
    return requestErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;

  try {
    const payload = await readJsonObject(request, 1_024);
    const token = readToken(payload.token);
    if (!token) {
      return Response.json({ error: "푸시 토큰이 올바르지 않아요." }, { status: 400 });
    }
    const db = getD1();
    await db
      .prepare(
        `UPDATE push_tokens
         SET enabled = 0, last_seen_at = CURRENT_TIMESTAMP
         WHERE token = ? AND user_email = ?`,
      )
      .bind(token, user.email)
      .run();

    return Response.json({ unregistered: true });
  } catch (error) {
    return requestErrorResponse(error);
  }
}
