import { getSessionUser } from "../../../../auth";
import { AttendanceStatus } from "../../../../activity-data";
import { ensureSchema, getD1 } from "../../../../../db";

const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  "pending",
  "attended",
  "absent",
  "no_show",
];

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

type ActivityRow = {
  creator_email: string;
  starts_at: string;
  duration_minutes: number;
  status: string;
};

async function getActivity(db: D1Database, id: string) {
  return db
    .prepare(
      `SELECT creator_email, starts_at, duration_minutes, status
       FROM activities
       WHERE id = ?`,
    )
    .bind(id)
    .first<ActivityRow>();
}

function hasActivityEnded(activity: ActivityRow) {
  return (
    new Date(activity.starts_at).getTime() +
      activity.duration_minutes * 60_000 <
    Date.now()
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  await ensureSchema();
  const { id } = await params;
  const db = getD1();
  const activity = await getActivity(db, id);
  if (!activity) {
    return Response.json({ error: "모임을 찾을 수 없어요." }, { status: 404 });
  }

  const viewerParticipant = await db
    .prepare(
      `SELECT attendance_status
       FROM participants
       WHERE activity_id = ? AND user_email = ?`,
    )
    .bind(id, user.email)
    .first<{ attendance_status: AttendanceStatus }>();
  const isOwner = activity.creator_email === user.email;

  if (!isOwner && !viewerParticipant) {
    return Response.json(
      { error: "이 모임의 참가자만 구성원을 볼 수 있어요." },
      { status: 403 },
    );
  }

  const rows = await db
    .prepare(
      `SELECT
        p.user_email,
        p.display_name,
        p.attendance_status,
        COALESCE(up.nickname, '') AS nickname,
        COALESCE(up.department, '') AS department,
        (SELECT AVG((trust_score + skill_score + manner_score) / 3.0)
         FROM ratings WHERE rated_email = p.user_email) AS reputation_score,
        (SELECT COUNT(*) FROM ratings WHERE rated_email = p.user_email) AS rating_count,
        CASE WHEN p.user_email = ? THEN 1 ELSE 0 END AS is_host,
        CASE WHEN EXISTS (
          SELECT 1 FROM ratings
          WHERE activity_id = ? AND rater_email = ? AND rated_email = p.user_email
        ) THEN 1 ELSE 0 END AS has_rated
      FROM participants p
      LEFT JOIN user_profiles up ON up.email = p.user_email
      WHERE p.activity_id = ?
      ORDER BY is_host DESC, p.joined_at ASC`,
    )
    .bind(activity.creator_email, id, user.email, id)
    .all<{
      user_email: string;
      display_name: string;
      attendance_status: AttendanceStatus;
      nickname: string;
      department: string;
      reputation_score: number | null;
      rating_count: number;
      is_host: number;
      has_rated: number;
    }>();

  const participants = rows.results.map((row) => ({
    email: row.user_email,
    displayName: row.display_name,
    nickname: row.nickname || row.display_name,
    department: row.department,
    reputationScore:
      row.reputation_score == null
        ? null
        : Math.round(row.reputation_score * 10) / 10,
    ratingCount: Number(row.rating_count),
    hasRated: Boolean(row.has_rated),
    attendanceStatus: row.attendance_status,
    isHost: Boolean(row.is_host),
  }));

  return Response.json({
    participants,
    context: {
      isOwner,
      hasEnded: hasActivityEnded(activity),
      activityStatus: activity.status,
      creatorEmail: activity.creator_email,
      currentUserAttendance:
        viewerParticipant?.attendance_status ?? ("pending" as AttendanceStatus),
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  await ensureSchema();
  const { id } = await params;
  const payload = (await request.json()) as Record<string, unknown>;
  const participantEmail = cleanString(payload.participantEmail, 100);
  const attendanceStatus = cleanString(payload.attendanceStatus, 20) as AttendanceStatus;

  if (!participantEmail || !ATTENDANCE_STATUSES.includes(attendanceStatus)) {
    return Response.json({ error: "올바른 출석 상태를 선택해 주세요." }, { status: 400 });
  }

  const db = getD1();
  const activity = await getActivity(db, id);
  if (!activity) {
    return Response.json({ error: "모임을 찾을 수 없어요." }, { status: 404 });
  }
  if (activity.creator_email !== user.email) {
    return Response.json({ error: "모임장만 출석을 확인할 수 있어요." }, { status: 403 });
  }
  if (activity.status !== "open") {
    return Response.json({ error: "취소된 모임은 출석을 변경할 수 없어요." }, { status: 400 });
  }
  if (!hasActivityEnded(activity)) {
    return Response.json({ error: "모임이 끝난 후 출석을 확인할 수 있어요." }, { status: 400 });
  }
  if (participantEmail === activity.creator_email) {
    return Response.json({ error: "모임장 출석은 변경하지 않아요." }, { status: 400 });
  }

  const participant = await db
    .prepare(
      `SELECT attendance_status
       FROM participants
       WHERE activity_id = ? AND user_email = ?`,
    )
    .bind(id, participantEmail)
    .first<{ attendance_status: AttendanceStatus }>();
  if (!participant) {
    return Response.json({ error: "참가자를 찾을 수 없어요." }, { status: 404 });
  }

  const existingRating = await db
    .prepare(
      `SELECT 1 FROM ratings
       WHERE activity_id = ? AND rater_email = ? AND rated_email = ?`,
    )
    .bind(id, user.email, participantEmail)
    .first();
  if (existingRating && attendanceStatus !== "attended") {
    return Response.json(
      { error: "평가를 완료한 참가자는 참석 상태를 변경할 수 없어요." },
      { status: 409 },
    );
  }

  await db
    .prepare(
      `UPDATE participants
       SET attendance_status = ?
       WHERE activity_id = ? AND user_email = ?`,
    )
    .bind(attendanceStatus, id, participantEmail)
    .run();

  return Response.json({ success: true, attendanceStatus });
}
