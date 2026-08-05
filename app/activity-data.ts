export const SPORTS = [
  "전체",
  "축구",
  "농구",
  "러닝",
  "테니스",
  "배드민턴",
  "헬스",
  "스쿼시",
  "족구",
  "배구",
] as const;
export type SportFilter = (typeof SPORTS)[number];
export type Sport = Exclude<SportFilter, "전체">;

export const SPORT_META: Record<
  Sport,
  { icon: string; color: string; softColor: string }
> = {
  축구: { icon: "⚽", color: "#138a5b", softColor: "#e8f7f0" },
  농구: { icon: "🏀", color: "#e46c17", softColor: "#fff1e8" },
  러닝: { icon: "🏃", color: "#176bff", softColor: "#eaf2ff" },
  테니스: { icon: "🎾", color: "#7653e8", softColor: "#f0ecff" },
  배드민턴: { icon: "🏸", color: "#d8437a", softColor: "#fdebf2" },
  헬스: { icon: "🏋️", color: "#5c6572", softColor: "#edf0f3" },
  스쿼시: { icon: "🎾", color: "#0891b2", softColor: "#ecfeff" },
  족구: { icon: "🦶", color: "#d97706", softColor: "#fff7ed" },
  배구: { icon: "🏐", color: "#7c3aed", softColor: "#f3e8ff" },
};

export const VENUES = [
  "대운동장 잔디구장",
  "대운동장 러닝트랙",
  "실외농구장",
  "족구장",
  "실외테니스장",
  "실내테니스장",
  "스쿼시장",
  "100주년 기념관 농구장",
  "100주년 기념관 배드민턴장",
  "100주년 기념관 배구장",
  "기타 교내 장소",
] as const;

// WISE 시설예약이 필요한 장소
export const RESERVATION_REQUIRED_VENUES: string[] = [
  "대운동장 잔디구장",
  "실외농구장",
  "족구장",
  "실외테니스장",
  "실내테니스장",
  "스쿼시장",
  "100주년 기념관 농구장",
  "100주년 기념관 배드민턴장",
  "100주년 기념관 배구장",
];

export function isReservationRequired(venue: string): boolean {
  return RESERVATION_REQUIRED_VENUES.includes(venue);
}

export const LEVELS = ["처음이에요", "초보 환영", "누구나", "경험자", "숙련자"] as const;

export type Activity = {
  id: string;
  sport: Sport;
  title: string;
  venue: string;
  startsAt: string;
  durationMinutes: number;
  capacity: number;
  level: string;
  description: string;
  notice: string;
  noticeUpdatedAt: string | null;
  creatorName: string;
  participantCount: number;
  isJoined: boolean;
  isOwner: boolean;
  waitlistCount: number;
  isWaitlisted: boolean;
  waitlistPosition: number | null;
  facilityReserved: boolean;
  cancellationDeadlineMinutes: number;
};

export type Viewer = {
  displayName: string;
  email: string;
  fullName: string | null;
  onboardingComplete: boolean;
};

// --- 프로필 & 평가 시스템 타입 ---

export type AttendanceStatus = "pending" | "attended" | "absent" | "no_show";
export type RatingType = "host_to_member" | "member_to_host" | "legacy";

export const DEPARTMENTS = [
  "선택 안함",
  "행정학과",
  "국제관계학과",
  "경제학부",
  "세무학과",
  "사회복지학과",
  "국어국문학과",
  "영어영문학과",
  "역사학과",
  "철학과",
  "수학과",
  "통계학과",
  "물리학과",
  "생명과학과",
  "환경원예학과",
  "전자전기컴퓨터공학부",
  "화학공학과",
  "기계정보공학과",
  "신소재공학과",
  "토목공학과",
  "컴퓨터과학부",
  "인공지능학과",
  "건축학부",
  "도시공학과",
  "교통공학과",
  "조경학과",
  "환경공학부",
  "음악학과",
  "산업디자인학과",
  "환경조각학과",
  "스포츠과학과",
  "자유전공학부",
  "기타",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

export const GENDERS = ["남성", "여성"] as const;
export type Gender = (typeof GENDERS)[number];

export const CAMPUS_ROLES = ["학생", "교수", "교직원"] as const;
export type CampusRole = (typeof CAMPUS_ROLES)[number];
export type RoleVerificationStatus =
  | "not_required"
  | "not_submitted"
  | "pending"
  | "approved"
  | "rejected";

export type UserProfile = {
  email: string;
  nickname: string;
  gender: string;
  campusRole: string;
  requestedCampusRole?: string;
  roleVerificationStatus?: RoleVerificationStatus;
  isAdmin?: boolean;
  department: string;
  bio: string;
  preferredSports: Sport[];
  reputationScore: number | null;
  ratingCount: number;
  memberRatingCount: number;
  hostRatingCount: number;
  avgPunctuality: number | null;
  avgTeamwork: number | null;
  avgMemberManner: number | null;
  avgAccuracy: number | null;
  avgFacilitation: number | null;
  avgSafety: number | null;
  participationCount: number;
  hostCount: number;
  noShowCount: number;
};

export type Rating = {
  id: string;
  activityId: string;
  raterEmail: string;
  ratedEmail: string;
  trustScore: number;
  skillScore: number;
  mannerScore: number;
  ratingType: RatingType;
  comment: string;
  createdAt: string;
};

export type RecentRating = {
  id: string;
  ratingType: RatingType;
  scoreOne: number;
  scoreTwo: number;
  scoreThree: number;
  comment: string;
  createdAt: string;
  sport: string;
  title: string;
};

export type ParticipantInfo = {
  email: string;
  displayName: string;
  nickname: string;
  department: string;
  reputationScore: number | null;
  ratingCount: number;
  hasRated: boolean;
  attendanceStatus: AttendanceStatus;
  isHost: boolean;
};
