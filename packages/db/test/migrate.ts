import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Pool } from "../src/client.js";

const DRIZZLE_DIR = new URL("../drizzle/", import.meta.url);

/**
 * Reset `public` and apply every drizzle/*.sql migration in order (base DDL
 * then RLS). Deliberately destructive so integration tests start from a clean,
 * deterministic schema. NOT for production — production uses a forward-only
 * migrator (deferred to DEPLOY).
 */
export async function migrate(pool: Pool): Promise<void> {
  const files = readdirSync(DRIZZLE_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = await pool.connect();
  try {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE;");
    await client.query("CREATE SCHEMA public;");
    for (const file of files) {
      const sql = readFileSync(fileURLToPath(new URL(file, DRIZZLE_DIR)), "utf8");
      await client.query(sql);
    }
    await ensureAppRole(client);
  } finally {
    client.release();
  }
}

/**
 * The migration/admin connection is a superuser (bypasses RLS). Real app
 * queries must run as a NON-superuser, NOBYPASSRLS role for RLS to bind — this
 * mirrors production (app connects as a least-privilege role, migrations as an
 * admin). Created here so integration tests can prove isolation.
 */
export const APP_ROLE = "taweed_app";
export const APP_PASSWORD = "taweed";

async function ensureAppRole(client: {
  query: (sql: string) => Promise<unknown>;
}): Promise<void> {
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${APP_ROLE}') THEN
        CREATE ROLE ${APP_ROLE} LOGIN PASSWORD '${APP_PASSWORD}' NOBYPASSRLS;
      END IF;
    END
    $$;`);
  await client.query(`GRANT USAGE ON SCHEMA public TO ${APP_ROLE};`);
  await client.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_ROLE};`,
  );
}

/** Derive the app-role connection URL from an admin DATABASE_URL. */
export function appConnectionString(adminUrl: string): string {
  const url = new URL(adminUrl);
  url.username = APP_ROLE;
  url.password = APP_PASSWORD;
  return url.toString();
}
