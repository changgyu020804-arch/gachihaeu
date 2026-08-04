import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { createCurrentSchema } from "./bootstrap-current";
import { upgradeLegacySchema } from "./bootstrap-legacy";
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

export function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = getD1();
      await createCurrentSchema(db);
      await upgradeLegacySchema(db);
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
