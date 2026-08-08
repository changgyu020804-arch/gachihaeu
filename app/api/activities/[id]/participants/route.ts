import { getSessionUser } from "@/server/auth/session";
import { AttendanceStatus } from "@/lib/types/activity";
import { enforceRateLimit, getClientIp } from "@/server/security/request";
import { ensureSchema, getD1 } from "@/db/index";
import { createNotifications } from "@/server/services/notification.service";

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
  title: string;
  starts_at: string;
  duration_minutes: number;
  status: string;
};

type ViewerActivityRow = ActivityRow & {
  viewer_attendance_status: AttendanceStatus | null;
};

async function getActivity(db: D1Database, id: string) {
  return db
    .prepare(
      `SELECT creator_email, title, starts_at, duration_minutes, status
       FROM activities
       WHERE id = ?`,
    )
    .bind(id)
    .first<ActivityRow>();
}

async function getActivityForViewer(
  db: D1Database,
  id: string,
  viewerEmail: string,
) {
  return db
    .prepare(
      `SELECT
         a.creator_email,
         a.title,
         a.starts_at,
         a.duration_minutes,
         a.status,
         p.attendance_status AS viewer_attendance_status
       FROM activities a
       LEFT JOIN participants p
         ON p.activity_id = a.id AND p.user_email = ?
       WHERE a.id = ?`,
    )
    .bind(viewerEmail, id)
    .first<ViewerActivityRow>();
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

  const activity = await getActivityForViewer(db, id, user.email);
  if (!activity) {
    return Response.json({ error: "모임을 찾을 수 없어요." }, { status: 404 });
  }

  const isOwner = activity.creator_email === user.email;

  if (!isOwner && !activity.viewer_attendance_status) {
    return Response.json(
      { error: "이 모임의 참가자만 구성원을 볼 수 있어요." },
      { status: 403 },
    );
  }

  const rows = await db
    .prepare(
      `WITH participant_rating_stats AS (
         SELECT
           r.rated_email,
           AVG((r.trust_score + r.skill_score + r.manner_score) / 3.0) AS reputation_score,
           COUNT(*) AS rating_count
         FROM ratings r
         INNER JOIN participants target
           ON target.user_email = r.rated_email AND target.activity_id = ?
         GROUP BY r.rated_email
       )
       SELECT
         p.user_email,
         p.display_name,
         p.attendance_status,
         COALESCE(up.nickname, '') AS nickname,
         COALESCE(up.department, '') AS department,
         stats.reputation_score,
         COALESCE(stats.rating_count, 0) AS rating_count,
         CASE WHEN p.user_email = ? THEN 1 ELSE 0 END AS is_host,
         CASE WHEN mine.id IS NULL THEN 0 ELSE 1 END AS has_rated
       FROM participants p
       LEFT JOIN user_profiles up ON up.email = p.user_email
       LEFT JOIN participant_rating_stats stats ON stats.rated_email = p.user_email
       LEFT JOIN ratings mine
         ON mine.activity_id = ?
        AND mine.rater_email = ?
        AND mine.rated_email = p.user_email
       WHERE p.activity_id = ?
       ORDER BY is_host DESC, p.joined_at ASC`,
    )
    .bind(id, activity.creator_email, id, user.email, id)
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

  const participants = rows.results.map((row: {
    user_email: string;
    display_name: string;
    attendance_status: AttendanceStatus;
    nickname: string;
    department: string;
    reputation_score: number | null;
    rating_count: number;
    is_host: number;
    has_rated: number;
  }) => ({
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
        activity.viewer_attendance_status ?? ("pending" as AttendanceStatus),
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
  const rateError = await enforceRateLimit(db, {
    action: "attendance-update",
    identifiers: [`user:${user.email}`, `ip:${getClientIp(request)}`],
    maximum: 100,
    windowSeconds: 60 * 60,
  });
  if (rateError) return rateError;

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

  const statusLabel: Record<AttendanceStatus, string> = {
    pending: "확인 대기",
    attended: "참석",
    absent: "불참",
    no_show: "노쇼",
  };
  await createNotifications([
    {
      userEmail: participantEmail,
      activityId: id,
      type: "attendance",
      title: "출석 상태가 확인됐어요",
      message:
        attendanceStatus === "attended"
          ? `${activity.title} 모임이 참석으로 확인됐어요. 이제 모임장을 평가할 수 있어요.`
          : `${activity.title} 모임의 출석 상태가 ${statusLabel[attendanceStatus]}으로 변경됐어요.`,
      dedupeKey: `attendance:${id}:${attendanceStatus}`,
    },
  ]);

  return Response.json({ success: true, attendanceStatus });
}
