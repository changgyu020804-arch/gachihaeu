import { AttendanceStatus } from "@/lib/types/activity";

export type RatingContext = {
  isOwner: boolean;
  hasEnded: boolean;
  activityStatus: string;
  creatorEmail: string;
  currentUserAttendance: AttendanceStatus;
};

export type Scores = {
  one: number;
  two: number;
  three: number;
  comment: string;
};

export const EMPTY_SCORES: Scores = {
  one: 0,
  two: 0,
  three: 0,
  comment: "",
};

export const ATTENDANCE_OPTIONS: Array<{
  value: AttendanceStatus;
  label: string;
}> = [
  { value: "attended", label: "참석" },
  { value: "absent", label: "불참" },
  { value: "no_show", label: "노쇼" },
];
