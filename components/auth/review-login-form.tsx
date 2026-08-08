"use client";

import { FormEvent, useState } from "react";
import { Viewer } from "@/lib/types/activity";
import { getErrorMessage } from "@/lib/utils/ui";

type ReviewLoginFormProps = {
  onBack: () => void;
  onLogin: (user: Viewer) => void;
};

export function ReviewLoginForm({ onBack, onLogin }: ReviewLoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/review-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json()) as { error?: string; user?: Viewer };
      if (!response.ok || !payload.user) {
        throw new Error(payload.error || "심사용 계정으로 로그인하지 못했어요.");
      }
      onLogin(payload.user);
    } catch (reviewError) {
      setError(getErrorMessage(reviewError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <p className="login-description">
        App Store 심사 담당자에게 제공된 전용 계정으로 로그인해요.
        실제 학생의 모임과 개인정보는 표시되지 않아요.
      </p>
      <label>
        심사용 아이디
        <input
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          autoFocus
        />
      </label>
      <label>
        비밀번호
        <input
          required
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />
      </label>
      {error && <div className="form-error">{error}</div>}
      <button className="primary-button" disabled={loading}>
        {loading ? "로그인 중..." : "심사용 계정 로그인"}
      </button>
      <button type="button" className="text-button" onClick={onBack}>
        학교 이메일 로그인으로 돌아가기
      </button>
    </form>
  );
}
