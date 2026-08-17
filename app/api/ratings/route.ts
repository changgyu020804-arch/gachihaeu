import { getSessionUser } from "@/server/auth/session";
import { AttendanceStatus, RatingType } from "@/lib/types/activity";
import { enforceRateLimit, getClientIp } from "@/server/security/request";
import { getD1 } from "@/db/index";
import { createNotifications } from "@/server/services/notification.service";
import { hasBlockedRelationship } from "@/server/policies/activity-policy";
import {
  cleanUserText,
  hasUnsafeUserText,
} from "@/server/validation/content-moderation";

function isValidScore(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
  );
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const db = getD1();
  const rateError = await enforceRateLimit(db, {
    action: "rating-create",
    identifiers: [`user:${user.email}`, `ip:${getClientIp(request)}`],
    maximum: 30,
    windowSeconds: 60 * 60,
  });
  if (rateError) return rateError;

  const payload = (await request.json()) as Record<string, unknown>;
  const activityId = cleanUserText(payload.activityId, 50);
  const ratedEmail = cleanUserText(payload.ratedEmail, 100);
  const scoreOne = payload.scoreOne;
  const scoreTwo = payload.scoreTwo;
  const scoreThree = payload.scoreThree;
  const comment = cleanUserText(payload.comment, 100);

  if (!activityId || !ratedEmail) {
    return Response.json({ error: "필수 정보가 부족해요." }, { status: 400 });
  }
  if (ratedEmail === user.email) {
    return Response.json({ error: "자기 자신은 평가할 수 없어요." }, { status: 400 });
  }
  if (
    !isValidScore(scoreOne) ||
    !isValidScore(scoreTwo) ||
    !isValidScore(scoreThree)
  ) {
    return Response.json({ error: "점수는 1~5 사이 정수여야 해요." }, { status: 400 });
  }
  if (comment && hasUnsafeUserText(comment)) {
    return Response.json(
      { error: "코멘트에 연락처, 외부 계정 또는 부적절한 표현을 적을 수 없어요." },
      { status: 400 },
    );
  }

  const activity = await db
    .prepare(
      `SELECT creator_email, title, starts_at, duration_minutes, status
       FROM activities
       WHERE id = ?`,
    )
    .bind(activityId)
    .first<{
      creator_email: string;
      title: string;
      starts_at: string;
      duration_minutes: number;
      status: string;
    }>();

  if (!activity) {
    return Response.json({ error: "모임을 찾을 수 없어요." }, { status: 404 });
  }
  if (activity.status !== "open") {
    return Response.json({ error: "취소된 모임은 평가할 수 없어요." }, { status: 400 });
  }

  const endTime =
    new Date(activity.starts_at).getTime() +
    activity.duration_minutes * 60_000;
  if (Date.now() < endTime) {
    return Response.json({ error: "모임이 끝난 후에 평가할 수 있어요." }, { status: 400 });
  }
  if (Date.now() - endTime > 30 * 24 * 60 * 60_000) {
    return Response.json({ error: "평가는 모임 종료 후 30일 안에 작성할 수 있어요." }, { status: 400 });
  }

  if (await hasBlockedRelationship(db, user.email, ratedEmail)) {
    return Response.json(
      { error: "차단 관계인 사용자와는 평가를 주고받을 수 없어요." },
      { status: 403 },
    );
  }

  const [raterParticipant, ratedParticipant] = await Promise.all([
    db
      .prepare(
        `SELECT attendance_status
         FROM participants
         WHERE activity_id = ? AND user_email = ?`,
      )
      .bind(activityId, user.email)
      .first<{ attendance_status: AttendanceStatus }>(),
    db
      .prepare(
        `SELECT attendance_status
         FROM participants
         WHERE activity_id = ? AND user_email = ?`,
      )
      .bind(activityId, ratedEmail)
      .first<{ attendance_status: AttendanceStatus }>(),
  ]);

  if (!raterParticipant || !ratedParticipant) {
    return Response.json(
      { error: "이 모임의 참가자끼리만 평가할 수 있어요." },
      { status: 403 },
    );
  }

  const isOwner = activity.creator_email === user.email;
  let ratingType: RatingType;

  if (isOwner) {
    if (ratedEmail === activity.creator_email) {
      return Response.json({ error: "모임장은 자신을 평가할 수 없어요." }, { status: 400 });
    }
    if (ratedParticipant.attendance_status !== "attended") {
      return Response.json(
        { error: "참석이 확인된 구성원만 평가할 수 있어요." },
        { status: 400 },
      );
    }
    ratingType = "host_to_member";
  } else {
    if (ratedEmail !== activity.creator_email) {
      return Response.json(
        { error: "구성원은 모임장만 평가할 수 있어요." },
        { status: 403 },
      );
    }
    if (raterParticipant.attendance_status !== "attended") {
      return Response.json(
        { error: "모임장이 참석을 확인한 뒤 평가할 수 있어요." },
        { status: 400 },
      );
    }
    ratingType = "member_to_host";
  }

  const existing = await db
    .prepare(
      `SELECT 1 FROM ratings
       WHERE activity_id = ? AND rater_email = ? AND rated_email = ?`,
    )
    .bind(activityId, user.email, ratedEmail)
    .first();

  if (existing) {
    await db
      .prepare(
        `UPDATE ratings
         SET trust_score = ?,
             skill_score = ?,
             manner_score = ?,
             rating_type = ?,
             comment = ?
         WHERE activity_id = ? AND rater_email = ? AND rated_email = ?`,
      )
      .bind(
        scoreOne,
        scoreTwo,
        scoreThree,
        ratingType,
        comment,
        activityId,
        user.email,
        ratedEmail,
      )
      .run();
    return Response.json({ updated: true, ratingType });
  }

  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO ratings (
        id, activity_id, rater_email, rated_email,
        trust_score, skill_score, manner_score, rating_type, comment
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      activityId,
      user.email,
      ratedEmail,
      scoreOne,
      scoreTwo,
      scoreThree,
      ratingType,
      comment,
    )
    .run();

  await createNotifications([
    {
      userEmail: ratedEmail,
      activityId,
      type: "rated",
      title: "새 평가를 받았어요",
      message: `${activity.title} 모임에서 익명의 한줄 코멘트와 평가가 도착했어요.`,
      dedupeKey: `rated:${activityId}:${user.email}`,
    },
  ]);

  return Response.json({ id, ratingType }, { status: 201 });
}
