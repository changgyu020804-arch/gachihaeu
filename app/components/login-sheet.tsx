"use client";

import { FormEvent, useState } from "react";
import { Viewer } from "../activity-data";
import {
  EmailLoginForm,
  ProfileSetupForm,
  VerificationCodeForm,
} from "./login-step-forms";
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
          <EmailLoginForm
            email={email}
            error={error}
            loading={loading}
            onEmailChange={setEmail}
            onSubmit={handleSendCode}
          />
        )}

        {step === "code" && (
          <VerificationCodeForm
            email={email}
            code={code}
            error={error}
            loading={loading}
            onCodeChange={setCode}
            onSubmit={handleVerifyCode}
            onBack={() => {
              setStep("email");
              setCode("");
              setError("");
            }}
          />
        )}

        {step === "profile" && (
          <ProfileSetupForm
            nickname={nickname}
            gender={gender}
            campusRole={campusRole}
            department={department}
            error={error}
            loading={loading}
            onNicknameChange={setNickname}
            onGenderChange={setGender}
            onCampusRoleChange={setCampusRole}
            onDepartmentChange={setDepartment}
            onSubmit={handleCreateProfile}
          />
        )}
      </section>
    </div>
  );
}
