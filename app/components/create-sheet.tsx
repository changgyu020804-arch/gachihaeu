"use client";

import { FormEvent, useState } from "react";
import {
  LEVELS,
  SPORT_META,
  SPORTS,
  Sport,
  VENUES,
  isReservationRequired,
} from "../activity-data";
import { defaultStartTime, getErrorMessage } from "./utils";

type CreateForm = {
  sport: Sport;
  title: string;
  venue: string;
  startsAt: string;
  durationMinutes: number;
  capacity: number;
  level: string;
  description: string;
  facilityReserved: boolean;
  cancellationDeadlineMinutes: number;
};

const initialForm: CreateForm = {
  sport: "농구",
  title: "",
  venue: "실외농구장",
  startsAt: "",
  durationMinutes: 90,
  capacity: 6,
  level: "초보 환영",
  description: "",
  facilityReserved: false,
  cancellationDeadlineMinutes: 60,
};

type CreateSheetProps = {
  onClose: () => void;
  onCreated: () => void;
  onToast: (msg: string) => void;
  defaultSport?: Sport;
  defaultVenue?: string;
};

export function CreateSheet({ onClose, onCreated, onToast, defaultSport, defaultVenue }: CreateSheetProps) {
  const [form, setForm] = useState<CreateForm>({
    ...initialForm,
    sport: defaultSport ?? initialForm.sport,
    venue: defaultVenue ?? initialForm.venue,
    startsAt: defaultStartTime(),
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          startsAt: new Date(form.startsAt).toISOString(),
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "모임을 만들지 못했어요.");
      onToast("모임을 만들었어요. 이제 친구들을 기다려 볼까요?");
      onCreated();
      onClose();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section
        className="sheet create-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div>
            <p className="section-kicker">NEW ACTIVITY</p>
            <h2 id="create-title">새 모임 만들기</h2>
          </div>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <fieldset>
            <legend>운동 종목</legend>
            <div className="choice-grid">
              {SPORTS.filter((sport): sport is Sport => sport !== "전체").map((sport) => (
                <button
                  type="button"
                  key={sport}
                  className={form.sport === sport ? "active" : ""}
                  onClick={() => setForm((c) => ({ ...c, sport }))}
                >
                  {SPORT_META[sport].icon} {sport}
                </button>
              ))}
            </div>
          </fieldset>
          <label>
            모임 제목
            <input
              required
              minLength={2}
              maxLength={50}
              value={form.title}
              placeholder="예: 수업 끝나고 가볍게 농구해요"
              onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))}
            />
          </label>
          <div className="form-row">
            <label>
              날짜와 시간
              <input
                required
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm((c) => ({ ...c, startsAt: e.target.value }))}
              />
            </label>
            <label>
              진행 시간
              <select
                value={form.durationMinutes}
                onChange={(e) => setForm((c) => ({ ...c, durationMinutes: Number(e.target.value) }))}
              >
                <option value={60}>60분</option>
                <option value={90}>90분</option>
                <option value={120}>120분</option>
              </select>
            </label>
          </div>
          <label>
            참가 취소 마감
            <select
              value={form.cancellationDeadlineMinutes}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  cancellationDeadlineMinutes: Number(e.target.value),
                }))
              }
            >
              <option value={0}>모임 시작 직전까지</option>
              <option value={60}>시작 1시간 전</option>
              <option value={180}>시작 3시간 전</option>
              <option value={1440}>시작 하루 전</option>
            </select>
            <small>마감 이후에는 참가자가 직접 취소할 수 없어요.</small>
          </label>
          <label>
            장소
            <select
              value={form.venue}
              onChange={(e) => setForm((c) => ({ ...c, venue: e.target.value, facilityReserved: false }))}
            >
              {VENUES.map((venue) => <option key={venue}>{venue}</option>)}
            </select>
          </label>
          {isReservationRequired(form.venue) && (
            <div className="wise-notice">
              <div className="wise-notice-text">
                <span>⚠️</span>
                <div>
                  <strong>이 장소는 WISE 시설예약이 필요해요</strong>
                  <a href="https://wise.uos.ac.kr/index.do" target="_blank" rel="noopener noreferrer">
                    WISE에서 예약하기 →
                  </a>
                </div>
              </div>
              <label className="wise-checkbox">
                <input
                  type="checkbox"
                  checked={form.facilityReserved}
                  onChange={(e) => setForm((c) => ({ ...c, facilityReserved: e.target.checked }))}
                />
                시설 예약 완료했어요
              </label>
            </div>
          )}
          <div className="form-row">
            <label>
              최대 인원
              <input
                required
                type="number"
                min={2}
                max={30}
                value={form.capacity}
                onChange={(e) => setForm((c) => ({ ...c, capacity: Number(e.target.value) }))}
              />
            </label>
            <label>
              난이도
              <select
                value={form.level}
                onChange={(e) => setForm((c) => ({ ...c, level: e.target.value }))}
              >
                {LEVELS.map((level) => <option key={level}>{level}</option>)}
              </select>
            </label>
          </div>
          <label>
            상세 설명
            <textarea
              maxLength={280}
              value={form.description}
              placeholder="준비물이나 모임 방법을 알려주세요. 연락처는 적지 마세요."
              onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
            />
            <small>{form.description.length}/280</small>
          </label>
          <div className="community-check">
            <span>✓</span>
            교내 시설 이용수칙과 커뮤니티 매너를 지킬게요.
          </div>
          {error && <div className="form-error">{error}</div>}
          <button className="primary-button" disabled={submitting}>
            {submitting ? "등록하는 중..." : "모임 등록하기"}
          </button>
        </form>
      </section>
    </div>
  );
}
