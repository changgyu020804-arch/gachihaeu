import { RequestValidationError } from "@/server/security/request";

export type CurrentProfileRole = {
  campus_role: string;
  requested_campus_role: string;
  role_verification_status: string;
} | null;

export type ResolvedProfileRole = {
  publicCampusRole: string;
  requestedCampusRole: string;
  roleVerificationStatus: string;
};

export function resolveProfileRole(
  selectedRole: string,
  currentRole: CurrentProfileRole,
): ResolvedProfileRole {
  if (
    currentRole?.role_verification_status === "pending" &&
    currentRole.requested_campus_role !== selectedRole
  ) {
    throw new RequestValidationError(
      "직위 인증을 확인 중일 때는 직위를 변경할 수 없어요.",
      409,
    );
  }

  if (selectedRole === "학생") {
    return {
      publicCampusRole: "학생",
      requestedCampusRole: "학생",
      roleVerificationStatus: "not_required",
    };
  }

  const keepsApprovedRole =
    currentRole?.campus_role === selectedRole &&
    currentRole.role_verification_status === "approved";
  const keepsExistingRequest =
    currentRole?.requested_campus_role === selectedRole &&
    ["not_submitted", "pending", "rejected"].includes(
      currentRole.role_verification_status,
    );

  return {
    publicCampusRole: keepsApprovedRole ? selectedRole : "",
    requestedCampusRole: selectedRole,
    roleVerificationStatus: keepsApprovedRole
      ? "approved"
      : keepsExistingRequest
        ? currentRole.role_verification_status
        : "not_submitted",
  };
}
