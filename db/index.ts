import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

const runtimeEnv = env as unknown as { DB?: D1Database };

export function getD1() {
  if (!runtimeEnv.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB`.",
    );
  }
  return runtimeEnv.DB;
}

export function getDb() {
  return drizzle(getD1(), { schema });
}
