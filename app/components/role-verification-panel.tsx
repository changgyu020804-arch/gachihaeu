"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { VERIFICATION_DOCUMENT_TYPES } from "../role-verification-types";
import type { RoleVerificationStatus } from "../role-verification-types";
import { getErrorMessage } from "./utils";

type LatestVerificationRequest = {
  id: string;
  requestedRole: string;
  documentType: string;
  originalFilename: string;
  status: string;
  reviewNote: string;
  createdAt: string;
  reviewedAt: string | null;
};

type VerificationState = {
  publicRole: string;
  requestedRole: string;
  status: RoleVerificationStatus;
  latestRequest: LatestVerificationRequest | null;
};

type RoleVerificationPanelProps = {
  requestedRole: string;
  status: RoleVerificationStatus;
  onChanged: () => Promise<void>;
  onToast: (message: string) => void;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value.endsWith("Z") ? value : `${value.replace(" ", "T")}Z`));
}

export function RoleVerificationPanel({
  requestedRole,
  status,
  onChanged,
  onToast,
}: RoleVerificationPanelProps) {
  const [verification, setVerification] = useState<VerificationState | null>(null);
  const [documentType, setDocumentType] = useState(
    VERIFICATION_DOCUMENT_TYPES[0],
  );
  const [evidence, setEvidence] = useState<File | null>(null);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/role-verification", {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        verification?: VerificationState;
      };
      if (response.ok && payload.verification) {
        setVerification(payload.verification);
      }
    } catch {
      // 프로필의 상태를 기본값으로 사용한다.
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (requestedRole !== "교수" && requestedRole !== "교직원") return null;

  const currentStatus = verification?.status ?? status;
  const latestRequest = verification?.latestRequest ?? null;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!evidence) {
      setError("증빙자료를 선택해 주세요.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const body = new FormData();
      body.set("documentType", documentType);
      body.set("evidence", evidence);
      body.set("privacyAgreed", String(privacyAgreed));
      const response = await fetch("/api/role-verification", {
        method: "POST",
        body,
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "인증자료를 제출하지 못했어요.");
      }
      setEvidence(null);
      onToast("증빙자료를 제출했어요. 운영자가 확인한 뒤 알려드릴게요.");
      await Promise.all([load(), onChanged()]);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className={`role-verification-card status-${currentStatus}`}>
      <div className="role-verification-heading">
        <div>
          <span>직위 인증</span>
          <h3>{requestedRole} 증빙 확인</h3>
        </div>
        <strong>
          {currentStatus === "approved"
            ? "승인 완료"
            : currentStatus === "pending"
              ? "확인 중"
              : currentStatus === "rejected"
                ? "재제출 필요"
                : "인증 필요"}
        </strong>
      </div>

      {currentStatus === "approved" ? (
        <p className="verification-message">
          인증이 완료되어 다른 사용자에게 {requestedRole} 배지가 표시돼요.
        </p>
      ) : currentStatus === "pending" ? (
        <div className="verification-message">
          <p>운영자가 증빙자료를 확인하고 있어요.</p>
          {latestRequest && (
            <small>
              {latestRequest.documentType} · {formatDate(latestRequest.createdAt)} 제출
            </small>
          )}
        </div>
      ) : (
        <form className="verification-form" onSubmit={submit}>
          {currentStatus === "rejected" && latestRequest?.reviewNote && (
            <div className="verification-rejection">
              <strong>반려 사유</strong>
              <p>{latestRequest.reviewNote}</p>
            </div>
          )}
          <p>
            교수증·교직원증·재직증명서 중 하나를 올려 주세요. 이름,
            서울시립대학교, 직위만 보이면 되고 주민번호·사번·주소는 가려도 돼요.
          </p>
          <label>
            증빙자료 종류
            <select
              value={documentType}
              disabled={submitting}
              onChange={(event) => setDocumentType(event.target.value)}
            >
              {VERIFICATION_DOCUMENT_TYPES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="evidence-file-field">
            사진 또는 PDF
            <input
              required
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              disabled={submitting}
              onChange={(event) => setEvidence(event.target.files?.[0] ?? null)}
            />
            <small>JPG, PNG, PDF · 최대 5MB</small>
          </label>
          <label className="verification-consent">
            <input
              required
              type="checkbox"
              checked={privacyAgreed}
              disabled={submitting}
              onChange={(event) => setPrivacyAgreed(event.target.checked)}
            />
            <span>
              개인정보 처리 안내: 직위 확인을 위해 운영자가 자료를 열람하며,
              처리 7일 뒤 원본이 삭제되는 것에 동의합니다.
            </span>
          </label>
          {error && <div className="form-error">{error}</div>}
          <button
            className="verification-submit-button"
            disabled={submitting || !evidence || !privacyAgreed}
          >
            {submitting ? "안전하게 제출 중..." : "인증자료 제출"}
          </button>
        </form>
      )}
    </section>
  );
}
