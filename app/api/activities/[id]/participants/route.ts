import { getSessionUser } from "@/server/auth/session";
import { AttendanceStatus } from "@/lib/types/activity";
import { enforceRateLimit, getClientIp } from "@/server/security/request";
import { getD1 } from "@/db/index";
import { createNotifications } from "@/server/services/notification.service";
import { cleanUserText } from "@/server/validation/content-moderation";
import {
  getActivityForViewer,
  getParticipantActivity,
  getParticipantAttendance,
  hasActivityEnded,
  hasHostRatedParticipant,
  listActivityParticipants,
  updateParticipantAttendance,
} from "@/server/repositories/activity-participant.repository";

const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  "pending",
  "attended",
  "absent",
  "no_show",
];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
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

  const participants = await listActivityParticipants(
    db,
    id,
    activity.creator_email,
    user.email,
  );

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
  const { id } = await params;
  const payload = (await request.json()) as Record<string, unknown>;
  const participantEmail = cleanUserText(payload.participantEmail, 100);
  const attendanceStatus = cleanUserText(payload.attendanceStatus, 20) as AttendanceStatus;

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

  const activity = await getParticipantActivity(db, id);
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

  const participant = await getParticipantAttendance(db, id, participantEmail);
  if (!participant) {
    return Response.json({ error: "참가자를 찾을 수 없어요." }, { status: 404 });
  }

  const existingRating = await hasHostRatedParticipant(
    db,
    id,
    user.email,
    participantEmail,
  );
  if (existingRating && attendanceStatus !== "attended") {
    return Response.json(
      { error: "평가를 완료한 참가자는 참석 상태를 변경할 수 없어요." },
      { status: 409 },
    );
  }

  await updateParticipantAttendance(db, id, participantEmail, attendanceStatus);

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
