export const SPORTS = ["전체", "축구", "농구", "러닝", "테니스", "배드민턴"] as const;
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
};

export const VENUES = [
  "대운동장 트랙",
  "대운동장 잔디구장",
  "대운동장 북측 농구장",
  "대운동장 서측 축구장",
  "실외테니스장",
  "100주년기념관 체육관",
  "기타 교내 장소",
] as const;

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
};

export type Viewer = {
  displayName: string;
  email: string;
  fullName: string | null;
};
