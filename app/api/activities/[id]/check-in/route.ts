import { constantTimeEqual, getSessionUser, hashAttendanceCode } from "@/server/auth/session";
import { ensureSchema, getD1 } from "@/db/index";
import { createNotifications } from "@/server/services/notification.service";
import {
  enforceRateLimit,
  getClientIp,
  readJsonObject,
  requestErrorResponse,
} from "@/server/security/request";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  try {
    const payload = await readJsonObject(request, 1_024);
    const code = typeof payload.code === "string" ? payload.code.trim() : "";
    if (!/^\d{6}$/.test(code)) {
      return Response.json({ error: "6자리 출석번호를 입력해 주세요." }, { status: 400 });
    }

    await ensureSchema();
    const { id } = await params;
    const db = getD1();
    const rateError = await enforceRateLimit(db, {
      action: "attendance-check-in",
      identifiers: [`user:${user.email}`, `ip:${getClientIp(request)}`],
      maximum: 5,
      windowSeconds: 10 * 60,
    });
    if (rateError) return rateError;

    const row = await db.prepare(
      `SELECT ac.code_hash, ac.valid_from, ac.expires_at,
              a.creator_email, a.title,
              p.attendance_status
       FROM attendance_codes ac
       JOIN activities a ON a.id = ac.activity_id
       JOIN participants p ON p.activity_id = ac.activity_id AND p.user_email = ?
       WHERE ac.activity_id = ? AND a.status = 'open'`,
    ).bind(user.email, id).first<{
      code_hash: string;
      valid_from: string;
      expires_at: string;
      creator_email: string;
      title: string;
      attendance_status: string;
    }>();

    if (!row) return Response.json({ error: "사용 가능한 출석번호가 없어요." }, { status: 404 });
    if (row.creator_email === user.email) {
      return Response.json({ error: "모임장은 번호를 만들 때 자동 출석돼요." }, { status: 400 });
    }
    if (row.attendance_status === "attended") {
      return Response.json({ success: true, alreadyCheckedIn: true });
    }
    const now = Date.now();
    if (now < new Date(row.valid_from).getTime()) {
      return Response.json({ error: "출석 확인은 모임 시작 30분 전부터 가능해요." }, { status: 400 });
    }
    if (now > new Date(row.expires_at).getTime()) {
      return Response.json({ error: "출석번호가 만료됐어요." }, { status: 400 });
    }

    const candidate = await hashAttendanceCode(id, code);
    if (!constantTimeEqual(candidate, row.code_hash)) {
      return Response.json({ error: "출석번호가 올바르지 않아요." }, { status: 400 });
    }

    await db.prepare(
      `UPDATE participants SET attendance_status = 'attended'
       WHERE activity_id = ? AND user_email = ?`,
    ).bind(id, user.email).run();
    await createNotifications([{
      userEmail: row.creator_email,
      activityId: id,
      type: "attendance",
      title: "참가자가 출석했어요",
      message: `${user.displayName} 님이 ${row.title} 모임에 출석했어요.`,
      dedupeKey: `self-check-in:${id}:${user.email}`,
    }]);
    return Response.json({ success: true });
  } catch (error) {
    return requestErrorResponse(error);
  }
}
