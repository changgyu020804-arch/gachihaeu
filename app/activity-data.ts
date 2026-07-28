export const SPORTS = [
  "전체",
  "축구",
  "농구",
  "러닝",
  "테니스",
  "배드민턴",
  "헬스",
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
  creatorName: string;
  participantCount: number;
  isJoined: boolean;
  isOwner: boolean;
  waitlistCount: number;
  isWaitlisted: boolean;
  waitlistPosition: number | null;
  facilityReserved: boolean;
};

export type Viewer = {
  displayName: string;
  email: string;
  fullName: string | null;
};

// --- 프로필 & 평가 시스템 타입 ---

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

export type UserProfile = {
  email: string;
  nickname: string;
  department: string;
  bio: string;
  preferredSports: Sport[];
  avgTrust: number | null;
  avgSkill: number | null;
  avgManner: number | null;
  ratingCount: number;
};

export type Rating = {
  id: string;
  activityId: string;
  raterEmail: string;
  ratedEmail: string;
  trustScore: number;
  skillScore: number;
  mannerScore: number;
  comment: string;
  createdAt: string;
};

export type ParticipantInfo = {
  email: string;
  displayName: string;
  nickname: string;
  department: string;
  avgTrust: number | null;
  avgSkill: number | null;
  avgManner: number | null;
  ratingCount: number;
  hasRated: boolean;
};
