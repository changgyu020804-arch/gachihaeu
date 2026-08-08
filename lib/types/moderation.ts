export const REPORT_TYPES = ["activity", "comment", "user", "rating"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const MODERATION_ACTIONS = [
  "dismiss",
  "hide_content",
  "warn",
  "suspend_3d",
  "suspend_7d",
  "suspend_30d",
  "ban",
] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export const MODERATION_ACTION_OPTIONS = [
  ["dismiss", "문제없음"],
  ["hide_content", "콘텐츠 숨김"],
  ["warn", "경고"],
  ["suspend_3d", "3일 정지"],
  ["suspend_7d", "7일 정지"],
  ["suspend_30d", "30일 정지"],
  ["ban", "영구 제한"],
] as const satisfies ReadonlyArray<readonly [ModerationAction, string]>;

export type ModerationReport = {
  type: ReportType;
  id: string;
  reporterEmail: string;
  targetEmail: string;
  reason: string;
  content: string;
  createdAt: string;
  resolution: string | null;
  resolutionNote: string | null;
};

export type ActiveSanction = {
  id: string;
  userEmail: string;
  kind: string;
  reason: string;
  expiresAt: string | null;
  createdAt: string;
};
