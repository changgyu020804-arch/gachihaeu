import { getSessionUser } from "@/server/auth/session";
import { enforceRateLimit, getClientIp } from "@/server/security/request";
import { getD1 } from "@/db/index";
import { sendModerationAlert } from "@/server/services/moderation-alert.service";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
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

  const rating = await db
    .prepare(
      `SELECT id, rater_email, comment, reported_at
       FROM ratings
       WHERE id = ? AND rated_email = ?`,
    )
    .bind(ratingId, user.email)
    .first<{
      id: string;
      rater_email: string;
      comment: string;
      reported_at: string | null;
    }>();

  if (!rating) {
    return Response.json(
      { error: "본인이 받은 코멘트만 숨길 수 있어요." },
      { status: 403 },
    );
  }

  await db
    .prepare(
      `UPDATE ratings
       SET comment_hidden = 1,
           reported_at = COALESCE(reported_at, datetime('now'))
       WHERE id = ? AND rated_email = ?`,
    )
    .bind(ratingId, user.email)
    .run();

  if (!rating.reported_at) {
    await sendModerationAlert(db, {
      reportType: "rating",
      reportId: rating.id,
      reporterEmail: user.email,
      targetEmail: rating.rater_email,
      reason: "받은 한줄 코멘트 신고",
      content: rating.comment,
    });
  }

  return Response.json({ success: true });
}
