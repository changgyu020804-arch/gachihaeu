# 같이해U

서울시립대학교 구성원이 종목·날짜·교내 장소를 기준으로 운동 모임을 만들고 참여하는 캠퍼스 운동 모임 서비스입니다. 모임 탐색과 참가, 출석 확인, 실력·매너 평가까지 이어지는 흐름을 구현했습니다.

- 서비스: https://www.gachihaeu.com/
- 개발 기간: 약 1개월
- 팀 구성: 기획 1명, 개발 1명
- 개발 담당: 정창규

## 담당 역할

2인 팀에서 개발을 담당했습니다. 프론트엔드의 주요 화면과 인터랙션은 직접 구현했고, 백엔드 구현에는 AI 도구를 활용했습니다. 사용자 입력, API 요청, 로딩·오류 처리와 결과 반영을 연결하는 작업을 진행했습니다.

- 운동 모임 목록, 종목·날짜 필터, 모임 생성·상세와 참가·취소 화면
- 로그인, 프로필 설정·수정, 알림과 내 모임 화면
- 출석 확인, 종목별 실력·공통 매너 평가, 평판 표시 화면
- 커스텀 Hooks를 통한 목록·필터·추가 조회와 화면 상태 관리
- 비동기 요청 취소, 오류 안내, 재시도와 제출 중 상태 표시

## 기술과 실행 환경

| 영역 | 구성 |
| --- | --- |
| 웹 화면 | React 19, TypeScript, HTML, CSS |
| 페이지·API | Next.js App Router API와 디렉터리 구조 |
| 실행·빌드 | vinext, Vite, Cloudflare Vite plugin |
| 데이터·파일 | Cloudflare D1, R2, Drizzle ORM |
| 모바일 동반 앱 | Expo, React Native WebView |

`next` 패키지와 App Router의 페이지·API 방식을 사용하며, 현재 `dev`, `build`, `start` 스크립트는 `vinext`를 실행합니다. 일반적인 `next dev`·`next build` 실행 구성과는 차이가 있습니다.

## 주요 기능

### 모임 탐색과 참여

종목과 날짜로 모임을 조회하고, 교내 장소별 모임과 남은 자리를 확인할 수 있습니다. 모임 생성·참가·취소, 대기와 댓글 기능을 API와 연결했습니다.

### 출석과 평가

모임 출석을 확인하고 참가자와 모임장이 평가하는 화면을 구성했습니다. 실력은 종목별로, 매너는 공통 지표로 표시합니다. 평가가 3개 미만이면 점수 대신 평가 수집 상태를 보여줍니다.

### 사용자와 운영 화면

학교 이메일 인증, 프로필, 알림, 신고·차단과 계정 삭제 흐름을 포함합니다. 실제 서비스의 운영 준비 및 검증 상태는 [보안 체크리스트](SECURITY_CHECKLIST.md)를 참고하세요.

## 프론트엔드 구현 사례

- `hooks/use-home-activities.ts`: 필터별 조회, 커서 기반 추가 조회, ID 비교를 통한 중복 제외, 요청 취소와 사용자별 캐시를 관리합니다.
- `app/home-client.tsx`: 로그인·생성·상세·프로필 등의 화면을 `React.lazy`와 `Suspense`로 필요할 때 불러옵니다.
- `components/rating/rating-sheet.tsx`: 출석과 평가 API를 호출하고 입력·제출 상태 및 성공·실패 결과를 표시합니다.
- `components/profile/reputation-panel.tsx`: 종목별 실력과 공통 매너 점수를 구분하고, 평가 수에 따라 공개 상태를 다르게 표시합니다.

## 로컬 실행

Node.js 22.13.0 이상과 npm이 필요합니다.

```powershell
npm ci
Copy-Item .env.example .dev.vars
```

`.dev.vars`의 예시 값을 실제 개발용 값으로 바꿉니다. JWT 서명키와 요청 제한 키는 서로 다른 무작위 문자열을 사용합니다. 환경변수 이름과 조건은 `.env.example` 및 `server/config/runtime-env.ts`에 정의되어 있습니다.

```powershell
npm run dev
```

Vite의 Cloudflare plugin이 로컬 D1·R2 바인딩을 구성합니다. 최초 DB 구조는 `db/bootstrap-current.ts` 등의 초기화 코드에서 처리합니다. 이메일 인증을 사용하려면 Resend 키와 발신 주소가 필요하며, 프로젝트를 실행하는 것만으로 운영 DB나 운영 계정이 복제되지는 않습니다.

`.env*`, `.dev.vars*`, 로컬 DB와 업로드 파일, API 키 및 인증서는 Git에 올리지 않습니다. 이 저장소는 실제 값이 없는 `.env.example`만 제공합니다.

## 확인 명령

```powershell
npm run lint
npx tsc --noEmit
npm test
```

`npm test`는 웹 빌드 후 저장소의 Node 테스트를 실행합니다. 실행 시점의 환경에 따라 결과가 달라질 수 있습니다.

## 코드 구조

```text
app/           페이지, API 라우트, 스타일
components/    모임·인증·프로필·평가 등의 화면 부품
hooks/         화면 상태와 API 호출을 연결하는 React 로직
lib/           공통 타입, 검증, 클라이언트 유틸리티
server/        인증, 정책, 서비스, 데이터 접근
db/            D1 연결과 DB 초기화
drizzle/       스키마 변경 기록
worker/        Cloudflare 요청 진입점과 정리 작업
mobile/        Expo WebView 앱과 네이티브 기능 연결
tests/         자동 테스트
```

상세한 책임 구분은 [ARCHITECTURE.md](ARCHITECTURE.md)를 참고하세요.
