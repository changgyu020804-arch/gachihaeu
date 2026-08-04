"use client";

import { FormEvent, useState } from "react";
import {
  CAMPUS_ROLES,
  DEPARTMENTS,
  GENDERS,
  Viewer,
} from "../activity-data";
import { getErrorMessage } from "./utils";

type LoginSheetProps = {
  existingUser?: Viewer | null;
  onClose: () => void;
  onLogin: (user: Viewer) => void;
};

type LoginStep = "email" | "code" | "profile";

export function LoginSheet({
  existingUser = null,
  onClose,
  onLogin,
}: LoginSheetProps) {
  const needsProfile = Boolean(existingUser && !existingUser.onboardingComplete);
  const [step, setStep] = useState<LoginStep>(
    needsProfile ? "profile" : "email",
  );
  const [pendingUser, setPendingUser] = useState<Viewer | null>(
    needsProfile ? existingUser : null,
  );
  const [email, setEmail] = useState(existingUser?.email ?? "");
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState(
    needsProfile ? existingUser?.displayName ?? "" : "",
  );
  const [gender, setGender] = useState("");
  const [campusRole, setCampusRole] = useState("");
  const [department, setDepartment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSendCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "전송에 실패했어요.");
      }
      setStep("code");
    } catch (sendError) {
      setError(getErrorMessage(sendError));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const payload = (await response.json()) as {
        error?: string;
        email?: string;
        displayName?: string;
        gender?: string;
        campusRole?: string;
        department?: string;
        onboardingComplete?: boolean;
      };
      if (!response.ok) {
        throw new Error(payload.error || "인증에 실패했어요.");
      }

      const verifiedUser: Viewer = {
        email: payload.email || email,
        displayName: payload.displayName || email.split("@")[0],
        fullName: payload.displayName || null,
        onboardingComplete: Boolean(payload.onboardingComplete),
      };
      if (verifiedUser.onboardingComplete) {
        onLogin(verifiedUser);
        return;
      }

      setPendingUser(verifiedUser);
      setNickname(verifiedUser.displayName);
      setGender(payload.gender || "");
      setCampusRole(payload.campusRole || "");
      setDepartment(payload.department || "");
      setStep("profile");
    } catch (verifyError) {
      setError(getErrorMessage(verifyError));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pendingUser) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname,
          gender,
          campusRole,
          department,
          bio: "",
          preferredSports: [],
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        user?: Viewer;
      };
      if (!response.ok) {
        throw new Error(payload.error || "프로필을 저장하지 못했어요.");
      }
      onLogin(
        payload.user ?? {
          ...pendingUser,
          displayName: nickname,
          fullName: nickname,
          onboardingComplete: true,
        },
      );
    } catch (profileError) {
      setError(getErrorMessage(profileError));
    } finally {
      setLoading(false);
    }
  };

  const isProfileStep = step === "profile";

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section
        className="sheet login-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div>
            <p className="section-kicker">
              {isProfileStep ? "WELCOME" : "SIGN IN"}
            </p>
            <h2 id="login-title">
              {isProfileStep
                ? "내 프로필 만들기"
                : "서울시립대 이메일로 로그인"}
            </h2>
          </div>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        {step === "email" && (
          <form onSubmit={handleSendCode}>
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
                onChange={(event) => setEmail(event.target.value)}
                autoFocus
              />
            </label>
            {error && <div className="form-error">{error}</div>}
            <button className="primary-button" disabled={loading}>
              {loading ? "전송 중..." : "인증코드 받기"}
            </button>
          </form>
        )}

        {step === "code" && (
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
                placeholder="인증번호 6자리"
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, ""))
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
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setStep("email");
                setCode("");
                setError("");
              }}
            >
              다른 이메일로 시도
            </button>
          </form>
        )}

        {step === "profile" && (
          <form className="onboarding-form" onSubmit={handleCreateProfile}>
            <p className="login-description">
              학교 인증이 완료됐어요. 같이 운동할 친구들에게 보여줄
              기본 정보를 정해 주세요.
            </p>
            <label>
              닉네임
              <input
                required
                maxLength={20}
                value={nickname}
                placeholder="캠퍼스에서 불릴 이름"
                onChange={(event) => setNickname(event.target.value)}
                autoFocus
              />
            </label>
            <label>
              성별
              <select
                required
                value={gender}
                onChange={(event) => setGender(event.target.value)}
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
                onChange={(event) => setCampusRole(event.target.value)}
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
                onChange={(event) => setDepartment(event.target.value)}
              >
                <option value="" disabled>학과 선택</option>
                {DEPARTMENTS.filter((item) => item !== "선택 안함").map(
                  (item) => (
                    <option key={item} value={item}>{item}</option>
                  ),
                )}
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
        )}
      </section>
    </div>
  );
}
