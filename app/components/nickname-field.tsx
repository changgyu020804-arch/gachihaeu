"use client";

import { useEffect, useId, useRef, useState } from "react";
import { NICKNAME_MAX_LENGTH } from "../nickname";

type NicknameStatus =
  | "idle"
  | "checking"
  | "available"
  | "unavailable"
  | "error";

type NicknameFieldProps = {
  value: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onChange: (value: string) => void;
};

const STATUS_TEXT: Record<Exclude<NicknameStatus, "idle">, string> = {
  checking: "닉네임 중복을 확인하고 있어요.",
  available: "사용할 수 있는 닉네임이에요.",
  unavailable: "이미 사용 중인 닉네임이에요.",
  error: "중복 확인에 실패했어요. 저장할 때 다시 확인할게요.",
};

export function NicknameField({
  value,
  disabled = false,
  autoFocus = false,
  onChange,
}: NicknameFieldProps) {
  const [status, setStatus] = useState<NicknameStatus>("idle");
  const requestId = useRef(0);
  const statusId = useId();

  useEffect(() => {
    if (!value.trim()) return;

    const currentRequestId = ++requestId.current;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setStatus("checking");

      try {
        const response = await fetch(
          `/api/profile/nickname?value=${encodeURIComponent(value)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const payload = (await response.json()) as { available?: boolean };

        if (currentRequestId !== requestId.current) return;
        setStatus(
          response.ok && payload.available
            ? "available"
            : response.ok
              ? "unavailable"
              : "error",
        );
      } catch (error) {
        if (
          currentRequestId === requestId.current &&
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          setStatus("error");
        }
      }
    }, 400);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  function handleChange(nextValue: string) {
    requestId.current += 1;
    setStatus("idle");
    onChange(nextValue);
  }

  return (
    <label>
      닉네임
      <input
        required
        maxLength={NICKNAME_MAX_LENGTH}
        value={value}
        placeholder="캠퍼스에서 불릴 이름"
        onChange={(event) => handleChange(event.target.value)}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-invalid={status === "unavailable"}
        aria-describedby={statusId}
      />
      <span
        id={statusId}
        className={`nickname-status ${status}`}
        aria-live="polite"
      >
        {status === "idle" ? " " : STATUS_TEXT[status]}
      </span>
    </label>
  );
}
