import { CampusRole } from "@/lib/types/activity";

type CampusRoleBadgeProps = {
  role: string;
  compact?: boolean;
}; //새로운 타입 정의하기

const ROLE_CLASS: Record<CampusRole, string> = {
  학생: "student",
  교수: "professor",
  교직원: "staff",
}; //객체변수 만들기

export function CampusRoleBadge({
  role,
  compact = false,
}: CampusRoleBadgeProps) {
  const roleClass = ROLE_CLASS[role as CampusRole];

  if (!roleClass) return null;

  return (
    <span
      className={`campus-role-badge ${roleClass}${compact ? " compact" : ""}`}
      title={`교내 직위: ${role}`}
    >
      {role}
    </span>
  );
}
