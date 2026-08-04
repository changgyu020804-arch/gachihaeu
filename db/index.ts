import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

let schemaReady: Promise<void> | null = null;
const runtimeEnv = env as unknown as { DB?: D1Database };

export function getD1() {
  if (!runtimeEnv.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB`.",
    );
  }
  return runtimeEnv.DB;
}

export async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = getD1();
      await db.batch([
        db.prepare(
          `CREATE TABLE IF NOT EXISTS activities (
            id TEXT PRIMARY KEY NOT NULL,
            creator_email TEXT NOT NULL,
            creator_name TEXT NOT NULL,
            sport TEXT NOT NULL,
            title TEXT NOT NULL,
            venue TEXT NOT NULL,
            starts_at TEXT NOT NULL,
            duration_minutes INTEGER NOT NULL,
            capacity INTEGER NOT NULL,
            level TEXT NOT NULL,
            description TEXT DEFAULT '' NOT NULL,
            notice TEXT DEFAULT '' NOT NULL,
            notice_updated_at TEXT,
            status TEXT DEFAULT 'open' NOT NULL,
            facility_reserved INTEGER DEFAULT 0 NOT NULL,
            cancellation_deadline_minutes INTEGER DEFAULT 60 NOT NULL,
            cancellation_reason TEXT DEFAULT '' NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
          )`,
        ),
        db.prepare(
          `CREATE TABLE IF NOT EXISTS participants (
            activity_id TEXT NOT NULL,
            user_email TEXT NOT NULL,
            display_name TEXT NOT NULL,
            attendance_status TEXT DEFAULT 'pending' NOT NULL,
            joined_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY (activity_id, user_email),
            FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
          )`,
        ),
        db.prepare(
          `CREATE TABLE IF NOT EXISTS reports (
            id TEXT PRIMARY KEY NOT NULL,
            activity_id TEXT NOT NULL,
            reporter_email TEXT NOT NULL,
            reason TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
            FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
          )`,
        ),
        db.prepare(
          "CREATE INDEX IF NOT EXISTS activities_starts_at_idx ON activities(starts_at)",
        ),
        db.prepare(
          "CREATE INDEX IF NOT EXISTS activities_creator_idx ON activities(creator_email)",
        ),
        db.prepare(
          "CREATE INDEX IF NOT EXISTS activities_status_idx ON activities(status)",
        ),
        db.prepare(
          "CREATE INDEX IF NOT EXISTS participants_user_idx ON participants(user_email)",
        ),
        db.prepare(
          "CREATE UNIQUE INDEX IF NOT EXISTS reports_activity_reporter_idx ON reports(activity_id, reporter_email)",
        ),
        db.prepare(
          `CREATE TABLE IF NOT EXISTS user_profiles (
            email TEXT PRIMARY KEY NOT NULL,
            nickname TEXT DEFAULT '' NOT NULL,
            gender TEXT DEFAULT '' NOT NULL,
            department TEXT DEFAULT '' NOT NULL,
            bio TEXT DEFAULT '' NOT NULL,
            preferred_sports TEXT DEFAULT '' NOT NULL,
            onboarding_completed INTEGER DEFAULT 0 NOT NULL,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
          )`,
        ),
        db.prepare(
          `CREATE TABLE IF NOT EXISTS ratings (
            id TEXT PRIMARY KEY NOT NULL,
            activity_id TEXT NOT NULL,
            rater_email TEXT NOT NULL,
            rated_email TEXT NOT NULL,
            trust_score INTEGER NOT NULL,
            skill_score INTEGER NOT NULL,
            manner_score INTEGER NOT NULL,
            rating_type TEXT DEFAULT 'legacy' NOT NULL,
            comment TEXT DEFAULT '' NOT NULL,
            comment_hidden INTEGER DEFAULT 0 NOT NULL,
            reported_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
            FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
          )`,
        ),
        db.prepare(
          "CREATE UNIQUE INDEX IF NOT EXISTS ratings_unique_idx ON ratings(activity_id, rater_email, rated_email)",
        ),
        db.prepare(
          "CREATE INDEX IF NOT EXISTS ratings_rated_idx ON ratings(rated_email)",
        ),
        db.prepare(
          "CREATE INDEX IF NOT EXISTS ratings_activity_idx ON ratings(activity_id)",
        ),
        db.prepare(
          `CREATE TABLE IF NOT EXISTS auth_codes (
            email TEXT PRIMARY KEY NOT NULL,
            code_hash TEXT NOT NULL,
            attempts INTEGER DEFAULT 0 NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
          )`,
        ),
        db.prepare(
          `CREATE TABLE IF NOT EXISTS security_rate_limits (
            action TEXT NOT NULL,
            key_hash TEXT NOT NULL,
            window_bucket INTEGER NOT NULL,
            request_count INTEGER DEFAULT 1 NOT NULL,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY (action, key_hash, window_bucket)
          )`,
        ),
        db.prepare(
          `CREATE TABLE IF NOT EXISTS security_audit_logs (
            id TEXT PRIMARY KEY NOT NULL,
            event_type TEXT NOT NULL,
            subject_hash TEXT NOT NULL,
            ip_hash TEXT NOT NULL,
            detail TEXT DEFAULT '' NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
          )`,
        ),
        db.prepare(
          "CREATE INDEX IF NOT EXISTS security_rate_limits_updated_idx ON security_rate_limits(updated_at)",
        ),
        db.prepare(
          "CREATE INDEX IF NOT EXISTS security_audit_logs_created_idx ON security_audit_logs(created_at)",
        ),
        db.prepare(
          "CREATE INDEX IF NOT EXISTS security_audit_logs_event_idx ON security_audit_logs(event_type, created_at)",
        ),
        db.prepare(
          `CREATE TABLE IF NOT EXISTS waitlist (
            activity_id TEXT NOT NULL,
            user_email TEXT NOT NULL,
            display_name TEXT NOT NULL,
            position INTEGER NOT NULL,
            status TEXT DEFAULT 'waiting' NOT NULL,
            queued_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY (activity_id, user_email),
            FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
          )`,
        ),
        db.prepare(
          "CREATE INDEX IF NOT EXISTS waitlist_activity_position_idx ON waitlist(activity_id, position)",
        ),
        db.prepare(
          `CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY NOT NULL,
            user_email TEXT NOT NULL,
            activity_id TEXT,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            dedupe_key TEXT NOT NULL,
            read_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
          )`,
        ),
        db.prepare(
          "CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_dedupe_idx ON notifications(user_email, dedupe_key)",
        ),
        db.prepare(
          "CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications(user_email, created_at)",
        ),
        db.prepare(
          "CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON notifications(user_email, read_at)",
        ),
        db.prepare(
          `CREATE TABLE IF NOT EXISTS user_reports (
            id TEXT PRIMARY KEY NOT NULL,
            reporter_email TEXT NOT NULL,
            reported_email TEXT NOT NULL,
            reason TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
          )`,
        ),
        db.prepare(
          "CREATE UNIQUE INDEX IF NOT EXISTS user_reports_pair_idx ON user_reports(reporter_email, reported_email)",
        ),
        db.prepare(
          "CREATE INDEX IF NOT EXISTS user_reports_reported_idx ON user_reports(reported_email)",
        ),
        db.prepare(
          `CREATE TABLE IF NOT EXISTS user_blocks (
            blocker_email TEXT NOT NULL,
            blocked_email TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY (blocker_email, blocked_email)
          )`,
        ),
        db.prepare(
          "CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx ON user_blocks(blocked_email)",
        ),
      ]);

      // CREATE TABLE IF NOT EXISTS는 기존 테이블에 새 컬럼을 추가하지 않으므로,
      // 이전 버전의 로컬/배포 D1 데이터베이스를 안전하게 보강한다.
      const activityColumns = await db
        .prepare("PRAGMA table_info(activities)")
        .all<{ name: string }>();
      const hasFacilityReserved = activityColumns.results.some(
        (column: { name: string }) => column.name === "facility_reserved",
      );

      if (!hasFacilityReserved) {
        await db
          .prepare(
            "ALTER TABLE activities ADD COLUMN facility_reserved INTEGER DEFAULT 0 NOT NULL",
          )
          .run();
      }
      if (!activityColumns.results.some((column: { name: string }) => column.name === "notice")) {
        await db
          .prepare("ALTER TABLE activities ADD COLUMN notice TEXT DEFAULT '' NOT NULL")
          .run();
      }
      if (!activityColumns.results.some((column: { name: string }) => column.name === "notice_updated_at")) {
        await db
          .prepare("ALTER TABLE activities ADD COLUMN notice_updated_at TEXT")
          .run();
      }
      if (
        !activityColumns.results.some(
          (column: { name: string }) => column.name === "cancellation_deadline_minutes",
        )
      ) {
        await db
          .prepare(
            "ALTER TABLE activities ADD COLUMN cancellation_deadline_minutes INTEGER DEFAULT 60 NOT NULL",
          )
          .run();
      }
      if (!activityColumns.results.some((column: { name: string }) => column.name === "cancellation_reason")) {
        await db
          .prepare(
            "ALTER TABLE activities ADD COLUMN cancellation_reason TEXT DEFAULT '' NOT NULL",
          )
          .run();
      }

      const participantColumns = await db
        .prepare("PRAGMA table_info(participants)")
        .all<{ name: string }>();
      if (!participantColumns.results.some((column: { name: string }) => column.name === "attendance_status")) {
        await db
          .prepare(
            "ALTER TABLE participants ADD COLUMN attendance_status TEXT DEFAULT 'pending' NOT NULL",
          )
          .run();
      }

      const profileColumns = await db
        .prepare("PRAGMA table_info(user_profiles)")
        .all<{ name: string }>();
      if (!profileColumns.results.some((column: { name: string }) => column.name === "gender")) {
        await db
          .prepare("ALTER TABLE user_profiles ADD COLUMN gender TEXT DEFAULT '' NOT NULL")
          .run();
      }
      if (
        !profileColumns.results.some(
          (column: { name: string }) => column.name === "onboarding_completed",
        )
      ) {
        await db
          .prepare(
            "ALTER TABLE user_profiles ADD COLUMN onboarding_completed INTEGER DEFAULT 0 NOT NULL",
          )
          .run();
      }

      const ratingColumns = await db
        .prepare("PRAGMA table_info(ratings)")
        .all<{ name: string }>();
      if (!ratingColumns.results.some((column: { name: string }) => column.name === "rating_type")) {
        await db
          .prepare(
            "ALTER TABLE ratings ADD COLUMN rating_type TEXT DEFAULT 'legacy' NOT NULL",
          )
          .run();
      }
      if (!ratingColumns.results.some((column: { name: string }) => column.name === "comment_hidden")) {
        await db
          .prepare(
            "ALTER TABLE ratings ADD COLUMN comment_hidden INTEGER DEFAULT 0 NOT NULL",
          )
          .run();
      }
      if (!ratingColumns.results.some((column: { name: string }) => column.name === "reported_at")) {
        await db
          .prepare("ALTER TABLE ratings ADD COLUMN reported_at TEXT")
          .run();
      }

      // 인증번호는 짧게 유지되는 임시 데이터이므로 구버전 평문 코드
      // 테이블이 발견되면 데이터를 이전하지 않고 안전하게 폐기한다.
      const authCodeColumns = await db
        .prepare("PRAGMA table_info(auth_codes)")
        .all<{ name: string }>();
      const hasSecureAuthCodeShape =
        authCodeColumns.results.some((column: { name: string }) => column.name === "code_hash") &&
        authCodeColumns.results.some((column: { name: string }) => column.name === "attempts") &&
        !authCodeColumns.results.some((column: { name: string }) => column.name === "code");

      if (!hasSecureAuthCodeShape) {
        await db.prepare("DROP TABLE auth_codes").run();
        await db
          .prepare(
            `CREATE TABLE auth_codes (
              email TEXT PRIMARY KEY NOT NULL,
              code_hash TEXT NOT NULL,
              attempts INTEGER DEFAULT 0 NOT NULL,
              expires_at TEXT NOT NULL,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
            )`,
          )
          .run();
      }

      await db.batch([
        db.prepare(
          "CREATE INDEX IF NOT EXISTS participants_attendance_idx ON participants(activity_id, attendance_status)",
        ),
        db.prepare(
          "CREATE INDEX IF NOT EXISTS ratings_type_idx ON ratings(rated_email, rating_type)",
        ),
        db.prepare(
          "DELETE FROM auth_codes WHERE datetime(expires_at) <= datetime('now')",
        ),
        db.prepare(
          "DELETE FROM security_rate_limits WHERE updated_at < datetime('now', '-2 days')",
        ),
        db.prepare(
          "DELETE FROM security_audit_logs WHERE created_at < datetime('now', '-90 days')",
        ),
      ]);

      // 이전 이름으로 저장된 모임도 새 장소명으로 통일한다.
      await db
        .prepare(
          "UPDATE activities SET venue = '대운동장 잔디구장' WHERE venue = '축구장'",
        )
        .run();
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

export function getDb() {
  return drizzle(getD1(), { schema });
}
