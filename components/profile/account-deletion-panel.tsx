"use client";

import { FormEvent, useState } from "react";
import { getErrorMessage } from "@/lib/utils/ui";

type AccountDeletionPanelProps = {
  email: string;
  onCancel: () => void;
  onDeleted: () => void;
};

export function AccountDeletionPanel({
  email,
  onCancel,
  onDeleted,
}: AccountDeletionPanelProps) {
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (confirmation !== "탈퇴") return;

    setDeleting(true);
    setError("");
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "회원 탈퇴를 처리하지 못했어요.");
      }
      onDeleted();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="account-deletion-panel">
      <div className="sheet-header">
        <div>
          <p className="section-kicker danger-kicker">DELETE ACCOUNT</p>
          <h2 id="profile-title">회원 탈퇴</h2>
        </div>
        <button
          type="button"
          className="close-button"
          onClick={onCancel}
          aria-label="회원 탈퇴 취소"
        >
          ×
        </button>
      </div>

      <div className="account-deletion-warning" role="alert">
        <strong>삭제한 계정은 복구할 수 없어요.</strong>
        <ul>
          <li>프로필과 학교 이메일 정보가 삭제돼요.</li>
          <li>만든 모임과 참여·대기 기록이 삭제돼요.</li>
          <li>평가, 코멘트, 알림, 신고·차단 기록이 삭제돼요.</li>
          <li>처리가 끝나면 모든 기기에서 다시 로그인해야 해요.</li>
        </ul>
      </div>

      <form onSubmit={handleDelete} className="account-deletion-form">
        <p>
          계정 <strong>{email}</strong>을 삭제하려면 아래에
          <strong> 탈퇴</strong>라고 입력해 주세요.
        </p>
        <label>
          확인 문구
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder="탈퇴"
            autoComplete="off"
            disabled={deleting}
          />
        </label>
        {error && <div className="form-error">{error}</div>}
        <div className="account-deletion-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            취소
          </button>
          <button
            className="delete-account-confirm-button"
            disabled={confirmation !== "탈퇴" || deleting}
          >
            {deleting ? "삭제하는 중..." : "계정 영구 삭제"}
          </button>
        </div>
      </form>
    </div>
  );
}
