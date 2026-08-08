import { getSessionUser } from "@/server/auth/session";
import { createNotifications } from "@/server/services/notification.service";
import {
  enforceRateLimit,
  getClientIp,
  readJsonObject,
  requestErrorResponse,
} from "@/server/security/request";
import { ensureSchema, getD1 } from "@/db/index";

type CommentContext = {
  author_email: string;
  content: string;
  creator_email: string;
  title: string;
  status: string;
};

async function getCommentContext(
  db: D1Database,
  activityId: string,
  commentId: string,
) {
  return db
    .prepare(
      `SELECT
         c.author_email,
         c.content,
         c.status,
         a.creator_email,
         a.title
       FROM activity_comments c
       INNER JOIN activities a ON a.id = c.activity_id
       WHERE c.id = ? AND c.activity_id = ?`,
    )
    .bind(commentId, activityId)
    .first<CommentContext>();
}

export async function PATCH(
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
    const pinned = payload.pinned === true;
    const db = getD1();
    const rateError = await enforceRateLimit(db, {
      action: "activity-comment-pin",
      identifiers: [`user:${user.email}`, `ip:${getClientIp(request)}`],
      maximum: 30,
      windowSeconds: 60 * 60,
    });
    if (rateError) return rateError;

    const comment = await getCommentContext(db, id, commentId);
    if (!comment || comment.status !== "visible") {
      return Response.json({ error: "댓글을 찾을 수 없어요." }, { status: 404 });
    }
    if (comment.creator_email !== user.email) {
      return Response.json(
        { error: "모임장만 댓글을 고정할 수 있어요." },
        { status: 403 },
      );
    }

    const statements = [];
    if (pinned) {
      statements.push(
        db
          .prepare(
            `UPDATE activity_comments
             SET is_pinned = 0
             WHERE activity_id = ?`,
          )
          .bind(id),
      );
    }
    statements.push(
      db
        .prepare(
          `UPDATE activity_comments
           SET is_pinned = ?
           WHERE id = ? AND activity_id = ? AND status = 'visible'`,
        )
        .bind(pinned ? 1 : 0, commentId, id),
    );
    await db.batch(statements);

    if (pinned) {
      const recipients = await db
        .prepare(
          `SELECT user_email
           FROM participants p
           WHERE activity_id = ?
             AND user_email <> ?
             AND NOT EXISTS (
               SELECT 1 FROM user_blocks ub
               WHERE
                 (ub.blocker_email = ? AND ub.blocked_email = p.user_email)
                 OR
                 (ub.blocker_email = p.user_email AND ub.blocked_email = ?)
             )`,
        )
        .bind(id, user.email, user.email, user.email)
        .all<{ user_email: string }>();
      await createNotifications(
        recipients.results.map((recipient) => ({
          userEmail: recipient.user_email,
          activityId: id,
          type: "comment",
          title: "중요 댓글이 고정됐어요",
          message: `${comment.title}: ${comment.content.slice(0, 80)}`,
          dedupeKey: `comment-pinned:${commentId}:${recipient.user_email}`,
        })),
      );
    }

    return Response.json({ pinned });
  } catch (error) {
    return requestErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  {
    params,
  }: { params: Promise<{ id: string; commentId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  await ensureSchema();
  const { id, commentId } = await params;
  const db = getD1();
  const rateError = await enforceRateLimit(db, {
    action: "activity-comment-delete",
    identifiers: [`user:${user.email}`, `ip:${getClientIp(request)}`],
    maximum: 30,
    windowSeconds: 60 * 60,
  });
  if (rateError) return rateError;

  const comment = await getCommentContext(db, id, commentId);
  if (!comment || comment.status !== "visible") {
    return Response.json({ error: "댓글을 찾을 수 없어요." }, { status: 404 });
  }

  if (comment.author_email === user.email) {
    await db
      .prepare(
        `DELETE FROM activity_comments
         WHERE id = ? AND activity_id = ? AND author_email = ?`,
      )
      .bind(commentId, id, user.email)
      .run();
    return Response.json({ deleted: true });
  }

  if (comment.creator_email === user.email) {
    await db
      .prepare(
        `UPDATE activity_comments
         SET status = 'hidden', is_pinned = 0
         WHERE id = ? AND activity_id = ?`,
      )
      .bind(commentId, id)
      .run();
    return Response.json({ hidden: true });
  }

  return Response.json(
    { error: "자신의 댓글만 삭제할 수 있어요." },
    { status: 403 },
  );
}
