"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "@/lib/utils/ui";

type Props = {
  activityId: string;
  isOwner: boolean;
  onToast: (message: string) => void;
};

export function AttendanceCheckIn({ activityId, isOwner, onToast }: Props) {
  const [active, setActive] = useState(false);
  const [code, setCode] = useState("");
  const [entry, setEntry] = useState("");
  const [validFrom, setValidFrom] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/activities/${activityId}/attendance-code`, {
      cache: "no-store",
    });
    if (!response.ok) return;
    const payload = (await response.json()) as {
      active?: boolean;
      validFrom?: string | null;
      expiresAt?: string | null;
    };
    setActive(Boolean(payload.active));
    setValidFrom(payload.validFrom ?? null);
    setExpiresAt(payload.expiresAt ?? null);
  }, [activityId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const generate = async () => {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/activities/${activityId}/attendance-code`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        code?: string;
        validFrom?: string;
        expiresAt?: string;
        error?: string;
      };
      if (!response.ok || !payload.code) {
        throw new Error(payload.error || "출석번호를 만들지 못했어요.");
      }
      setCode(payload.code);
      setActive(true);
      setValidFrom(payload.validFrom ?? null);
      setExpiresAt(payload.expiresAt ?? null);
      onToast("새 출석번호를 만들었어요.");
    } catch (error) {
      onToast(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const checkIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch(`/api/activities/${activityId}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: entry }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "출석을 확인하지 못했어요.");
      setEntry("");
      onToast("출석이 확인됐어요!");
    } catch (error) {
      onToast(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="attendance-check-in">
      <div className="attendance-heading">
        <div>
          <span>현장 출석</span>
          <h3>{isOwner ? "6자리 출석번호" : "출석번호 입력"}</h3>
        </div>
        <b>{active ? "사용 중" : "대기"}</b>
      </div>

      {isOwner ? (
        <>
          {code ? (
            <div className="attendance-code" aria-label={`출석번호 ${code}`}>
              {code.slice(0, 3)} <span>{code.slice(3)}</span>
            </div>
          ) : (
            <p>현장에서 번호를 알려주면 참가자가 직접 출석할 수 있어요.</p>
          )}
          <button type="button" disabled={submitting} onClick={() => void generate()}>
            {submitting ? "만드는 중..." : active ? "새 번호로 바꾸기" : "출석번호 만들기"}
          </button>
        </>
      ) : active ? (
        <form onSubmit={checkIn}>
          <input
            required
            value={entry}
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            placeholder="000000"
            aria-label="6자리 출석번호"
            onChange={(event) => setEntry(event.target.value.replace(/\D/g, ""))}
          />
          <button disabled={submitting || entry.length !== 6}>
            {submitting ? "확인 중..." : "출석하기"}
          </button>
        </form>
      ) : (
        <p>모임장이 출석번호를 만들면 이곳에서 입력할 수 있어요.</p>
      )}

      {(validFrom || expiresAt) && (
        <small>
          {validFrom && `${new Date(validFrom).toLocaleString("ko-KR")}부터 `}
          {expiresAt && `${new Date(expiresAt).toLocaleString("ko-KR")}까지`}
        </small>
      )}
    </section>
  );
}
