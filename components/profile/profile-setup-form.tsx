"use client";

import { CAMPUS_ROLES, DEPARTMENTS, GENDERS } from "@/lib/types/activity";
import { LoginSubmitHandler } from "@/components/auth/email-login-forms";
import { NicknameField } from "@/components/profile/nickname-field";

type ProfileSetupFormProps = {
  nickname: string;
  gender: string;
  campusRole: string;
  department: string;
  error: string;
  loading: boolean;
  onNicknameChange: (nickname: string) => void;
  onGenderChange: (gender: string) => void;
  onCampusRoleChange: (campusRole: string) => void;
  onDepartmentChange: (department: string) => void;
  onSubmit: LoginSubmitHandler;
};

export function ProfileSetupForm({
  nickname,
  gender,
  campusRole,
  department,
  error,
  loading,
  onNicknameChange,
  onGenderChange,
  onCampusRoleChange,
  onDepartmentChange,
  onSubmit,
}: ProfileSetupFormProps) {
  return (
    <form className="onboarding-form" onSubmit={onSubmit}>
      <p className="login-description">
        학교 인증이 완료됐어요. 같이 운동할 친구들에게 보여줄 기본 정보를
        정해 주세요.
      </p>
      <NicknameField
        value={nickname}
        onChange={onNicknameChange}
        disabled={loading}
        autoFocus
      />
      <label>
        성별
        <select required value={gender} onChange={(event) => onGenderChange(event.target.value)}>
          <option value="" disabled>성별 선택</option>
          {GENDERS.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <label>
        직위
        <select required value={campusRole} onChange={(event) => onCampusRoleChange(event.target.value)}>
          <option value="" disabled>직위 선택</option>
          {CAMPUS_ROLES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      {campusRole !== "" && campusRole !== "학생" && (
        <p className="role-verification-note">
          프로필 생성 후 교수증·교직원증·재직증명서를 제출하면 운영자가 직위를
          확인해 드려요. 승인 전에는 직위 배지가 공개되지 않아요.
        </p>
      )}
      <label>
        학과
        <select required value={department} onChange={(event) => onDepartmentChange(event.target.value)}>
          <option value="" disabled>학과 선택</option>
          {DEPARTMENTS.filter((item) => item !== "선택 안함").map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </label>
      <p className="profile-privacy-note">성별 정보는 현재 내 프로필에서만 확인할 수 있어요.</p>
      {error && <div className="form-error">{error}</div>}
      <button className="primary-button" disabled={loading}>
        {loading ? "저장 중..." : "프로필 만들고 시작하기"}
      </button>
    </form>
  );
}
