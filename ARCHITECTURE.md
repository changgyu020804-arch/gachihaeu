# 같이해U 코드 구조

같이해U는 웹 애플리케이션을 중심으로 하고, iOS 앱이 WebView와 네이티브 기능을 연결하는 구조입니다.

## 요청 흐름

```text
화면(app, components)
  -> React 상태(hooks)
  -> HTTP API(app/api)
  -> 서버 규칙(server/services, server/policies)
  -> 데이터 접근(server/repositories)
  -> Cloudflare D1 / R2(db)
```

## 폴더 책임

- `app`: Next.js 페이지와 API 라우트
- `components`: 기능별 React 화면 부품
- `hooks`: 브라우저에서 실행되는 React 로직
- `lib`: 클라이언트와 서버가 함께 사용하는 타입, 검증, 유틸리티
- `server`: 인증, 보안, 정책, 서비스, 저장소처럼 서버에서만 실행되는 코드
- `db`: D1 연결과 스키마 초기화
- `mobile`: iOS WebView 앱과 푸시 알림 연결
- `worker`: Cloudflare 요청 진입점과 공통 보호 계층
- `tests`: 구조와 보안 기능을 확인하는 자동 테스트

## 현재 구조

```text
new-chat/
├─ app/                     # 페이지와 API 라우트
│  ├─ api/
│  ├─ styles/
│  ├─ layout.tsx
│  ├─ page.tsx
│  └─ home-client.tsx
├─ components/
│  ├─ activity/
│  ├─ admin/
│  ├─ auth/
│  ├─ layout/
│  ├─ notifications/
│  ├─ profile/
│  └─ rating/
├─ hooks/
├─ lib/
│  ├─ types/
│  ├─ utils/
│  └─ validation/
├─ server/
│  ├─ auth/
│  ├─ config/
│  ├─ policies/
│  ├─ repositories/
│  ├─ security/
│  ├─ services/
│  └─ validation/
├─ db/
├─ drizzle/
├─ mobile/
│  └─ src/
│     ├─ bridge/
│     ├─ components/
│     ├─ hooks/
│     ├─ notifications/
│     └─ services/
├─ public/
├─ tests/
└─ worker/
```

## 이름 규칙

여러 운동 모임을 포괄하기 위해 도메인 이름은 `match`가 아니라 `activity`를 사용합니다. 기존 공개 API인 `/api/activities`도 유지합니다.
