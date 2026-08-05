import { env } from "cloudflare:workers";
import { isAdminEmail } from "./runtime-env";
import { VERIFIED_ROLES } from "./role-verification-types";
import type { VerifiedRole } from "./role-verification-types";

export { VERIFIED_ROLES } from "./role-verification-types";
export type { VerifiedRole } from "./role-verification-types";
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
