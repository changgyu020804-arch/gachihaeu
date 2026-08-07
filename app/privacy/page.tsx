import { LegalPage } from "../components/legal-page";

export default function PrivacyPage() {
  return (
    <LegalPage
      kicker="PRIVACY"
      title="개인정보처리방침"
      intro="같이해U는 서울시립대학교 구성원이 안심하고 운동 모임을 이용하는 데 필요한 정보만 처리합니다."
    >
      <section>
        <h2>1. 처리하는 정보</h2>
        <p>학교 이메일, 닉네임, 성별, 직위, 학과, 자기소개와 선호 운동을 처리합니다. 모임 생성·참가·대기·댓글·출석·평가·신고·차단 기록도 서비스 운영을 위해 저장합니다.</p>
      </section>
      <section>
        <h2>2. 이용 목적</h2>
        <p>회원 식별과 학교 구성원 확인, 운동 모임 운영, 출석과 평판 제공, 알림 발송, 신고 처리, 부정 이용 방지와 보안 사고 대응에 사용합니다.</p>
      </section>
      <section>
        <h2>3. 보관과 삭제</h2>
        <p>계정 정보는 회원 탈퇴 시 삭제하거나 관계 법령상 보관 의무가 있는 경우에만 필요한 기간 동안 분리 보관합니다. 교수·교직원 증빙자료는 심사 완료 후 7일이 지나면 원본을 삭제합니다. 보안 기록은 서비스 보호에 필요한 최소 기간만 보관합니다.</p>
      </section>
      <section>
        <h2>4. 처리 기반과 외부 서비스</h2>
        <p>구조화된 서비스 데이터는 Cloudflare D1, 직위 인증 파일은 Cloudflare R2에 저장됩니다. 이메일 인증 발송에는 Resend를 사용하며, 발송을 위해 이메일 주소가 전달될 수 있습니다.</p>
      </section>
      <section>
        <h2>5. 이용자의 권리</h2>
        <p>마이페이지에서 프로필을 수정하고 계정을 탈퇴할 수 있습니다. 열람·정정·삭제·처리정지 요청은 고객지원 이메일로 접수할 수 있습니다.</p>
      </section>
      <section>
        <h2>6. 보호 조치와 문의</h2>
        <p>로그인 세션 보호, 요청 횟수 제한, 관리자 권한 분리, 증빙자료 접근 통제 등을 적용합니다. 개인정보 관련 문의는 <a href="mailto:changgyu1939@uos.ac.kr">changgyu1939@uos.ac.kr</a>로 보내 주세요.</p>
      </section>
    </LegalPage>
  );
}
