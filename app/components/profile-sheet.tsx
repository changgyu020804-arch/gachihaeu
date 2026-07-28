"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Activity,
  DEPARTMENTS,
  SPORT_META,
  SPORTS,
  Sport,
  UserProfile,
  Viewer,
} from "../activity-data";
import { getErrorMessage } from "./utils";

type ProfileSheetProps = {
  user: Viewer;
  activities: Activity[];
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

export function ProfileSheet({ user, activities, onClose, onLogout, onToast }: ProfileSheetProps) {
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
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
      const payload = (await response.json()) as { profile?: UserProfile };
      if (response.ok && payload.profile) {
        setProfileData(payload.profile);
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

            {profileData && profileData.ratingCount > 0 && (
              <div className="rating-summary">
                <h3>받은 평가</h3>
                <div className="rating-scores">
                  {(["avgTrust", "avgSkill", "avgManner"] as const).map((key) => {
                    const label = key === "avgTrust" ? "신뢰도" : key === "avgSkill" ? "실력" : "인성";
                    const val = profileData[key];
                    return (
                      <div className="rating-score-item" key={key}>
                        <span className="rating-label">{label}</span>
                        <div className="rating-stars">
                          {"★".repeat(Math.round(val ?? 0))}
                          {"☆".repeat(5 - Math.round(val ?? 0))}
                        </div>
                        <span className="rating-value">{val?.toFixed(1)}</span>
                      </div>
                    );
                  })}
                </div>
                <small>{profileData.ratingCount}개의 평가</small>
              </div>
            )}

            <div className="profile-stats">
              <div><strong>{activities.filter((a) => a.isJoined).length}</strong><span>참여 모임</span></div>
              <div><strong>{activities.filter((a) => a.isOwner).length}</strong><span>만든 모임</span></div>
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
