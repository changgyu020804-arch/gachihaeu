import Link from "next/link";

export function PolicyLinks() {
  return (
    <nav className="policy-links" aria-label="서비스 정책">
      <Link href="/privacy">개인정보처리방침</Link>
      <Link href="/terms">이용약관</Link>
      <Link href="/community">커뮤니티 운영정책</Link>
      <Link href="/support">고객지원</Link>
    </nav>
  );
}
