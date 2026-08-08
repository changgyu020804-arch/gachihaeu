"use client";

import { FormEvent } from "react";

export type LoginSubmitHandler = (event: FormEvent<HTMLFormElement>) => void;

type EmailLoginFormProps = {
  email: string;
  error: string;
  loading: boolean;
  onEmailChange: (email: string) => void;
  onSubmit: LoginSubmitHandler;
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
  onSubmit: LoginSubmitHandler;
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
