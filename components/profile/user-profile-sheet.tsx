"use client";

import { useCallback, useEffect, useState } from "react";
import { RecentRating, SPORT_META, UserProfile } from "@/lib/types/activity";
import { ReputationPanel } from "@/components/profile/reputation-panel";
import { getErrorMessage } from "@/lib/utils/ui";
import { CampusRoleBadge } from "@/components/profile/campus-role-badge";

type UserProfileSheetProps = {
  email: string;
  onClose: () => void;
  onToast: (message: string) => void;
  onRelationshipChanged: () => Promise<void>;
};

type ViewerState = {
  isSelf: boolean;
  isBlocked: boolean;
  blockedByUser: boolean;
};

export function UserProfileSheet({
  email,
  onClose,
  onToast,
  onRelationshipChanged,
}: UserProfileSheetProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [recentRatings, setRecentRatings] = useState<RecentRating[]>([]);
  const [viewerState, setViewerState] = useState<ViewerState | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/ratings/${encodeURIComponent(email)}`, { cache: "no-store" });
      const payload = (await response.json()) as {
        profile?: UserProfile;
        recentRatings?: RecentRating[];
        viewerState?: ViewerState;
      };
      if (response.ok && payload.profile) {
        setProfile(payload.profile);
        setRecentRatings(payload.recentRatings ?? []);
        setViewerState(payload.viewerState ?? null);
      }
    } catch {
      // silent
    }
  }, [email]);

  useEffect(() => {
    const initialLoadTimer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(initialLoadTimer);
  }, [load]);

  const toggleBlock = async () => {
    if (!viewerState || viewerState.isSelf) return;
    const shouldBlock = !viewerState.isBlocked;
    let reason = "";
    if (shouldBlock) {
      const answer = window.prompt(
        "차단 사유를 입력해 주세요. 차단과 동시에 운영자에게 신고되며, 이 사용자의 콘텐츠는 내 화면에서 즉시 사라집니다.",
      );
      if (answer === null) return;
      reason = answer.trim();
      if (reason.length < 5) {
        window.alert("차단 및 신고 사유를 다섯 글자 이상 입력해 주세요.");
        return;
      }
    }
    setSubmitting(true);
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(email)}/block`, {
        method: shouldBlock ? "POST" : "DELETE",
        headers: shouldBlock ? { "Content-Type": "application/json" } : undefined,
        body: shouldBlock ? JSON.stringify({ reason }) : undefined,
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "차단 상태를 변경하지 못했어요.");
      setViewerState((current) =>
        current ? { ...current, isBlocked: shouldBlock } : current,
      );
      if (shouldBlock) onClose();
      await onRelationshipChanged();
      onToast(
        shouldBlock
          ? "운영자에게 신고하고 차단했어요. 해당 사용자의 콘텐츠를 숨겼어요."
          : "차단을 해제했어요.",
      );
    } catch (error) {
      onToast(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const reportUser = async () => {
    const reason = window.prompt(
      "신고 사유를 입력해 주세요. 운영자가 확인할 수 있도록 구체적으로 적어주세요.",
    );
    if (reason === null) return;
    if (reason.trim().length < 5) {
      window.alert("신고 사유를 다섯 글자 이상 입력해 주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(email)}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "신고하지 못했어요.");
      onToast("신고가 접수됐어요.");
    } catch (error) {
      onToast(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section
        className="sheet user-profile-sheet"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <button
          type="button"
          className="close-button user-profile-close-button"
          aria-label="사용자 프로필 닫기"
          onClick={onClose}
        >
          ×
        </button>
        {!profile ? (
          <div className="profile-loading">프로필 불러오는 중...</div>
        ) : (
          <>
            <div className="user-profile-header">
              <div className="user-profile-avatar">
                {profile.nickname.slice(0, 1).toUpperCase()}
              </div>
              <div className="profile-name-row">
                <h2>{profile.nickname}</h2>
                {profile.campusRole && (
                  <CampusRoleBadge role={profile.campusRole} />
                )}
              </div>
              {profile.department && <span className="dept">{profile.department}</span>}
              {profile.bio && <p className="profile-bio">{profile.bio}</p>}
              {profile.preferredSports.length > 0 && (
                <div className="profile-sports">
                  {profile.preferredSports.map((sport) => (
                    <span
                      key={sport}
                      className="sport-tag"
                      style={{
                        color: SPORT_META[sport].color,
                        background: SPORT_META[sport].softColor,
                      }}
                    >
                      {SPORT_META[sport].icon} {sport}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="profile-stats public-profile-stats">
              <div><strong>{profile.participationCount}</strong><span>참석 완료</span></div>
              <div><strong>{profile.hostCount}</strong><span>모임장 진행</span></div>
              <div className={profile.noShowCount > 0 ? "warning" : ""}>
                <strong>{profile.noShowCount}</strong><span>노쇼</span>
              </div>
            </div>
            <ReputationPanel profile={profile} recentRatings={recentRatings} />
            {viewerState && !viewerState.isSelf && (
              <div className="profile-safety-actions">
                <button disabled={submitting} onClick={() => void reportUser()}>
                  사용자 신고
                </button>
                <button
                  className={viewerState.isBlocked ? "blocked" : ""}
                  disabled={submitting}
                  onClick={() => void toggleBlock()}
                >
                  {viewerState.isBlocked ? "차단 해제" : "신고하고 차단"}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
