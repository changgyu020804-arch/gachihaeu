import Link from "next/link";
import { ReactNode } from "react";
import { PolicyLinks } from "./policy-links";

type Props = {
  kicker: string;
  title: string;
  intro: string;
  children: ReactNode;
};

export function LegalPage({ kicker, title, intro, children }: Props) {
  return (
    <main className="legal-shell">
      <article className="legal-page">
        <header>
          <Link href="/" className="legal-back">← 같이해U로 돌아가기</Link>
          <p className="section-kicker">{kicker}</p>
          <h1>{title}</h1>
          <p>{intro}</p>
          <small>시행일 2026년 8월 7일</small>
        </header>
        <div className="legal-content">{children}</div>
        <PolicyLinks />
      </article>
    </main>
  );
}
