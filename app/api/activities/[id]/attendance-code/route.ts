import { generateAuthCode, getSessionUser, hashAttendanceCode } from "@/server/auth/session";
import { getD1 } from "@/db/index";
import { enforceRateLimit, getClientIp } from "@/server/security/request";

type ActivityRow = {
  creator_email: string;
  starts_at: string;
  duration_minutes: number;
  status: string;
};

async function getActivity(db: D1Database, id: string) {
  return db.prepare(
    `SELECT creator_email, starts_at, duration_minutes, status
     FROM activities WHERE id = ?`,
  ).bind(id).first<ActivityRow>();
}

function getAttendanceWindow(activity: ActivityRow) {
  const startsAt = new Date(activity.starts_at).getTime();
  return {
    validFrom: new Date(startsAt - 30 * 60_000).toISOString(),
    expiresAt: new Date(startsAt + activity.duration_minutes * 60_000 + 60 * 60_000).toISOString(),
  };
}

function getGenerationUnavailableReason(activity: ActivityRow, isOwner: boolean) {
  if (!isOwner) return "모임장만 출석번호를 만들 수 있어요.";
  if (activity.status !== "open") {
    return "취소되거나 종료 처리된 모임에서는 출석번호를 만들 수 없어요.";
  }
  const { expiresAt } = getAttendanceWindow(activity);
  if (Date.now() > new Date(expiresAt).getTime()) {
    return "출석 확인 시간이 지났어요.";
  }
  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const { id } = await params;
  const db = getD1();
  const activity = await getActivity(db, id);
  if (!activity) return Response.json({ error: "모임을 찾을 수 없어요." }, { status: 404 });

  const participant = await db.prepare(
    `SELECT 1 FROM participants WHERE activity_id = ? AND user_email = ?`,
  ).bind(id, user.email).first();
  if (!participant) return Response.json({ error: "이 모임 참가자만 확인할 수 있어요." }, { status: 403 });

  const code = await db.prepare(
    `SELECT valid_from, expires_at FROM attendance_codes WHERE activity_id = ?`,
  ).bind(id).first<{ valid_from: string; expires_at: string }>();
  const isOwner = activity.creator_email === user.email;
  const unavailableReason = getGenerationUnavailableReason(activity, isOwner);
  return Response.json({
    isOwner,
    canGenerate: isOwner && unavailableReason === null,
    unavailableReason,
    active: Boolean(code && new Date(code.expires_at).getTime() > Date.now()),
    validFrom: code?.valid_from ?? null,
    expiresAt: code?.expires_at ?? null,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const { id } = await params;
  const db = getD1();
  const activity = await getActivity(db, id);
  if (!activity) return Response.json({ error: "모임을 찾을 수 없어요." }, { status: 404 });
  const unavailableReason = getGenerationUnavailableReason(
    activity,
    activity.creator_email === user.email,
  );
  if (unavailableReason) {
    return Response.json(
      { error: unavailableReason },
      { status: activity.creator_email === user.email ? 400 : 403 },
    );
  }

  const { validFrom, expiresAt } = getAttendanceWindow(activity);
  const rateError = await enforceRateLimit(db, {
    action: "attendance-code-generate",
    identifiers: [`user:${user.email}`, `ip:${getClientIp(request)}`],
    maximum: 10,
    windowSeconds: 60 * 60,
  });
  if (rateError) return rateError;

  const code = generateAuthCode();
  const codeHash = await hashAttendanceCode(id, code);
  await db.batch([
    db.prepare(
      `INSERT INTO attendance_codes (
         activity_id, code_hash, valid_from, expires_at, generated_by, created_at
       ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(activity_id) DO UPDATE SET
         code_hash = excluded.code_hash,
         valid_from = excluded.valid_from,
         expires_at = excluded.expires_at,
         generated_by = excluded.generated_by,
         created_at = CURRENT_TIMESTAMP`,
    ).bind(id, codeHash, validFrom, expiresAt, user.email),
    db.prepare(
      `UPDATE participants SET attendance_status = 'attended'
       WHERE activity_id = ? AND user_email = ?`,
    ).bind(id, user.email),
  ]);

  return Response.json({ code, validFrom, expiresAt }, { status: 201 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const { id } = await params;
  const db = getD1();
  const activity = await getActivity(db, id);
  if (!activity) return Response.json({ error: "모임을 찾을 수 없어요." }, { status: 404 });
  if (activity.creator_email !== user.email) {
    return Response.json({ error: "모임장만 출석번호를 종료할 수 있어요." }, { status: 403 });
  }
  await db.prepare(`DELETE FROM attendance_codes WHERE activity_id = ?`).bind(id).run();
  return Response.json({ success: true });
}
