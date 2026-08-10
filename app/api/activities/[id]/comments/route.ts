import { getSessionUser } from "@/server/auth/session";
import {
  COMMENT_MAX_LENGTH,
  isCommentingClosed,
} from "@/lib/types/activity-comment";
import {
  getCommentActivity,
  getOwnerCommentRecipientEmails,
  listActivityComments,
} from "@/server/repositories/activity-comment.repository";
import { hasBlockedRelationship } from "@/server/policies/activity-policy";
import {
  cleanUserText,
  hasUnsafeUserText,
} from "@/server/validation/content-moderation";
import { createNotifications } from "@/server/services/notification.service";
import {
  enforceRateLimit,
  getClientIp,
  readJsonObject,
  requestErrorResponse,
} from "@/server/security/request";
import { getD1 } from "@/db/index";

function readOffset(request: Request) {
  const value = Number(new URL(request.url).searchParams.get("offset") ?? 0);
  return Number.isInteger(value) && value >= 0
    ? Math.min(value, 10_000)
    : 0;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const { id } = await params;
  const db = getD1();
  const activity = await getCommentActivity(db, id);
  if (!activity) {
    return Response.json({ error: "모임을 찾을 수 없어요." }, { status: 404 });
  }
  if (
    activity.creator_email !== user.email &&
    (await hasBlockedRelationship(db, user.email, activity.creator_email))
  ) {
    return Response.json(
      { error: "차단 관계인 사용자의 모임 댓글은 볼 수 없어요." },
      { status: 403 },
    );
  }

  const offset = readOffset(request);
  return Response.json(
    await listActivityComments(db, activity, id, user.email, offset),
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const payload = await readJsonObject(request, 4_096);
    const content = cleanUserText(payload.content, COMMENT_MAX_LENGTH);
    if (!content) {
      return Response.json({ error: "댓글 내용을 입력해 주세요." }, { status: 400 });
    }
    if (hasUnsafeUserText(content)) {
      return Response.json(
        { error: "댓글에 연락처, 외부 계정 또는 부적절한 표현을 적을 수 없어요." },
        { status: 400 },
      );
    }

    const db = getD1();
    const rateError = await enforceRateLimit(db, {
      action: "activity-comment-create",
      identifiers: [`user:${user.email}`, `ip:${getClientIp(request)}`],
      maximum: 15,
      windowSeconds: 5 * 60,
    });
    if (rateError) return rateError;

    const [activity, profile] = await Promise.all([
      getCommentActivity(db, id),
      db
        .prepare(
          `SELECT nickname, onboarding_completed
           FROM user_profiles
           WHERE email = ?`,
        )
        .bind(user.email)
        .first<{ nickname: string; onboarding_completed: number }>(),
    ]);
    if (!activity) {
      return Response.json({ error: "모임을 찾을 수 없어요." }, { status: 404 });
    }
    if (!profile?.onboarding_completed) {
      return Response.json({ error: "프로필을 먼저 완성해 주세요." }, { status: 403 });
    }
    if (isCommentingClosed(activity)) {
      return Response.json(
        { error: "모임 종료 24시간 후에는 댓글을 작성할 수 없어요." },
        { status: 409 },
      );
    }
    if (
      activity.creator_email !== user.email &&
      (await hasBlockedRelationship(db, user.email, activity.creator_email))
    ) {
      return Response.json(
        { error: "차단 관계인 사용자의 모임에는 댓글을 작성할 수 없어요." },
        { status: 403 },
      );
    }

    const commentId = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO activity_comments (
           id, activity_id, author_email, content
         ) VALUES (?, ?, ?, ?)`,
      )
      .bind(commentId, id, user.email, content)
      .run();

    if (activity.creator_email === user.email) {
      const recipientEmails = await getOwnerCommentRecipientEmails(
        db,
        id,
        user.email,
      );
      await createNotifications(
        recipientEmails.map((recipientEmail) => ({
          userEmail: recipientEmail,
          activityId: id,
          type: "comment",
          title: "모임장이 댓글을 남겼어요",
          message: `${activity.title}: ${content.slice(0, 80)}`,
          dedupeKey: `comment:${commentId}:${recipientEmail}`,
        })),
      );
    } else {
      await createNotifications([
        {
          userEmail: activity.creator_email,
          activityId: id,
          type: "comment",
          title: "새 모임 댓글이 등록됐어요",
          message: `${profile.nickname}: ${content.slice(0, 80)}`,
          dedupeKey: `comment:${commentId}:${activity.creator_email}`,
        },
      ]);
    }

    return Response.json({ id: commentId }, { status: 201 });
  } catch (error) {
    return requestErrorResponse(error);
  }
}
