import { LegalPage } from "../components/legal-page";

const SUPPORT_ITEMS = [
  ["서비스 이용 문의", "로그인, 모임 생성·참가, 출석번호 사용 방법을 문의해 주세요.", "%5B같이해U%5D%20서비스%20이용%20문의"],
  ["직위 인증 문의", "교수·교직원 증빙 제출 또는 심사 결과를 문의해 주세요.", "%5B같이해U%5D%20직위%20인증%20문의"],
  ["신고·제재 이의제기", "계정 이메일, 조치 시점과 이의 사유를 함께 적어 주세요.", "%5B같이해U%5D%20신고%20및%20제재%20이의제기"],
  ["오류 신고", "사용 기기, 발생 화면과 재현 순서를 알려주면 빠르게 확인할 수 있어요.", "%5B같이해U%5D%20오류%20신고"],
] as const;

export default function SupportPage() {
  return (
    <LegalPage
      kicker="SUPPORT"
      title="고객지원"
      intro="불편한 점이나 안전 문제가 있으면 아래 항목을 선택해 이메일로 알려 주세요."
    >
      <div className="support-grid">
        {SUPPORT_ITEMS.map(([title, description, subject]) => (
          <a key={title} href={`mailto:changgyu1939@uos.ac.kr?subject=${subject}`}>
            <strong>{title}</strong>
            <span>{description}</span>
            <b>이메일 보내기 →</b>
          </a>
        ))}
      </div>
      <section><h2>답변 안내</h2><p>문의 내용은 <a href="mailto:changgyu1939@uos.ac.kr">changgyu1939@uos.ac.kr</a>로 전달됩니다. 긴급한 신체 안전 문제는 112 또는 119에 먼저 연락해 주세요.</p></section>
    </LegalPage>
  );
}
