export const VERIFIED_ROLES = ["교수", "교직원"] as const;
export const VERIFICATION_DOCUMENT_TYPES = [
  "교수증",
  "교직원증",
  "재직증명서",
  "기타 재직 증빙자료",
] as const;

export type VerifiedRole = (typeof VERIFIED_ROLES)[number];
export type VerificationDocumentType =
  (typeof VERIFICATION_DOCUMENT_TYPES)[number];
export type RoleVerificationStatus =
  | "not_required"
  | "not_submitted"
  | "pending"
  | "approved"
  | "rejected";
