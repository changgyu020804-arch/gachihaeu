import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

let schemaReady: Promise<void> | null = null;

export function getD1() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB`.",
    );
  }
  return env.DB;
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
            status TEXT DEFAULT 'open' NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
          )`,
        ),
        db.prepare(
          `CREATE TABLE IF NOT EXISTS participants (
            activity_id TEXT NOT NULL,
            user_email TEXT NOT NULL,
            display_name TEXT NOT NULL,
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
      ]);
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
