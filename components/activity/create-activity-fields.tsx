"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  LEVELS,
  SPORT_META,
  SPORTS,
  VENUES,
  isReservationRequired,
} from "@/lib/types/activity";
import type { Sport } from "@/lib/types/activity";

export type CreateActivityForm = {
  sport: Sport;
  title: string;
  venue: string;
  startsAt: string;
  durationMinutes: number;
  capacity: string;
  level: string;
  description: string;
  facilityReserved: boolean;
  cancellationDeadlineMinutes: number;
};

type CreateActivityFieldsProps = {
  form: CreateActivityForm;
  setForm: Dispatch<SetStateAction<CreateActivityForm>>;
};

export function CreateActivityFields({
  form,
  setForm,
}: CreateActivityFieldsProps) {
  return (
    <>
      <fieldset>
        <legend>운동 종목</legend>
        <div className="choice-grid">
          {SPORTS.filter((sport): sport is Sport => sport !== "전체").map((sport) => (
            <button
              type="button"
              key={sport}
              className={form.sport === sport ? "active" : ""}
              onClick={() => setForm((current) => ({ ...current, sport }))}
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
          onChange={(event) =>
            setForm((current) => ({ ...current, title: event.target.value }))
          }
        />
      </label>
      <div className="form-row">
        <label>
          날짜와 시간
          <input
            required
            type="datetime-local"
            value={form.startsAt}
            onChange={(event) =>
              setForm((current) => ({ ...current, startsAt: event.target.value }))
            }
          />
        </label>
        <label>
          진행 시간
          <select
            value={form.durationMinutes}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                durationMinutes: Number(event.target.value),
              }))
            }
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
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              cancellationDeadlineMinutes: Number(event.target.value),
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
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              venue: event.target.value,
              facilityReserved: false,
            }))
          }
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
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  facilityReserved: event.target.checked,
                }))
              }
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
            step={1}
            inputMode="numeric"
            value={form.capacity}
            onChange={(event) => {
              const capacity = event.target.value.replace(/^0+(?=\d)/, "");
              setForm((current) => ({ ...current, capacity }));
            }}
          />
        </label>
        <label>
          난이도
          <select
            value={form.level}
            onChange={(event) =>
              setForm((current) => ({ ...current, level: event.target.value }))
            }
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
          onChange={(event) =>
            setForm((current) => ({ ...current, description: event.target.value }))
          }
        />
        <small>{form.description.length}/280</small>
      </label>
      <div className="community-check">
        <span>✓</span>
        교내 시설 이용수칙과 커뮤니티 매너를 지킬게요.
      </div>
    </>
  );
}
