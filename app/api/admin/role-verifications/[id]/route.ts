import { getSessionUser } from "../../../../auth";
import { createNotifications } from "../../../../notification-store";
import { requireAdmin } from "../../../../role-verification";
import {
  enforceRateLimit,
  getClientIp,
  readJsonObject,
  recordSecurityEvent,
  requestErrorResponse,
  RequestValidationError,
} from "../../../../security";
import { ensureSchema, getD1 } from "../../../../../db";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const adminError = requireAdmin(user.email);
  if (adminError) return adminError;

  try {
    await ensureSchema();
    const db = getD1();
    const rateError = await enforceRateLimit(db, {
      action: "role-verification-review",
      identifiers: [`user:${user.email}`, `ip:${getClientIp(request)}`],
      maximum: 100,
      windowSeconds: 60 * 60,
    });
    if (rateError) return rateError;

    const { id } = await context.params;
    const payload = await readJsonObject(request, 2_048);
    const action = payload.action;
    const reviewNote =
      typeof payload.reviewNote === "string"
        ? payload.reviewNote.trim().slice(0, 300)
        : "";

    if (action !== "approve" && action !== "reject") {
      throw new RequestValidationError("처리 방법이 올바르지 않아요.", 400);
    }
    if (action === "reject" && reviewNote.length < 5) {
      throw new RequestValidationError(
        "반려 사유를 다섯 글자 이상 입력해 주세요.",
        400,
      );
    }

    const verification = await db
      .prepare(
        `SELECT id, user_email, requested_role, status
         FROM role_verification_requests
         WHERE id = ?`,
      )
      .bind(id)
      .first<{
        id: string;
        user_email: string;
        requested_role: string;
        status: string;
      }>();

    if (!verification) {
      throw new RequestValidationError("인증 신청을 찾지 못했어요.", 404);
    }
    if (verification.status !== "pending") {
      throw new RequestValidationError("이미 처리된 신청이에요.", 409);
    }
    if (verification.user_email === user.email) {
      throw new RequestValidationError(
        "본인의 인증 신청은 직접 승인하거나 반려할 수 없어요.",
        403,
      );
    }

    const approved = action === "approve";
    await db.batch([
      db
        .prepare(
          `UPDATE role_verification_requests
           SET status = ?, reviewer_email = ?, review_note = ?,
               reviewed_at = CURRENT_TIMESTAMP,
               evidence_delete_after = datetime('now', '+7 days'),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND status = 'pending'`,
        )
        .bind(
          approved ? "approved" : "rejected",
          user.email,
          approved ? "" : reviewNote,
          verification.id,
        ),
      db
        .prepare(
          `UPDATE user_profiles
           SET campus_role = ?, role_verification_status = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE email = ? AND requested_campus_role = ?`,
        )
        .bind(
          approved ? verification.requested_role : "",
          approved ? "approved" : "rejected",
          verification.user_email,
          verification.requested_role,
        ),
    ]);

    await createNotifications([
      {
        userEmail: verification.user_email,
        type: "role_verification",
        title: approved ? "직위 인증이 완료됐어요" : "직위 인증을 다시 확인해 주세요",
        message: approved
          ? `${verification.requested_role} 인증이 완료되어 프로필 배지가 표시돼요.`
          : `인증이 반려됐어요. 사유: ${reviewNote}`,
        dedupeKey: `role-verification:${verification.id}:${action}`,
      },
    ]);

    await recordSecurityEvent(
      db,
      approved ? "role-verification-approved" : "role-verification-rejected",
      verification.user_email,
      request,
      verification.requested_role,
    );

    return Response.json({ reviewed: true, status: approved ? "approved" : "rejected" });
  } catch (error) {
    return requestErrorResponse(error);
  }
}
