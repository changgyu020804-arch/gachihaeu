import { env } from "cloudflare:workers";
import { isAdminEmail } from "./runtime-env";

export const VERIFIED_ROLES = ["교수", "교직원"] as const;
export const VERIFICATION_DOCUMENT_TYPES = [
  "교수증",
  "교직원증",
  "재직증명서",
  "기타 재직 증빙자료",
] as const;

export type VerifiedRole = (typeof VERIFIED_ROLES)[number];
export type RoleVerificationStatus =
  | "not_required"
  | "not_submitted"
  | "pending"
  | "approved"
  | "rejected";

type RoleEvidenceEnvironment = {
  ROLE_EVIDENCE?: R2Bucket;
};

const roleEvidenceEnvironment = env as unknown as RoleEvidenceEnvironment;

export function getRoleEvidenceBucket() {
  if (!roleEvidenceEnvironment.ROLE_EVIDENCE) {
    throw new Error(
      "Cloudflare R2 binding `ROLE_EVIDENCE` is unavailable. Set the `r2` field in .openai/hosting.json to `ROLE_EVIDENCE`.",
    );
  }
  return roleEvidenceEnvironment.ROLE_EVIDENCE;
}

export function isVerifiedRole(value: unknown): value is VerifiedRole {
  return (
    typeof value === "string" &&
    VERIFIED_ROLES.includes(value as VerifiedRole)
  );
}

export function requireAdmin(email: string) {
  if (!isAdminEmail(email)) {
    return Response.json(
      { error: "운영자 권한이 필요해요." },
      { status: 403 },
    );
  }
  return null;
}

export async function cleanupExpiredRoleEvidence(db: D1Database) {
  const expired = await db
    .prepare(
      `SELECT id, object_key
       FROM role_verification_requests
       WHERE evidence_deleted_at IS NULL
         AND evidence_delete_after IS NOT NULL
         AND datetime(evidence_delete_after) <= datetime('now')
       LIMIT 50`,
    )
    .all<{ id: string; object_key: string }>();

  if (expired.results.length === 0) return;

  const bucket = getRoleEvidenceBucket();
  await bucket.delete(expired.results.map((item) => item.object_key));
  await db.batch(
    expired.results.map((item) =>
      db
        .prepare(
          `UPDATE role_verification_requests
           SET evidence_deleted_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .bind(item.id),
    ),
  );
}

export function roleVerificationStatusLabel(status: RoleVerificationStatus) {
  switch (status) {
    case "pending":
      return "확인 중";
    case "approved":
      return "승인 완료";
    case "rejected":
      return "인증 반려";
    case "not_submitted":
      return "인증 필요";
    default:
      return "";
  }
}
