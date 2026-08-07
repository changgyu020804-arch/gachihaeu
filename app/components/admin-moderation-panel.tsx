"use client";

import { useCallback, useEffect, useState } from "react";
import {
  MODERATION_ACTION_OPTIONS,
  type ActiveSanction,
  type ModerationReport,
} from "../moderation-types";
import { getErrorMessage } from "./utils";

const TYPE_LABEL = {
  activity: "모임",
  comment: "댓글",
  user: "사용자",
  rating: "평가 코멘트",
};

type Props = { onClose: () => void; onToast: (message: string) => void };

export function AdminModerationPanel({ onClose, onToast }: Props) {
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [sanctions, setSanctions] = useState<ActiveSanction[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/moderation", { cache: "no-store" });
      const payload = (await response.json()) as {
        reports?: ModerationReport[];
        sanctions?: ActiveSanction[];
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "신고를 불러오지 못했어요.");
      setReports(payload.reports ?? []);
      setSanctions(payload.sanctions ?? []);
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

  const moderate = async (report: ModerationReport, action: string) => {
    let note = "문제없음으로 확인했습니다.";
    if (action !== "dismiss") {
      const entered = window.prompt("조치 사유를 다섯 글자 이상 입력해 주세요.");
      if (entered === null) return;
      note = entered.trim();
      if (note.length < 5) {
        window.alert("조치 사유를 다섯 글자 이상 입력해 주세요.");
        return;
      }
    } else if (!window.confirm("이 신고를 문제없음으로 처리할까요?")) {
      return;
    }

    setSubmittingId(report.id);
    try {
      const response = await fetch("/api/admin/moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportType: report.type, reportId: report.id, action, note }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "신고를 처리하지 못했어요.");
      onToast("운영 조치를 저장했어요.");
      await load();
    } catch (moderationError) {
      onToast(getErrorMessage(moderationError));
    } finally {
      setSubmittingId("");
    }
  };

  const pending = reports.filter((item) => !item.resolution);

  return (
    <div className="admin-moderation-panel">
      <div className="sheet-header">
        <div>
          <p className="section-kicker">ADMIN SAFETY</p>
          <h2 id="profile-title">신고·제재 관리</h2>
        </div>
        <button className="close-button" onClick={onClose}>×</button>
      </div>

      <p className="admin-verification-notice">
        신고 내용과 앞뒤 상황을 확인한 뒤 최소한의 필요한 조치만 적용해 주세요.
        모든 처리는 운영 기록으로 남아요.
      </p>

      {loading ? (
        <div className="profile-loading">신고 불러오는 중...</div>
      ) : error ? (
        <div className="form-error">{error}</div>
      ) : (
        <>
          <div className="moderation-summary">
            <div><strong>{pending.length}</strong><span>처리 대기</span></div>
            <div><strong>{sanctions.length}</strong><span>현재 제재</span></div>
          </div>
          <h3 className="moderation-section-title">처리할 신고</h3>
          {pending.length === 0 ? (
            <div className="admin-verification-empty">처리할 신고가 없어요.</div>
          ) : (
            <div className="admin-verification-list">
              {pending.map((report) => (
                <article className="moderation-item" key={`${report.type}:${report.id}`}>
                  <div className="moderation-item-top">
                    <span>{TYPE_LABEL[report.type]}</span>
                    <time>{new Date(report.createdAt).toLocaleDateString("ko-KR")}</time>
                  </div>
                  <strong>{report.reason}</strong>
                  <p>{report.content}</p>
                  <small>대상 {report.targetEmail}</small>
                  <small>신고자 {report.reporterEmail}</small>
                  <div className="moderation-actions">
                    {MODERATION_ACTION_OPTIONS.filter(([value]) => !(report.type === "user" && value === "hide_content")).map(([value, label]) => (
                      <button
                        key={value}
                        disabled={submittingId === report.id}
                        className={value === "ban" ? "danger" : ""}
                        onClick={() => void moderate(report, value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}

          <h3 className="moderation-section-title">현재 적용 중인 제재</h3>
          {sanctions.length === 0 ? (
            <div className="admin-verification-empty">적용 중인 제재가 없어요.</div>
          ) : (
            <div className="sanction-list">
              {sanctions.map((sanction) => (
                <article key={sanction.id}>
                  <strong>{sanction.userEmail}</strong>
                  <span>{sanction.kind === "banned" ? "영구 제한" : sanction.kind === "suspended" ? "일시 정지" : "경고"}</span>
                  <p>{sanction.reason}</p>
                  {sanction.expiresAt && <small>{new Date(sanction.expiresAt).toLocaleString("ko-KR")}까지</small>}
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
