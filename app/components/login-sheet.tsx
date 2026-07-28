"use client";

import { FormEvent, useState } from "react";
import { Viewer } from "../activity-data";
import { getErrorMessage } from "./utils";

type LoginSheetProps = {
  onClose: () => void;
  onLogin: (user: Viewer) => void;
};

export function LoginSheet({ onClose, onLogin }: LoginSheetProps) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSendCode = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "전송에 실패했어요.");
      setStep("code");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = (await res.json()) as { error?: string; email?: string; displayName?: string };
      if (!res.ok) throw new Error(data.error || "인증에 실패했어요.");
      onLogin({
        email: data.email || email,
        displayName: data.displayName || email.split("@")[0],
        fullName: data.displayName || null,
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section
        className="sheet login-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div>
            <p className="section-kicker">SIGN IN</p>
            <h2 id="login-title">서울시립대 이메일로 로그인</h2>
          </div>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        {step === "email" ? (
          <form onSubmit={handleSendCode}>
            <p className="login-description">
              서울시립대 학교 이메일(@uos.ac.kr)을 입력하면<br />
              인증코드를 보내드려요.
            </p>
            <label>
              학교 이메일
              <input
                required
                type="email"
                placeholder="example@uos.ac.kr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </label>
            {error && <div className="form-error">{error}</div>}
            <button className="primary-button" disabled={loading}>
              {loading ? "전송 중..." : "인증코드 받기"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode}>
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
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                autoFocus
                className="code-input"
              />
            </label>
            {error && <div className="form-error">{error}</div>}
            <button className="primary-button" disabled={loading || code.length !== 6}>
              {loading ? "확인 중..." : "로그인"}
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => { setStep("email"); setCode(""); setError(""); }}
            >
              다른 이메일로 시도
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
