# 같이해U iPhone 앱

현재 운영 중인 `https://www.gachihaeu.com`을 iPhone에 맞게 제공하는 Expo 앱입니다.
웹 로그인 쿠키를 유지하고, 앱 로딩·오프라인 재시도·외부 링크·공유·안전 영역을
모바일 앱에서 처리합니다.

## iPhone에서 미리보기

1. iPhone에 Expo Go를 설치합니다.
2. 이 폴더에서 `npm start -- --tunnel`을 실행합니다.
3. 표시된 QR 코드를 iPhone 카메라로 스캔합니다.

## Apple 승인 후

1. `npx eas-cli@latest login`
2. `npx eas-cli@latest build:configure`
3. `npx eas-cli@latest build --platform ios --profile production`
4. `npx eas-cli@latest submit --platform ios --latest`

Apple 비밀번호, 2단계 인증번호, `.p8`, `.p12`, 프로비저닝 파일은 저장소에
추가하지 않습니다.
