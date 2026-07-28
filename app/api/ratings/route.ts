import { getSessionUser } from "../../auth";
import { ensureSchema, getD1 } from "../../../db";

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isValidScore(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  await ensureSchema();

  const payload = (await request.json()) as Record<string, unknown>;
  const activityId = cleanString(payload.activityId, 50);
  const ratedEmail = cleanString(payload.ratedEmail, 100);
  const trustScore = payload.trustScore;
  const skillScore = payload.skillScore;
  const mannerScore = payload.mannerScore;
  const comment = cleanString(payload.comment, 100);

  if (!activityId || !ratedEmail) {
    return Response.json({ error: "필수 정보가 부족해요." }, { status: 400 });
  }
  if (ratedEmail === user.email) {
    return Response.json({ error: "자기 자신은 평가할 수 없어요." }, { status: 400 });
  }
  if (!isValidScore(trustScore) || !isValidScore(skillScore) || !isValidScore(mannerScore)) {
    return Response.json({ error: "점수는 1~5 사이 정수여야 해요." }, { status: 400 });
  }

  const db = getD1();

  // 해당 모임이 존재하고, 이미 시작된(종료된) 모임인지 확인
  const activity = await db
    .prepare(`SELECT id, starts_at, duration_minutes, status FROM activities WHERE id = ?`)
    .bind(activityId)
    .first<{ id: string; starts_at: string; duration_minutes: number; status: string }>();

  if (!activity) {
    return Response.json({ error: "모임을 찾을 수 없어요." }, { status: 404 });
  }

  const endTime = new Date(activity.starts_at).getTime() + activity.duration_minutes * 60_000;
  if (Date.now() < endTime) {
    return Response.json({ error: "모임이 끝난 후에 평가할 수 있어요." }, { status: 400 });
  }

  // 평가자가 해당 모임에 참여했는지 확인
  const raterParticipant = await db
    .prepare(`SELECT 1 FROM participants WHERE activity_id = ? AND user_email = ?`)
    .bind(activityId, user.email)
    .first();

  if (!raterParticipant) {
    return Response.json({ error: "참여한 모임만 평가할 수 있어요." }, { status: 403 });
  }

  // 평가 대상자도 해당 모임에 참여했는지 확인
  const ratedParticipant = await db
    .prepare(`SELECT 1 FROM participants WHERE activity_id = ? AND user_email = ?`)
    .bind(activityId, ratedEmail)
    .first();

  if (!ratedParticipant) {
    return Response.json({ error: "해당 모임에 참여하지 않은 사용자예요." }, { status: 400 });
  }

  // 이미 평가했는지 확인
  const existing = await db
    .prepare(`SELECT 1 FROM ratings WHERE activity_id = ? AND rater_email = ? AND rated_email = ?`)
    .bind(activityId, user.email, ratedEmail)
    .first();

  if (existing) {
    // 이미 평가한 경우 업데이트
    await db
      .prepare(
        `UPDATE ratings SET trust_score = ?, skill_score = ?, manner_score = ?, comment = ?
         WHERE activity_id = ? AND rater_email = ? AND rated_email = ?`,
      )
      .bind(trustScore, skillScore, mannerScore, comment, activityId, user.email, ratedEmail)
      .run();

    return Response.json({ updated: true });
  }

  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO ratings (id, activity_id, rater_email, rated_email, trust_score, skill_score, manner_score, comment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, activityId, user.email, ratedEmail, trustScore, skillScore, mannerScore, comment)
    .run();

  return Response.json({ id }, { status: 201 });
}
