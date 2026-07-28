"use client";

import { useCallback, useEffect, useState } from "react";
import { UserProfile } from "../activity-data";

type RecentRating = {
  trustScore: number;
  skillScore: number;
  mannerScore: number;
  comment: string;
  createdAt: string;
  sport: string;
  title: string;
};

type UserProfileSheetProps = {
  email: string;
  onClose: () => void;
};

export function UserProfileSheet({ email, onClose }: UserProfileSheetProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [recentRatings, setRecentRatings] = useState<RecentRating[]>([]);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/ratings/${encodeURIComponent(email)}`, { cache: "no-store" });
      const payload = (await response.json()) as { profile?: UserProfile; recentRatings?: RecentRating[] };
      if (response.ok && payload.profile) {
        setProfile(payload.profile);
        setRecentRatings(payload.recentRatings ?? []);
      }
    } catch {
      // silent
    }
  }, [email]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section
        className="sheet user-profile-sheet"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <button className="close-button" style={{ position: "absolute", top: 16, right: 16 }} onClick={onClose}>×</button>
        {!profile ? (
          <div className="profile-loading">프로필 불러오는 중...</div>
        ) : (
          <>
            <div className="user-profile-header">
              <div className="user-profile-avatar">
                {profile.nickname.slice(0, 1).toUpperCase()}
              </div>
              <h2>{profile.nickname}</h2>
              {profile.department && <span className="dept">{profile.department}</span>}
              {profile.bio && <p className="profile-bio">{profile.bio}</p>}
            </div>
            {profile.ratingCount > 0 && (
              <div className="rating-summary">
                <h3>평균 평점</h3>
                <div className="rating-scores">
                  {(["avgTrust", "avgSkill", "avgManner"] as const).map((key) => {
                    const label = key === "avgTrust" ? "신뢰도" : key === "avgSkill" ? "실력" : "인성";
                    const val = profile[key];
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
                <small>{profile.ratingCount}개의 평가</small>
              </div>
            )}
            {recentRatings.length > 0 && (
              <div className="recent-ratings">
                <h3>최근 평가</h3>
                {recentRatings.map((r, i) => (
                  <div className="recent-rating-item" key={i}>
                    <div className="recent-rating-scores">
                      <span>신뢰 <b>{"★".repeat(r.trustScore)}</b></span>
                      <span>실력 <b>{"★".repeat(r.skillScore)}</b></span>
                      <span>인성 <b>{"★".repeat(r.mannerScore)}</b></span>
                    </div>
                    {r.comment && <p className="recent-rating-comment">{r.comment}</p>}
                    <p className="recent-rating-meta">{r.sport} · {r.title}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
