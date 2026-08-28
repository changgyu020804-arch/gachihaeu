"use client";

import { RecentRating, SPORT_META, UserProfile, Viewer } from "@/lib/types/activity";
import { CampusRoleBadge } from "@/components/profile/campus-role-badge";
import { ReputationPanel } from "@/components/profile/reputation-panel";
import { RoleVerificationPanel } from "@/components/profile/role-verification-panel";

type ProfileOverviewProps = {
  profile: UserProfile | null;
  user: Viewer;
  recentRatings: RecentRating[];
  onEdit: () => void;
  onOpenAdmin: () => void;
  onOpenModeration: () => void;
  onPrepareIrDemo: () => void;
  onOpenDeletion: () => void;
  onLogout: () => void;
  onHideComment: (ratingId: string) => void;
  onProfileChanged: () => Promise<void>;
  onToast: (message: string) => void;
};

export function ProfileOverview({
  profile,
  user,
  recentRatings,
  onEdit,
  onOpenAdmin,
  onOpenModeration,
  onPrepareIrDemo,
  onOpenDeletion,
  onLogout,
  onHideComment,
  onProfileChanged,
  onToast,
}: ProfileOverviewProps) {
  const requestedRole = profile?.requestedCampusRole;

  return (
    <>
      <div className="profile-avatar">
        {(profile?.nickname || user.fullName || user.email).slice(0, 1).toUpperCase()}
      </div>
      <div className="profile-name-row">
        <h2 id="profile-title">
          {profile?.nickname || user.fullName || user.displayName}
        </h2>
        {profile?.campusRole && <CampusRoleBadge role={profile.campusRole} />}
        {!profile?.campusRole &&
          (requestedRole === "교수" || requestedRole === "교직원") && (
            <span className="role-status-badge">
              {requestedRole}{" "}
              {profile?.roleVerificationStatus === "pending"
                ? "확인 중"
                : profile?.roleVerificationStatus === "rejected"
                  ? "재인증 필요"
                  : "인증 필요"}
            </span>
          )}
      </div>
      {(profile?.department || profile?.gender) && (
        <p className="profile-department">
          {[profile.department, profile.gender].filter(Boolean).join(" · ")}
        </p>
      )}
      {profile?.bio && <p className="profile-bio">{profile.bio}</p>}
      {profile?.preferredSports && profile.preferredSports.length > 0 && (
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
      <small className="profile-email">{user.email}</small>

      {requestedRole && profile?.roleVerificationStatus && (
        <RoleVerificationPanel
          requestedRole={requestedRole}
          status={profile.roleVerificationStatus}
          onChanged={onProfileChanged}
          onToast={onToast}
        />
      )}

      {profile && (
        <ReputationPanel
          profile={profile}
          recentRatings={recentRatings}
          onHideComment={onHideComment}
        />
      )}

      <div className="profile-stats">
        <div><strong>{profile?.participationCount ?? 0}</strong><span>참석 완료</span></div>
        <div><strong>{profile?.hostCount ?? 0}</strong><span>모임장 진행</span></div>
        <div className={(profile?.noShowCount ?? 0) > 0 ? "warning" : ""}>
          <strong>{profile?.noShowCount ?? 0}</strong><span>노쇼</span>
        </div>
      </div>

      <button className="edit-profile-button" onClick={onEdit}>프로필 수정</button>
      {profile?.isAdmin && (
        <>
          <div className="admin-link-grid">
            <button className="admin-verification-link" onClick={onOpenAdmin}>
              직위 인증 관리
            </button>
            <button className="admin-verification-link moderation" onClick={onOpenModeration}>
              신고·제재 관리
            </button>
          </div>
          <button className="admin-verification-link" onClick={onPrepareIrDemo}>
            IR 시연 데이터 준비
          </button>
        </>
      )}
      <button className="signout-link" onClick={onLogout}>로그아웃</button>
      <button className="delete-account-link" onClick={onOpenDeletion}>
        회원 탈퇴
      </button>
    </>
  );
}
