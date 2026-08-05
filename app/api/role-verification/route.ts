import { getSessionUser } from "../../auth";
import {
  enforceRateLimit,
  recordSecurityEvent,
  requestErrorResponse,
  RequestValidationError,
} from "../../security";
import {
  cleanupExpiredRoleEvidence,
  getRoleEvidenceBucket,
  isVerifiedRole,
  VERIFICATION_DOCUMENT_TYPES,
} from "../../role-verification";
import { ensureSchema, getD1 } from "../../../db";

const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_EVIDENCE_BYTES + 512 * 1024;

function safeFilename(value: string) {
  const cleaned = value
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
    .trim();
  return (cleaned || "증빙자료").slice(0, 120);
}

function detectedContentType(bytes: Uint8Array) {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return "application/pdf";
  }
  return "";
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  await ensureSchema();
  const db = getD1();
  await cleanupExpiredRoleEvidence(db);

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
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (!Number.isFinite(contentLength) || contentLength > MAX_REQUEST_BYTES) {
      throw new RequestValidationError("파일은 5MB 이하로 올려 주세요.", 413);
    }

    await ensureSchema();
    const db = getD1();
    await cleanupExpiredRoleEvidence(db);

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

    const formData = await request.formData();
    const evidence = formData.get("evidence");
    const documentType = formData.get("documentType");
    const privacyAgreed = formData.get("privacyAgreed");

    if (!(evidence instanceof File) || evidence.size === 0) {
      throw new RequestValidationError("증빙자료를 선택해 주세요.", 400);
    }
    if (evidence.size > MAX_EVIDENCE_BYTES) {
      throw new RequestValidationError("파일은 5MB 이하로 올려 주세요.", 413);
    }
    if (
      typeof documentType !== "string" ||
      !VERIFICATION_DOCUMENT_TYPES.includes(documentType as never)
    ) {
      throw new RequestValidationError("증빙자료 종류를 선택해 주세요.", 400);
    }
    if (privacyAgreed !== "true") {
      throw new RequestValidationError("개인정보 처리 안내에 동의해 주세요.", 400);
    }

    const bytes = new Uint8Array(await evidence.arrayBuffer());
    const contentType = detectedContentType(bytes);
    if (!contentType) {
      throw new RequestValidationError(
        "JPG, PNG 또는 PDF 파일만 올릴 수 있어요.",
        415,
      );
    }

    const requestId = crypto.randomUUID();
    const objectKey = `role-verifications/${requestId}`;
    const digest = bytesToHex(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    );
    const bucket = getRoleEvidenceBucket();

    await bucket.put(objectKey, bytes, {
      httpMetadata: { contentType },
      customMetadata: {
        requestId,
        sha256: digest,
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
            documentType,
            safeFilename(evidence.name),
            contentType,
            evidence.size,
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
