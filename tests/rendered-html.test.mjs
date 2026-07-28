import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("uses the finished 같이해U product shell", async () => {
  const [page, layout, home] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/home-client.tsx", root), "utf8"),
  ]);

  assert.match(page, /<HomeClient/);
  assert.match(layout, /같이해U \| 서울시립대 운동 메이트/);
  assert.match(home, /장소별 모임/);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
  await assert.rejects(
    access(new URL("app/_sites-preview/SkeletonPreview.tsx", root)),
  );
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
