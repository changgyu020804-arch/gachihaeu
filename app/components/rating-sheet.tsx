"use client";

import { useCallback, useEffect, useState } from "react";
import { ParticipantInfo } from "../activity-data";
import { getErrorMessage } from "./utils";

type RatingSheetProps = {
  activityId: string;
  currentUserEmail: string;
  onClose: () => void;
  onToast: (msg: string) => void;
  onViewProfile: (email: string) => void;
};

export function RatingSheet({ activityId, currentUserEmail, onClose, onToast, onViewProfile }: RatingSheetProps) {
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [scores, setScores] = useState<
    Record<string, { trust: number; skill: number; manner: number; comment: string }>
  >({});

  const loadParticipants = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/activities/${activityId}/participants`, { cache: "no-store" });
      const payload = (await response.json()) as { participants?: ParticipantInfo[] };
      const list = (payload.participants ?? []).filter((p) => p.email !== currentUserEmail);
      setParticipants(list);
    } catch {
      setParticipants([]);
    } finally {
      setLoading(false);
    }
  }, [activityId, currentUserEmail]);

  useEffect(() => {
    void loadParticipants();
  }, [loadParticipants]);

  const submitRating = async (ratedEmail: string) => {
    const s = scores[ratedEmail];
    if (!s || s.trust === 0 || s.skill === 0 || s.manner === 0) {
      onToast("모든 항목에 별점을 매겨 주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityId,
          ratedEmail,
          trustScore: s.trust,
          skillScore: s.skill,
          mannerScore: s.manner,
          comment: s.comment,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "평가를 저장하지 못했어요.");
      onToast("평가가 저장됐어요!");
      setParticipants((prev) =>
        prev.map((p) => (p.email === ratedEmail ? { ...p, hasRated: true } : p)),
      );
    } catch (err) {
      onToast(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section
        className="sheet rate-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rate-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div>
            <p className="section-kicker">RATE TEAMMATES</p>
            <h2 id="rate-title">함께한 메이트 평가</h2>
          </div>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        {loading ? (
          <div className="profile-loading">참여자 불러오는 중...</div>
        ) : participants.length === 0 ? (
          <div className="profile-loading">평가할 참여자가 없어요.</div>
        ) : (
          participants.map((participant) => {
            const s = scores[participant.email] || { trust: 0, skill: 0, manner: 0, comment: "" };
            return (
              <div className="rate-participant" key={participant.email}>
                <div className="rate-participant-header">
                  <div
                    className="rate-participant-avatar"
                    onClick={() => onViewProfile(participant.email)}
                    style={{ cursor: "pointer" }}
                  >
                    {participant.nickname.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="rate-participant-info" onClick={() => onViewProfile(participant.email)} style={{ cursor: "pointer" }}>
                    <strong>{participant.nickname}</strong>
                    <small>{participant.department || "학과 미설정"}</small>
                  </div>
                  {participant.hasRated && <span className="rated-badge">평가 완료</span>}
                  {!participant.hasRated && participant.ratingCount > 0 && (
                    <div className="participant-score">
                      <span><span className="star-sm">★</span>{participant.avgManner?.toFixed(1)}</span>
                    </div>
                  )}
                </div>
                {!participant.hasRated && (
                  <>
                    {(["trust", "skill", "manner"] as const).map((category) => (
                      <div className="rate-category" key={category}>
                        <span className="rate-category-label">
                          {category === "trust" ? "신뢰도" : category === "skill" ? "실력" : "인성"}
                        </span>
                        <div className="star-input">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              type="button"
                              key={star}
                              className={star <= s[category] ? "filled" : ""}
                              onClick={() =>
                                setScores((prev) => ({
                                  ...prev,
                                  [participant.email]: { ...s, [category]: star },
                                }))
                              }
                              aria-label={`${star}점`}
                            >
                              {star <= s[category] ? "★" : "☆"}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div className="rate-comment">
                      <input
                        placeholder="한줄 코멘트 (선택)"
                        maxLength={100}
                        value={s.comment}
                        onChange={(e) =>
                          setScores((prev) => ({
                            ...prev,
                            [participant.email]: { ...s, comment: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="rate-submit-row">
                      <button
                        className="rate-submit-btn"
                        disabled={submitting || s.trust === 0 || s.skill === 0 || s.manner === 0}
                        onClick={() => void submitRating(participant.email)}
                      >
                        평가 저장
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
