import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("uses the finished 같이해U product shell", async () => {
  const [page, layout, home, venues] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/home-client.tsx", root), "utf8"),
    readFile(new URL("components/activity/venue-section.tsx", root), "utf8"),
  ]);

  assert.match(page, /<HomeClient/);
  assert.match(layout, /같이해U \| 서울시립대 운동 메이트/);
  assert.match(home, /<VenueSection/);
  assert.match(venues, /장소별 모임/);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
  await assert.rejects(
    access(new URL("app/_sites-preview/SkeletonPreview.tsx", root)),
  );
});

test("keeps large UI and style concerns in focused modules", async () => {
  const [
    home,
    homeController,
    homeActivities,
    loginSheet,
    profileSetupForm,
    profileSheet,
    profileEditForm,
    ratingSheet,
    ratingCard,
    layout,
    baseStyles,
    ratingStyles,
    profileRoute,
    profileInput,
    profileRole,
    verificationRoute,
    evidenceUpload,
  ] =
    await Promise.all([
      readFile(new URL("app/home-client.tsx", root), "utf8"),
      readFile(new URL("hooks/use-home-controller.ts", root), "utf8"),
      readFile(new URL("hooks/use-home-activities.ts", root), "utf8"),
      readFile(new URL("components/auth/login-sheet.tsx", root), "utf8"),
      readFile(new URL("components/profile/profile-setup-form.tsx", root), "utf8"),
      readFile(new URL("components/profile/profile-sheet.tsx", root), "utf8"),
      readFile(new URL("components/profile/profile-edit-form.tsx", root), "utf8"),
      readFile(new URL("components/rating/rating-sheet.tsx", root), "utf8"),
      readFile(new URL("components/rating/rating-participant-card.tsx", root), "utf8"),
      readFile(new URL("app/layout.tsx", root), "utf8"),
      readFile(new URL("app/styles/base.css", root), "utf8"),
      readFile(new URL("app/styles/ratings.css", root), "utf8"),
      readFile(new URL("app/api/profile/route.ts", root), "utf8"),
      readFile(new URL("server/validation/profile-input.ts", root), "utf8"),
      readFile(new URL("server/policies/profile-role.ts", root), "utf8"),
      readFile(new URL("app/api/role-verification/route.ts", root), "utf8"),
      readFile(new URL("server/services/role-evidence-upload.ts", root), "utf8"),
    ]);

  assert.ok(home.split("\n").length < 230);
  assert.match(home, /useHomeController/);
  assert.ok(homeController.split("\n").length < 240);
  assert.match(homeController, /useHomeActivities/);
  assert.match(homeActivities, /visibleActivities/);
  assert.ok(loginSheet.split("\n").length < 250);
  assert.match(loginSheet, /ProfileSetupForm/);
  assert.match(profileSetupForm, /CAMPUS_ROLES/);
  assert.ok(profileSheet.split("\n").length < 230);
  assert.match(profileSheet, /ProfileEditForm/);
  assert.match(profileSheet, /showRootCloseButton/);
  assert.match(profileEditForm, /preferredSports/);
  assert.ok(ratingSheet.split("\n").length < 250);
  assert.match(ratingSheet, /RatingParticipantCard/);
  assert.match(ratingCard, /ATTENDANCE_OPTIONS/);
  assert.match(layout, /styles\/base\.css/);
  assert.match(layout, /styles\/notifications\.css/);
  assert.match(baseStyles, /@import "tailwindcss"/);
  assert.match(ratingStyles, /rate-participant/);
  assert.ok(profileRoute.split("\n").length < 240);
  assert.match(profileRoute, /validateProfileInput/);
  assert.match(profileInput, /preferredSports/);
  assert.match(profileRole, /resolveProfileRole/);
  assert.ok(verificationRoute.split("\n").length < 220);
  assert.match(verificationRoute, /readRoleEvidenceUpload/);
  assert.match(evidenceUpload, /detectEvidenceContentType/);
  await assert.rejects(access(new URL("app/globals.css", root)));
});

test("enforces attendance and role-based rating rules", async () => {
  const [ratingRoute, participantRoute, ratingSheet, profile, migration] =
    await Promise.all([
      readFile(new URL("app/api/ratings/route.ts", root), "utf8"),
      readFile(
        new URL("app/api/activities/[id]/participants/route.ts", root),
        "utf8",
      ),
      readFile(new URL("components/rating/rating-sheet.tsx", root), "utf8"),
      readFile(new URL("components/profile/reputation-panel.tsx", root), "utf8"),
      readFile(new URL("drizzle/0002_lively_sabra.sql", root), "utf8"),
    ]);

  assert.match(ratingRoute, /구성원은 모임장만 평가할 수 있어요/);
  assert.match(ratingRoute, /참석이 확인된 구성원만 평가할 수 있어요/);
  assert.match(participantRoute, /모임장만 출석을 확인할 수 있어요/);
  assert.match(participantRoute, /getActivityForViewer/);
  assert.match(participantRoute, /participant_rating_stats/);
  assert.match(ratingSheet, /출석 확인 및 구성원 평가/);
  assert.match(ratingSheet, /설명 정확도/);
  assert.match(profile, /같이점수/);
  assert.match(profile, /받은 한줄 코멘트/);
  assert.match(migration, /attendance_status/);
  assert.match(migration, /rating_type/);
});

