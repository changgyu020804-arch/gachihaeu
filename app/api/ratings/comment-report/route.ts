import { getSessionUser } from "../../../auth";
import { enforceRateLimit, getClientIp } from "../../../security";
import { ensureSchema, getD1 } from "../../../../db";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  await ensureSchema();
  const db = getD1();
  const rateError = await enforceRateLimit(db, {
    action: "rating-comment-report",
    identifiers: [`user:${user.email}`, `ip:${getClientIp(request)}`],
    maximum: 20,
    windowSeconds: 60 * 60,
  });
  if (rateError) return rateError;

  const payload = (await request.json()) as Record<string, unknown>;
  const ratingId =
    typeof payload.ratingId === "string" ? payload.ratingId.trim().slice(0, 50) : "";
  if (!ratingId) {
    return Response.json({ error: "평가 정보가 필요해요." }, { status: 400 });
  }

  const result = await db
    .prepare(
      `UPDATE ratings
       SET comment_hidden = 1, reported_at = datetime('now')
       WHERE id = ? AND rated_email = ?`,
    )
    .bind(ratingId, user.email)
    .run();

  if (!result.meta.changes) {
    return Response.json(
      { error: "본인이 받은 코멘트만 숨길 수 있어요." },
      { status: 403 },
    );
  }

  return Response.json({ success: true });
}
