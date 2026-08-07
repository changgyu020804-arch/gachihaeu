"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  RecentRating,
  UserProfile,
  Viewer,
} from "../activity-data";
import { getErrorMessage } from "./utils";
import { ProfileEditForm, ProfileForm } from "./profile-edit-form";
import { AccountDeletionPanel } from "./account-deletion-panel";
import { AdminVerificationPanel } from "./admin-verification-panel";
import { AdminModerationPanel } from "./admin-moderation-panel";
import { ProfileOverview } from "./profile-overview";

type ProfileSheetProps = {
  user: Viewer;
  onClose: () => void;
  onLogout: () => void;
  onAccountDeleted: () => void;
  onToast: (msg: string) => void;
};

export function ProfileSheet({
  user,
  onClose,
  onLogout,
  onAccountDeleted,
  onToast,
}: ProfileSheetProps) {
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [recentRatings, setRecentRatings] = useState<RecentRating[]>([]);
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    nickname: "",
    gender: "",
    campusRole: "",
    department: "",
    bio: "",
    preferredSports: [],
  });
  const [editing, setEditing] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [showAdminVerifications, setShowAdminVerifications] = useState(false);
  const [showAdminModeration, setShowAdminModeration] = useState(false);
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
          gender: payload.profile.gender,
          campusRole:
            payload.profile.requestedCampusRole || payload.profile.campusRole,
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
    const initialLoadTimer = window.setTimeout(() => {
      void loadProfile();
    }, 0);
    return () => window.clearTimeout(initialLoadTimer);
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
    <div className="sheet-backdrop" onClick={() => { onClose(); setEditing(false); setShowDeleteAccount(false); setShowAdminVerifications(false); setShowAdminModeration(false); }}>
      <section
        className="sheet profile-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <button
          type="button"
          className="close-button profile-close-button"
          aria-label="마이페이지 닫기"
          onClick={onClose}
        >
          ×
        </button>
        {loading ? (
          <div className="profile-loading">프로필 불러오는 중...</div>
        ) : showDeleteAccount ? (
          <AccountDeletionPanel
            email={user.email}
            onCancel={() => setShowDeleteAccount(false)}
            onDeleted={onAccountDeleted}
          />
        ) : showAdminVerifications ? (
          <AdminVerificationPanel
            onClose={() => setShowAdminVerifications(false)}
            onToast={onToast}
          />
        ) : showAdminModeration ? (
          <AdminModerationPanel
            onClose={() => setShowAdminModeration(false)}
            onToast={onToast}
          />
        ) : editing ? (
          <ProfileEditForm
            value={profileForm}
            error={error}
            submitting={submitting}
            onCancel={() => setEditing(false)}
            onChange={setProfileForm}
            onSubmit={handleSubmit}
          />
        ) : (
          <ProfileOverview
            profile={profileData}
            user={user}
            recentRatings={recentRatings}
            onEdit={() => setEditing(true)}
            onOpenAdmin={() => setShowAdminVerifications(true)}
            onOpenModeration={() => setShowAdminModeration(true)}
            onOpenDeletion={() => setShowDeleteAccount(true)}
            onLogout={onLogout}
            onHideComment={(ratingId) => void hideComment(ratingId)}
            onProfileChanged={loadProfile}
            onToast={onToast}
          />
        )}
      </section>
    </div>
  );
}
