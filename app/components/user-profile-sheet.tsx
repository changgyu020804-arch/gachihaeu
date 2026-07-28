"use client";

import { useCallback, useEffect, useState } from "react";
import { RecentRating, UserProfile } from "../activity-data";
import { ReputationPanel } from "./reputation-panel";

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
            <ReputationPanel profile={profile} recentRatings={recentRatings} />
          </>
        )}
      </section>
    </div>
  );
}