test("persists and displays user notifications", async () => {
  const [notificationRoute, notificationSheet, notificationStore, migration] =
    await Promise.all([
      readFile(new URL("app/api/notifications/route.ts", root), "utf8"),
      readFile(new URL("components/notifications/notification-sheet.tsx", root), "utf8"),
      readFile(new URL("server/services/notification.service.ts", root), "utf8"),
      readFile(new URL("drizzle/0003_oval_puppet_master.sql", root), "utf8"),
    ]);

  assert.match(notificationRoute, /syncScheduledNotifications/);
  assert.match(notificationRoute, /unreadCount/);
  assert.match(notificationSheet, /모두 읽음/);
  assert.match(notificationSheet, /새 알림이 없어요/);
  assert.match(notificationStore, /모임이 곧 시작해요/);
  assert.match(notificationStore, /운동은 즐거우셨나요/);
  assert.match(migration, /CREATE TABLE `notifications`/);
  assert.match(migration, /notifications_user_dedupe_idx/);
});

test("delivers account-bound iPhone push notifications and opens the activity", async () => {
  const [
    schema,
    migration,
    tokenRoute,
    pushStore,
    notificationStore,
    nativeApp,
    nativePushBridge,
    nativePush,
    nativeBridge,
    webBridge,
    accountDeletion,
    appConfig,
  ] = await Promise.all([
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("drizzle/0014_aberrant_the_anarchist.sql", root), "utf8"),
    readFile(new URL("app/api/push-tokens/route.ts", root), "utf8"),
    readFile(new URL("server/services/push-notification.service.ts", root), "utf8"),
    readFile(new URL("server/services/notification.service.ts", root), "utf8"),
    readFile(new URL("mobile/App.tsx", root), "utf8"),
    readFile(new URL("mobile/src/hooks/use-push-notification-bridge.ts", root), "utf8"),
    readFile(new URL("mobile/src/notifications/push-notifications.ts", root), "utf8"),
    readFile(new URL("mobile/src/bridge/webview-bridge.ts", root), "utf8"),
    readFile(new URL("hooks/use-native-app-bridge.ts", root), "utf8"),
    readFile(new URL("server/services/account-deletion.ts", root), "utf8"),
    readFile(new URL("mobile/app.json", root), "utf8"),
  ]);

  assert.match(schema, /pushTokens = sqliteTable/);
  assert.match(migration, /CREATE TABLE `push_tokens`/);
  assert.match(tokenRoute, /getSessionUser/);
  assert.match(tokenRoute, /ON CONFLICT\(token\) DO UPDATE/);
  assert.match(pushStore, /exp\.host\/--\/api\/v2\/push\/send/);
  assert.match(pushStore, /DeviceNotRegistered/);
  assert.match(notificationStore, /sendPushNotifications/);
  assert.match(nativePush, /getExpoPushTokenAsync/);
  assert.match(nativeApp, /usePushNotificationBridge/);
  assert.match(nativePushBridge, /addNotificationResponseReceivedListener/);
  assert.match(nativePushBridge, /registrationInFlightRef/);
  assert.match(nativePushBridge, /devicePushTokenRef/);
  assert.match(nativeBridge, /gachihaeu:push-token/);
  assert.match(nativeBridge, /localStorage\.getItem/);
  assert.match(nativeBridge, /gachihaeu:open-activity/);
  assert.match(webBridge, /gachihaeu:open-activity/);
  assert.match(accountDeletion, /DELETE FROM push_tokens/);
  assert.match(appConfig, /expo-notifications/);
});

test("supports activity operations and trustworthy profiles", async () => {
  const [
    activityRoute,
    joinRoute,
    detailSheet,
    reputation,
    userProfile,
    blockRoute,
    reportRoute,
    migration,
  ] = await Promise.all([
    readFile(new URL("app/api/activities/[id]/route.ts", root), "utf8"),
    readFile(new URL("app/api/activities/[id]/join/route.ts", root), "utf8"),
    readFile(new URL("components/activity/detail-sheet.tsx", root), "utf8"),
    readFile(new URL("server/repositories/reputation.repository.ts", root), "utf8"),
    readFile(new URL("components/profile/user-profile-sheet.tsx", root), "utf8"),
    readFile(new URL("app/api/users/[email]/block/route.ts", root), "utf8"),
    readFile(new URL("app/api/users/[email]/report/route.ts", root), "utf8"),
    readFile(new URL("drizzle/0004_low_gabe_jones.sql", root), "utf8"),
  ]);

  assert.match(activityRoute, /모임장만 공지를 작성할 수 있어요/);
  assert.match(activityRoute, /취소 사유를 입력해 주세요/);
  assert.match(joinRoute, /참가 취소 마감/);
  assert.match(detailSheet, /참가자에게 공지하기/);
  assert.match(reputation, /participationCount/);
  assert.match(reputation, /noShowCount/);
  assert.match(userProfile, /사용자 신고/);
  assert.match(userProfile, /신고하고 차단/);
  assert.match(blockRoute, /INSERT OR IGNORE INTO user_blocks/);
  assert.match(blockRoute, /INSERT INTO user_reports/);
  assert.match(reportRoute, /같은 모임에 참여한 사용자만 신고할 수 있어요/);
  assert.match(migration, /CREATE TABLE `user_blocks`/);
  assert.match(migration, /cancellation_deadline_minutes/);
});

