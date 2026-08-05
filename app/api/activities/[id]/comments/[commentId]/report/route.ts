import { getSessionUser } from "../../../../../../auth";
import {
  enforceRateLimit,
  getClientIp,
  readJsonObject,
  recordSecurityEvent,
  requestErrorResponse,
} from "../../../../../../security";
import { cleanUserText } from "../../../../../../content-moderation";
import { ensureSchema, getD1 } from "../../../../../../../db";

export async function POST(
  request: Request,
  {
    params,
  }: { params: Promise<{ id: string; commentId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  try {
    await ensureSchema();
    const { id, commentId } = await params;
    const payload = await readJsonObject(request, 2_048);
    const reason =
      cleanUserText(payload.reason, 200) || "부적절한 모임 댓글";
    const db = getD1();
    const rateError = await enforceRateLimit(db, {
      action: "activity-comment-report",
      identifiers: [`user:${user.email}`, `ip:${getClientIp(request)}`],
      maximum: 10,
      windowSeconds: 60 * 60,
    });
    if (rateError) return rateError;

    const comment = await db
      .prepare(
        `SELECT author_email
         FROM activity_comments
         WHERE id = ? AND activity_id = ? AND status = 'visible'`,
      )
      .bind(commentId, id)
      .first<{ author_email: string }>();
    if (!comment) {
      return Response.json({ error: "댓글을 찾을 수 없어요." }, { status: 404 });
    }
    if (comment.author_email === user.email) {
      return Response.json(
        { error: "자신의 댓글은 신고할 수 없어요." },
        { status: 400 },
      );
    }

    await db
      .prepare(
        `INSERT INTO comment_reports (
           id, comment_id, reporter_email, reason
         ) VALUES (?, ?, ?, ?)
         ON CONFLICT(comment_id, reporter_email) DO UPDATE SET
           reason = excluded.reason,
           created_at = CURRENT_TIMESTAMP`,
      )
      .bind(crypto.randomUUID(), commentId, user.email, reason)
      .run();
    await recordSecurityEvent(
      db,
      "activity_comment_reported",
      user.email,
      request,
      `comment:${commentId}`,
    );

    return Response.json({ reported: true }, { status: 201 });
  } catch (error) {
    return requestErrorResponse(error);
  }
}
