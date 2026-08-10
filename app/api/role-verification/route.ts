import { getSessionUser } from "@/server/auth/session";
import {
  enforceRateLimit,
  recordSecurityEvent,
  requestErrorResponse,
  RequestValidationError,
} from "@/server/security/request";
import {
  getRoleEvidenceBucket,
  isVerifiedRole,
} from "@/server/services/role-verification";
import { cleanupExpiredRoleEvidence } from "@/server/services/role-evidence-cleanup";
import { readRoleEvidenceUpload } from "@/server/services/role-evidence-upload";
import { getD1 } from "@/db/index";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const db = getD1();
  await cleanupExpiredRoleEvidence(db, getRoleEvidenceBucket());

  const [profile, latest] = await Promise.all([
    db
      .prepare(
        `SELECT campus_role, requested_campus_role, role_verification_status
         FROM user_profiles
         WHERE email = ?`,
      )
      .bind(user.email)
      .first<{
        campus_role: string;
        requested_campus_role: string;
        role_verification_status: string;
      }>(),
    db
      .prepare(
        `SELECT id, requested_role, document_type, original_filename, status,
                review_note, created_at, reviewed_at
         FROM role_verification_requests
         WHERE user_email = ?
         ORDER BY created_at DESC
         LIMIT 1`,
      )
      .bind(user.email)
      .first<{
        id: string;
        requested_role: string;
        document_type: string;
        original_filename: string;
        status: string;
        review_note: string;
        created_at: string;
        reviewed_at: string | null;
      }>(),
  ]);

  return Response.json({
    verification: {
      publicRole: profile?.campus_role || "",
      requestedRole:
        profile?.requested_campus_role || profile?.campus_role || "",
      status: profile?.role_verification_status || "not_required",
      latestRequest: latest
        ? {
            id: latest.id,
            requestedRole: latest.requested_role,
            documentType: latest.document_type,
            originalFilename: latest.original_filename,
            status: latest.status,
            reviewNote: latest.status === "rejected" ? latest.review_note : "",
            createdAt: latest.created_at,
            reviewedAt: latest.reviewed_at,
          }
        : null,
    },
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  try {
    const db = getD1();
    const bucket = getRoleEvidenceBucket();
    await cleanupExpiredRoleEvidence(db, bucket);

    const rateError = await enforceRateLimit(db, {
      action: "role-verification-submit",
      identifiers: [`user:${user.email}`],
      maximum: 3,
      windowSeconds: 7 * 24 * 60 * 60,
    });
    if (rateError) return rateError;

    const profile = await db
      .prepare(
        `SELECT requested_campus_role, role_verification_status,
                onboarding_completed
         FROM user_profiles
         WHERE email = ?`,
      )
      .bind(user.email)
      .first<{
        requested_campus_role: string;
        role_verification_status: string;
        onboarding_completed: number;
      }>();

    if (!profile?.onboarding_completed) {
      throw new RequestValidationError("프로필을 먼저 완성해 주세요.", 400);
    }
    if (!isVerifiedRole(profile.requested_campus_role)) {
      throw new RequestValidationError(
        "프로필에서 교수 또는 교직원을 먼저 선택해 주세요.",
        400,
      );
    }
    if (profile.role_verification_status === "pending") {
      throw new RequestValidationError("이미 확인 중인 신청이 있어요.", 409);
    }
    if (profile.role_verification_status === "approved") {
      throw new RequestValidationError("이미 인증이 완료됐어요.", 409);
    }

    const evidence = await readRoleEvidenceUpload(request);

    const requestId = crypto.randomUUID();
    const objectKey = `role-verifications/${requestId}`;

    await bucket.put(objectKey, evidence.bytes, {
      httpMetadata: { contentType: evidence.contentType },
      customMetadata: {
        requestId,
        sha256: evidence.sha256,
      },
    });

    try {
      await db.batch([
        db
          .prepare(
            `INSERT INTO role_verification_requests (
               id, user_email, requested_role, document_type,
               original_filename, content_type, size_bytes, object_key
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            requestId,
            user.email,
            profile.requested_campus_role,
            evidence.documentType,
            evidence.originalFilename,
            evidence.contentType,
            evidence.sizeBytes,
            objectKey,
          ),
        db
          .prepare(
            `UPDATE user_profiles
             SET campus_role = '',
                 role_verification_status = 'pending',
                 updated_at = CURRENT_TIMESTAMP
             WHERE email = ?`,
          )
          .bind(user.email),
      ]);
    } catch (error) {
      await bucket.delete(objectKey);
      throw error;
    }

    await recordSecurityEvent(
      db,
      "role-verification-submitted",
      user.email,
      request,
      profile.requested_campus_role,
    );

    return Response.json(
      { submitted: true, status: "pending" },
      { status: 201 },
    );
  } catch (error) {
    return requestErrorResponse(error);
  }
}
