"use client";

import Link from "next/link";

type TermsAgreementProps = {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

export function TermsAgreement({
  checked,
  disabled = false,
  onChange,
}: TermsAgreementProps) {
  return (
    <div className="terms-agreement">
      <label className="terms-agreement-check">
        <input
          required
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>
          <Link href="/terms" target="_blank" rel="noreferrer">
            이용약관
          </Link>
          과 {" "}
          <Link href="/community" target="_blank" rel="noreferrer">
            커뮤니티 운영정책
          </Link>
          에 동의합니다.
        </span>
      </label>
      <p>
        같이해U는 불쾌한 콘텐츠와 악의적인 사용자에게 무관용 원칙을
        적용하며, 신고된 콘텐츠와 계정을 운영자가 확인합니다.
      </p>
    </div>
  );
}
