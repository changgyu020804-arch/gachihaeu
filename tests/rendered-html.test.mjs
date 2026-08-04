import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("uses the finished 같이해U product shell", async () => {
  const [page, layout, home, venues] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/home-client.tsx", root), "utf8"),
    readFile(new URL("app/components/venue-section.tsx", root), "utf8"),
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
    homeActivities,
    loginSheet,
    loginStepForms,
    profileSheet,
    profileEditForm,
    ratingSheet,
    ratingCard,
    layout,
    baseStyles,
    ratingStyles,
  ] =
    await Promise.all([
      readFile(new URL("app/home-client.tsx", root), "utf8"),
      readFile(new URL("app/hooks/use-home-activities.ts", root), "utf8"),
      readFile(new URL("app/components/login-sheet.tsx", root), "utf8"),
      readFile(new URL("app/components/login-step-forms.tsx", root), "utf8"),
      readFile(new URL("app/components/profile-sheet.tsx", root), "utf8"),
      readFile(new URL("app/components/profile-edit-form.tsx", root), "utf8"),
      readFile(new URL("app/components/rating-sheet.tsx", root), "utf8"),
      readFile(new URL("app/components/rating-participant-card.tsx", root), "utf8"),
      readFile(new URL("app/layout.tsx", root), "utf8"),
      readFile(new URL("app/styles/base.css", root), "utf8"),
      readFile(new URL("app/styles/ratings.css", root), "utf8"),
    ]);

  assert.ok(home.split("\n").length < 330);
  assert.match(home, /useHomeActivities/);
  assert.match(homeActivities, /visibleActivities/);
  assert.ok(loginSheet.split("\n").length < 250);
  assert.match(loginSheet, /ProfileSetupForm/);
  assert.match(loginStepForms, /CAMPUS_ROLES/);
  assert.ok(profileSheet.split("\n").length < 230);
  assert.match(profileSheet, /ProfileEditForm/);
  assert.match(profileEditForm, /preferredSports/);
  assert.ok(ratingSheet.split("\n").length < 250);
  assert.match(ratingSheet, /RatingParticipantCard/);
  assert.match(ratingCard, /ATTENDANCE_OPTIONS/);
  assert.match(layout, /styles\/base\.css/);
  assert.match(layout, /styles\/notifications\.css/);
  assert.match(baseStyles, /@import "tailwindcss"/);
  assert.match(ratingStyles, /rate-participant/);
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
      readFile(new URL("app/components/rating-sheet.tsx", root), "utf8"),
      readFile(new URL("app/components/reputation-panel.tsx", root), "utf8"),
      readFile(new URL("drizzle/0002_lively_sabra.sql", root), "utf8"),
    ]);

  assert.match(ratingRoute, /구성원은 모임장만 평가할 수 있어요/);
  assert.match(ratingRoute, /참석이 확인된 구성원만 평가할 수 있어요/);
  assert.match(participantRoute, /모임장만 출석을 확인할 수 있어요/);
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
      readFile(new URL("app/components/notification-sheet.tsx", root), "utf8"),
      readFile(new URL("app/notification-store.ts", root), "utf8"),
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
    readFile(new URL("app/components/detail-sheet.tsx", root), "utf8"),
    readFile(new URL("app/reputation.ts", root), "utf8"),
    readFile(new URL("app/components/user-profile-sheet.tsx", root), "utf8"),
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
  assert.match(userProfile, /사용자 차단/);
  assert.match(blockRoute, /INSERT OR IGNORE INTO user_blocks/);
  assert.match(reportRoute, /같은 모임에 참여한 사용자만 신고할 수 있어요/);
  assert.match(migration, /CREATE TABLE `user_blocks`/);
  assert.match(migration, /cancellation_deadline_minutes/);
});
