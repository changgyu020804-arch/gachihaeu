"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  DEPARTMENTS,
  RecentRating,
  SPORT_META,
  SPORTS,
  Sport,
  UserProfile,
  Viewer,
} from "../activity-data";
import { getErrorMessage } from "./utils";
import { ReputationPanel } from "./reputation-panel";

type ProfileSheetProps = {
  user: Viewer;
  onClose: () => void;
  onLogout: () => void;
  onToast: (msg: string) => void;
};

type ProfileForm = {
  nickname: string;
  department: string;
  bio: string;
  preferredSports: Sport[];
};

export function ProfileSheet({ user, onClose, onLogout, onToast }: ProfileSheetProps) {
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [recentRatings, setRecentRatings] = useState<RecentRating[]>([]);
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    nickname: "",
    department: "",
    bio: "",
    preferredSports: [],
  });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/profile", { cache: "no-store" });
      const payload = (await response.json()) as {
        profile?: UserProfile;
        recentRatings?: RecentRating[];
      };
      if (response.ok && payload.profile) {
        setProfileData(payload.profile);
        setRecentRatings(payload.recentRatings ?? []);
        setProfileForm({
          nickname: payload.profile.nickname,
          department: payload.profile.department,
          bio: payload.profile.bio,
          preferredSports: payload.profile.preferredSports,
        });
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const hideComment = async (ratingId: string) => {
    if (!window.confirm("이 코멘트를 프로필에서 숨기고 신고할까요?")) return;
    try {
      const response = await fetch("/api/ratings/comment-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ratingId }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "코멘트를 숨기지 못했어요.");
      setRecentRatings((current) => current.filter((rating) => rating.id !== ratingId));
      onToast("코멘트를 숨기고 신고했어요.");
    } catch (hideError) {
      onToast(getErrorMessage(hideError));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "프로필을 저장하지 못했어요.");
      setEditing(false);
      onToast("프로필이 저장됐어요.");
      await loadProfile();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sheet-backdrop" onClick={() => { onClose(); setEditing(false); }}>
      <section
        className="sheet profile-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        {loading ? (
          <div className="profile-loading">프로필 불러오는 중...</div>
        ) : editing ? (
          <>
            <div className="sheet-header">
              <div>
                <p className="section-kicker">EDIT PROFILE</p>
                <h2 id="profile-title">프로필 수정</h2>
              </div>
              <button className="close-button" onClick={() => setEditing(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="profile-form">
              <label>
                닉네임
                <input
                  required
                  maxLength={20}
                  value={profileForm.nickname}
                  placeholder="캠퍼스에서 불릴 이름"
                  onChange={(e) => setProfileForm((c) => ({ ...c, nickname: e.target.value }))}
                />
              </label>
              <label>
                학과
                <select
                  value={profileForm.department}
                  onChange={(e) => setProfileForm((c) => ({ ...c, department: e.target.value }))}
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept === "선택 안함" ? "" : dept}>{dept}</option>
                  ))}
                </select>
              </label>
              <label>
                한줄 소개
                <input
                  maxLength={100}
                  value={profileForm.bio}
                  placeholder="나를 한 줄로 소개해 보세요"
                  onChange={(e) => setProfileForm((c) => ({ ...c, bio: e.target.value }))}
                />
              </label>
              <fieldset>
                <legend>선호 종목 (복수 선택 가능)</legend>
                <div className="choice-grid">
                  {SPORTS.filter((s): s is Sport => s !== "전체").map((sport) => (
                    <button
                      type="button"
                      key={sport}
                      className={profileForm.preferredSports.includes(sport) ? "active" : ""}
                      onClick={() =>
                        setProfileForm((c) => ({
                          ...c,
                          preferredSports: c.preferredSports.includes(sport)
                            ? c.preferredSports.filter((s) => s !== sport)
                            : [...c.preferredSports, sport],
                        }))
                      }
                    >
                      {SPORT_META[sport].icon} {sport}
                    </button>
                  ))}
                </div>
              </fieldset>
              {error && <div className="form-error">{error}</div>}
              <button className="primary-button" disabled={submitting}>
                {submitting ? "저장 중..." : "프로필 저장"}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="profile-avatar">
              {(profileData?.nickname || user.fullName || user.email).slice(0, 1).toUpperCase()}
            </div>
            <h2 id="profile-title">{profileData?.nickname || user.fullName || user.displayName}</h2>
            {profileData?.department && <p className="profile-department">{profileData.department}</p>}
            {profileData?.bio && <p className="profile-bio">{profileData.bio}</p>}
            {profileData?.preferredSports && profileData.preferredSports.length > 0 && (
              <div className="profile-sports">
                {profileData.preferredSports.map((sport) => (
                  <span key={sport} className="sport-tag" style={{ color: SPORT_META[sport].color, background: SPORT_META[sport].softColor }}>
                    {SPORT_META[sport].icon} {sport}
                  </span>
                ))}
              </div>
            )}
            <small className="profile-email">{user.email}</small>

            {profileData && (
              <ReputationPanel
                profile={profileData}
                recentRatings={recentRatings}
                onHideComment={(ratingId) => void hideComment(ratingId)}
              />
            )}

            <div className="profile-stats">
              <div>
                <strong>{profileData?.participationCount ?? 0}</strong>
                <span>참석 완료</span>
              </div>
              <div>
                <strong>{profileData?.hostCount ?? 0}</strong>
                <span>모임장 진행</span>
              </div>
              <div className={(profileData?.noShowCount ?? 0) > 0 ? "warning" : ""}>
                <strong>{profileData?.noShowCount ?? 0}</strong>
                <span>노쇼</span>
              </div>
            </div>

            <button className="edit-profile-button" onClick={() => setEditing(true)}>
              프로필 수정
            </button>
            <button className="signout-link" onClick={onLogout}>로그아웃</button>
          </>
        )}
      </section>
    </div>
  );
}
