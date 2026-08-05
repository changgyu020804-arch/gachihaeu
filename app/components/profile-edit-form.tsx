"use client";

import { Dispatch, FormEvent, SetStateAction } from "react";
import {
  CAMPUS_ROLES,
  DEPARTMENTS,
  GENDERS,
  SPORT_META,
  SPORTS,
  Sport,
} from "../activity-data";
import { NicknameField } from "./nickname-field";

export type ProfileForm = {
  nickname: string;
  gender: string;
  campusRole: string;
  department: string;
  bio: string;
  preferredSports: Sport[];
};

type ProfileEditFormProps = {
  value: ProfileForm;
  error: string;
  submitting: boolean;
  onCancel: () => void;
  onChange: Dispatch<SetStateAction<ProfileForm>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function ProfileEditForm({
  value,
  error,
  submitting,
  onCancel,
  onChange,
  onSubmit,
}: ProfileEditFormProps) {
  return (
    <>
      <div className="sheet-header">
        <div>
          <p className="section-kicker">EDIT PROFILE</p>
          <h2 id="profile-title">프로필 수정</h2>
        </div>
        <button className="close-button" onClick={onCancel}>×</button>
      </div>
      <form onSubmit={onSubmit} className="profile-form">
        <NicknameField
          value={value.nickname}
          disabled={submitting}
          onChange={(nickname) =>
            onChange((current) => ({ ...current, nickname }))
          }
        />
        <label>
          성별
          <select
            required
            value={value.gender}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                gender: event.target.value,
              }))
            }
          >
            <option value="" disabled>성별 선택</option>
            {GENDERS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          직위
          <select
            required
            value={value.campusRole}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                campusRole: event.target.value,
              }))
            }
          >
            <option value="" disabled>직위 선택</option>
            {CAMPUS_ROLES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        {value.campusRole !== "" && value.campusRole !== "학생" && (
          <p className="role-verification-note">
            교수·교직원 배지는 프로필 저장 후 증빙자료를 제출하고 운영자 승인을
            받아야 표시돼요.
          </p>
        )}
        <label>
          학과
          <select
            required
            value={value.department}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                department: event.target.value,
              }))
            }
          >
            <option value="" disabled>학과 선택</option>
            {DEPARTMENTS.filter((item) => item !== "선택 안함").map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          한줄 소개
          <input
            maxLength={100}
            value={value.bio}
            placeholder="나를 한 줄로 소개해 보세요"
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                bio: event.target.value,
              }))
            }
          />
        </label>
        <fieldset>
          <legend>선호 종목 (복수 선택 가능)</legend>
          <div className="choice-grid">
            {SPORTS.filter((sport): sport is Sport => sport !== "전체").map(
              (sport) => (
                <button
                  type="button"
                  key={sport}
                  className={value.preferredSports.includes(sport) ? "active" : ""}
                  onClick={() =>
                    onChange((current) => ({
                      ...current,
                      preferredSports: current.preferredSports.includes(sport)
                        ? current.preferredSports.filter((item) => item !== sport)
                        : [...current.preferredSports, sport],
                    }))
                  }
                >
                  {SPORT_META[sport].icon} {sport}
                </button>
              ),
            )}
          </div>
        </fieldset>
        {error && <div className="form-error">{error}</div>}
        <button className="primary-button" disabled={submitting}>
          {submitting ? "저장 중..." : "프로필 저장"}
        </button>
      </form>
    </>
  );
}
