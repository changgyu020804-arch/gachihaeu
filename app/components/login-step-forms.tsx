"use client";

import { FormEvent } from "react";
import { CAMPUS_ROLES, DEPARTMENTS, GENDERS } from "../activity-data";
import { NicknameField } from "./nickname-field";

type SubmitHandler = (event: FormEvent<HTMLFormElement>) => void;

type EmailLoginFormProps = {
  email: string;
  error: string;
  loading: boolean;
  onEmailChange: (email: string) => void;
  onSubmit: SubmitHandler;
};

export function EmailLoginForm({
  email,
  error,
  loading,
  onEmailChange,
  onSubmit,
}: EmailLoginFormProps) {
  return (
    <form onSubmit={onSubmit}>
      <p className="login-description">
        처음 한 번만 학교 이메일을 인증하면<br />
        다음부터는 로그인 상태가 유지돼요.
      </p>
      <label>
        학교 이메일
        <input
          required
          type="email"
          placeholder="example@uos.ac.kr"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          autoFocus
        />
      </label>
      {error && <div className="form-error">{error}</div>}
      <button className="primary-button" disabled={loading}>
        {loading ? "전송 중..." : "인증코드 받기"}
      </button>
    </form>
  );
}

type VerificationCodeFormProps = {
  email: string;
  code: string;
  error: string;
  loading: boolean;
  onBack: () => void;
  onCodeChange: (code: string) => void;
  onSubmit: SubmitHandler;
};

export function VerificationCodeForm({
  email,
  code,
  error,
  loading,
  onBack,
  onCodeChange,
  onSubmit,
}: VerificationCodeFormProps) {
  return (
    <form onSubmit={onSubmit}>
      <p className="login-description">
        <strong>{email}</strong>으로<br />
        6자리 인증코드를 보냈어요.
      </p>
      <label>
        인증코드
        <input
          required
          type="text"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          placeholder="인증번호 6자리"
          value={code}
          onChange={(event) =>
            onCodeChange(event.target.value.replace(/\D/g, ""))
          }
          autoFocus
          className="code-input"
        />
      </label>
      {error && <div className="form-error">{error}</div>}
      <button
        className="primary-button"
        disabled={loading || code.length !== 6}
      >
        {loading ? "확인 중..." : "이메일 인증"}
      </button>
      <button type="button" className="text-button" onClick={onBack}>
        다른 이메일로 시도
      </button>
    </form>
  );
}

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
  onSubmit: SubmitHandler;
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
        <select
          required
          value={gender}
          onChange={(event) => onGenderChange(event.target.value)}
        >
          <option value="" disabled>성별 선택</option>
          {GENDERS.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </label>
      <label>
        직위
        <select
          required
          value={campusRole}
          onChange={(event) => onCampusRoleChange(event.target.value)}
        >
          <option value="" disabled>직위 선택</option>
          {CAMPUS_ROLES.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </label>
      <label>
        학과
        <select
          required
          value={department}
          onChange={(event) => onDepartmentChange(event.target.value)}
        >
          <option value="" disabled>학과 선택</option>
          {DEPARTMENTS.filter((item) => item !== "선택 안함").map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </label>
      <p className="profile-privacy-note">
        성별 정보는 현재 내 프로필에서만 확인할 수 있어요.
      </p>
      {error && <div className="form-error">{error}</div>}
      <button className="primary-button" disabled={loading}>
        {loading ? "저장 중..." : "프로필 만들고 시작하기"}
      </button>
    </form>
  );
}