test("meets the user-generated content safety requirements", async () => {
  const [
    loginSheet,
    agreement,
    sendCode,
    reviewLogin,
    activityRoute,
    activityDetailRoute,
    profileInput,
    userProfile,
    blockRoute,
    terms,
    community,
  ] = await Promise.all([
    readFile(new URL("components/auth/login-sheet.tsx", root), "utf8"),
    readFile(new URL("components/auth/terms-agreement.tsx", root), "utf8"),
    readFile(new URL("app/api/auth/send-code/route.ts", root), "utf8"),
    readFile(new URL("app/api/auth/review-login/route.ts", root), "utf8"),
    readFile(new URL("app/api/activities/route.ts", root), "utf8"),
    readFile(new URL("app/api/activities/[id]/route.ts", root), "utf8"),
    readFile(new URL("server/validation/profile-input.ts", root), "utf8"),
    readFile(new URL("components/profile/user-profile-sheet.tsx", root), "utf8"),
    readFile(new URL("app/api/users/[email]/block/route.ts", root), "utf8"),
    readFile(new URL("app/terms/page.tsx", root), "utf8"),
    readFile(new URL("app/community/page.tsx", root), "utf8"),
  ]);

  assert.match(loginSheet, /termsAccepted/);
  assert.match(agreement, /무관용 원칙/);
  assert.match(sendCode, /payload\.termsAccepted !== true/);
  assert.match(reviewLogin, /payload\.termsAccepted !== true/);
  assert.match(activityRoute, /hasUnsafeUserText\(title\)/);
  assert.match(activityDetailRoute, /hasUnsafeUserText\(notice\)/);
  assert.match(profileInput, /hasUnsafeUserText\(nickname\)/);
  assert.match(userProfile, /운영자에게 신고하고 차단/);
  assert.match(blockRoute, /user_reported_and_blocked/);
  assert.match(terms, /24시간 이내/);
  assert.match(community, /영구 퇴출/);
});

test("adds paginated comments to each activity detail", async () => {
  const [detailSheet, comments, commentsStyles] = await Promise.all([
    readFile(new URL("components/activity/detail-sheet.tsx", root), "utf8"),
    readFile(new URL("components/activity/activity-comments.tsx", root), "utf8"),
    readFile(new URL("app/styles/comments.css", root), "utf8"),
  ]);

  assert.match(detailSheet, /ActivityComments/);
  assert.match(comments, /최근 댓글부터 20개씩 보여줘요/);
  assert.match(comments, /이전 댓글 더 보기/);
  assert.match(comments, /모임 종료 후 24시간/);
  assert.match(commentsStyles, /\.activity-comments/);
  assert.match(commentsStyles, /\.comment-card\.pinned/);
});

test("protects school data and ships an installable PWA", async () => {
  const [
    layout,
    manifestSource,
    serviceWorker,
    pwaButton,
    activityRoute,
    homeActivities,
    worker,
  ] = await Promise.all([
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("public/manifest.webmanifest", root), "utf8"),
    readFile(new URL("public/service-worker.js", root), "utf8"),
    readFile(new URL("components/layout/pwa-install-button.tsx", root), "utf8"),
    readFile(new URL("app/api/activities/route.ts", root), "utf8"),
    readFile(new URL("hooks/use-home-activities.ts", root), "utf8"),
    readFile(new URL("worker/index.ts", root), "utf8"),
  ]);
  const manifest = JSON.parse(manifestSource);

  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512"));
  assert.match(layout, /manifest: "\/manifest\.webmanifest"/);
  assert.match(pwaButton, /serviceWorker\.register/);
  assert.match(serviceWorker, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(serviceWorker, /offline\.html/);
  assert.match(activityRoute, /if \(!user\)/);
  assert.match(activityRoute, /status: 401/);
  assert.match(homeActivities, /canLoad/);
  assert.match(worker, /Service-Worker-Allowed/);
  await Promise.all([
    access(new URL("public/icons/icon-192.png", root)),
    access(new URL("public/icons/icon-512.png", root)),
    access(new URL("public/icons/apple-touch-icon.png", root)),
    access(new URL("public/offline.html", root)),
  ]);
});
