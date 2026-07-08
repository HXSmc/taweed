import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Pool } from "../src/client.js";

const DRIZZLE_DIR = new URL("../drizzle/", import.meta.url);

/**
 * The migration/admin connection is a superuser (bypasses RLS). Real app
 * queries must run as a NON-superuser, NOBYPASSRLS role for RLS to bind — this
 * mirrors production (app connects as a least-privilege role, migrations as an
 * admin). Created here so integration tests can prove isolation.
 */
export const APP_ROLE = "taweed_app";
export const APP_PASSWORD = "taweed";

/**
 * Guard against pointing this destructive reset at anything that isn't an
 * obviously-local/test database. `migrate()` runs `DROP SCHEMA public CASCADE`,
 * so refuse unless the target host is loopback or the caller explicitly opts in
 * via TAWEED_ALLOW_DESTRUCTIVE_MIGRATE=1.
 */
function assertDestructiveAllowed(): void {
  if (process.env.TAWEED_ALLOW_DESTRUCTIVE_MIGRATE === "1") return;
  const url = process.env.DATABASE_URL;
  const host = url ? new URL(url).hostname : "";
  const isLocal =
    host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (!isLocal) {
    throw new Error(
      `Refusing destructive migrate against non-local host "${host}". ` +
        `Set TAWEED_ALLOW_DESTRUCTIVE_MIGRATE=1 to override.`,
    );
  }
}

/**
 * Reset `public` and apply every drizzle/*.sql migration in order (base DDL,
 * RLS, app-role provisioning, then indexes). Deliberately destructive so
 * integration tests start from a clean, deterministic schema. NOT for
 * production — production applies these same *.sql files forward-only.
 *
 * The app role (`taweed_app`, NOBYPASSRLS), its blanket GRANT, and the
 * REVOKEs that make `tenants`/`audit_logs`/`llm_calls` actually enforced are
 * provisioned entirely by `drizzle/0010_app_role_grants.sql` — the last file
 * in this loop — NOT by any TS code here. That is deliberate: it means the
 * enforcement travels with the SQL, so any tool that applies drizzle/*.sql in
 * order (not just this test harness) establishes the same guarantees. See
 * that file's header for the audit finding this fixes.
 */
export async function migrate(pool: Pool): Promise<void> {
  assertDestructiveAllowed();

  const files = readdirSync(DRIZZLE_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = await pool.connect();
  try {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE;");
    await client.query("CREATE SCHEMA public;");
    for (const file of files) {
      const sql = readFileSync(
        fileURLToPath(new URL(file, DRIZZLE_DIR)),
        "utf8",
      );
      await client.query(sql);
    }
  } finally {
    client.release();
  }
}

/** Derive the app-role connection URL from an admin DATABASE_URL. */
export function appConnectionString(adminUrl: string): string {
  const url = new URL(adminUrl);
  url.username = APP_ROLE;
  url.password = APP_PASSWORD;
  return url.toString();
}
