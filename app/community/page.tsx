import { LegalPage } from "../components/legal-page";

export default function CommunityPage() {
  return (
    <LegalPage
      kicker="COMMUNITY SAFETY"
      title="커뮤니티 운영정책"
      intro="운동을 잘하는 것보다 서로를 안전하고 편안하게 대하는 것을 우선합니다."
    >
      <section><h2>환영하는 행동</h2><p>정확한 모임 정보 제공, 실력 차이를 배려한 진행, 약속 시간 준수, 안전 장비 사용, 존중하는 댓글과 구체적이고 정중한 평가를 권장합니다.</p></section>
      <section><h2>허용하지 않는 행동</h2><p>차별·혐오·욕설·성희롱·위협·스토킹, 반복적인 노쇼, 허위 직위, 연락처 등 개인정보 공개, 상업성 홍보, 위험 행동 강요는 허용하지 않습니다.</p></section>
      <section><h2>신고 처리 기준</h2><p>신고는 모임, 댓글, 사용자, 평가 코멘트별로 검토합니다. 경미한 위반은 안내나 경고, 반복·중대한 위반은 콘텐츠 숨김과 3일·7일·30일 정지 또는 영구 제한으로 처리할 수 있습니다.</p></section>
      <section><h2>긴급 상황</h2><p>폭력이나 신체 안전이 우려되면 즉시 현장을 벗어나 112 또는 119에 연락하세요. 서비스 신고는 긴급 구조 수단이 아닙니다.</p></section>
      <section><h2>이의제기</h2><p>조치가 잘못되었다고 생각하면 계정 이메일, 조치 시점, 이의 사유를 적어 <a href="mailto:changgyu1939@uos.ac.kr?subject=%5B같이해U%5D%20운영조치%20이의제기">운영조치 이의제기</a>를 보내 주세요.</p></section>
    </LegalPage>
  );
}
