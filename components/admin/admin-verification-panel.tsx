"use client";

import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "@/lib/utils/ui";

type AdminVerificationRequest = {
  id: string;
  userEmail: string;
  nickname: string;
  department: string;
  requestedRole: string;
  documentType: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
};

type AdminVerificationPanelProps = {
  onClose: () => void;
  onToast: (message: string) => void;
};

function formatFileSize(value: number) {
  return value >= 1024 * 1024
    ? `${(value / (1024 * 1024)).toFixed(1)}MB`
    : `${Math.ceil(value / 1024)}KB`;
}

export function AdminVerificationPanel({
  onClose,
  onToast,
}: AdminVerificationPanelProps) {
  const [requests, setRequests] = useState<AdminVerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/role-verifications", {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        requests?: AdminVerificationRequest[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "인증 신청을 불러오지 못했어요.");
      }
      setRequests(payload.requests ?? []);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const review = async (
    item: AdminVerificationRequest,
    action: "approve" | "reject",
  ) => {
    let reviewNote = "";
    if (action === "approve") {
      if (!window.confirm(`${item.nickname} 님을 ${item.requestedRole}로 승인할까요?`)) {
        return;
      }
    } else {
      const entered = window.prompt(
        "사용자에게 전달할 반려 사유를 다섯 글자 이상 입력해 주세요.",
      );
      if (entered === null) return;
      reviewNote = entered.trim();
      if (reviewNote.length < 5) {
        window.alert("반려 사유를 다섯 글자 이상 입력해 주세요.");
        return;
      }
    }

    setSubmittingId(item.id);
    try {
      const response = await fetch(
        `/api/admin/role-verifications/${encodeURIComponent(item.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, reviewNote }),
        },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "인증 신청을 처리하지 못했어요.");
      }
      setRequests((current) => current.filter((request) => request.id !== item.id));
      onToast(action === "approve" ? "직위 인증을 승인했어요." : "직위 인증을 반려했어요.");
    } catch (reviewError) {
      onToast(getErrorMessage(reviewError));
    } finally {
      setSubmittingId("");
    }
  };

  return (
    <div className="admin-verification-panel">
      <div className="sheet-header">
        <div>
          <p className="section-kicker">ADMIN</p>
          <h2 id="profile-title">직위 인증 관리</h2>
        </div>
        <button className="close-button" onClick={onClose}>×</button>
      </div>

      <p className="admin-verification-notice">
        증빙자료는 인증 목적으로만 확인하고 내려받거나 별도로 보관하지 마세요.
        처리된 원본은 7일 뒤 삭제돼요.
      </p>

      {loading ? (
        <div className="profile-loading">인증 신청 불러오는 중...</div>
      ) : error ? (
        <div className="form-error">{error}</div>
      ) : requests.length === 0 ? (
        <div className="admin-verification-empty">확인할 인증 신청이 없어요.</div>
      ) : (
        <div className="admin-verification-list">
          {requests.map((item) => (
            <article key={item.id} className="admin-verification-item">
              <div className="admin-verification-user">
                <div>
                  <strong>{item.nickname}</strong>
                  <span className={`campus-role-badge ${item.requestedRole === "교수" ? "professor" : "staff"}`}>
                    {item.requestedRole}
                  </span>
                </div>
                <small>{item.userEmail}</small>
                {item.department && <small>{item.department}</small>}
              </div>
              <div className="admin-evidence-meta">
                <strong>{item.documentType}</strong>
                <span>{item.originalFilename} · {formatFileSize(item.sizeBytes)}</span>
              </div>
              <a
                className="admin-evidence-button"
                href={`/api/admin/role-verifications/${encodeURIComponent(item.id)}/evidence`}
                target="_blank"
                rel="noreferrer"
              >
                증빙자료 열기
              </a>
              <div className="admin-review-actions">
                <button
                  className="reject"
                  disabled={submittingId === item.id}
                  onClick={() => void review(item, "reject")}
                >
                  반려
                </button>
                <button
                  className="approve"
                  disabled={submittingId === item.id}
                  onClick={() => void review(item, "approve")}
                >
                  승인
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
