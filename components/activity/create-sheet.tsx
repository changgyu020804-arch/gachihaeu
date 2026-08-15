"use client";

import { FormEvent, useState } from "react";
import type { Sport } from "@/lib/types/activity";
import { defaultStartTime, getErrorMessage } from "@/lib/utils/ui";
import {
  CreateActivityFields,
  type CreateActivityForm,
} from "@/components/activity/create-activity-fields";

const initialForm: CreateActivityForm = {
  sport: "농구",
  title: "",
  venue: "실외농구장",
  startsAt: "",
  durationMinutes: 90,
  capacity: "6",
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
  const [form, setForm] = useState<CreateActivityForm>({
    ...initialForm,
    sport: defaultSport ?? initialForm.sport,
    venue: defaultVenue ?? initialForm.venue,
    startsAt: defaultStartTime(),
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const capacity = Number(form.capacity);
    if (!Number.isInteger(capacity) || capacity < 2 || capacity > 30) {
      setError("모집 인원은 2명에서 30명 사이로 입력해 주세요.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          capacity,
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
          <CreateActivityFields form={form} setForm={setForm} />
          {error && <div className="form-error">{error}</div>}
          <button className="primary-button" disabled={submitting}>
            {submitting ? "등록하는 중..." : "모임 등록하기"}
          </button>
        </form>
      </section>
    </div>
  );
}
