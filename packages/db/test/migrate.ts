import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";
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
 * RLS, then indexes). Deliberately destructive so integration tests start from
 * a clean, deterministic schema. NOT for production — production uses a
 * forward-only migrator (deferred to DEPLOY).
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
    await ensureAppRole(client);
  } finally {
    client.release();
  }
}

async function ensureAppRole(client: pg.PoolClient): Promise<void> {
  // Identifiers/literals are escaped even though they are constants today, so
  // this stays safe if APP_ROLE/APP_PASSWORD ever become configurable.
  const role = client.escapeIdentifier(APP_ROLE);
  const password = client.escapeLiteral(APP_PASSWORD);
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = ${client.escapeLiteral(
        APP_ROLE,
      )}) THEN
        CREATE ROLE ${role} LOGIN PASSWORD ${password} NOBYPASSRLS;
      END IF;
    END
    $$;`);
  await client.query(`GRANT USAGE ON SCHEMA public TO ${role};`);
  await client.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role};`,
  );
  // `tenants` is the RLS-less isolation root — the app role must not read/write
  // it directly (that would expose every tenant's identity). Seeding/admin of
  // tenants goes through the superuser/admin connection only.
  await client.query(`REVOKE ALL ON TABLE tenants FROM ${role};`);
  // `llm_calls` is an APPEND-ONLY compliance trail (0006 header): the app role
  // may INSERT + SELECT but must NEVER UPDATE or DELETE an audit row. The blanket
  // GRANT above (UPDATE, DELETE ON ALL TABLES) re-grants those on every table, so
  // this REVOKE must run AFTER it — a REVOKE placed inside 0006_llm_calls.sql
  // would be silently clobbered by this ensureAppRole() call, which runs last.
  // The production forward-only migrator MUST preserve this same REVOKE.
  await client.query(`REVOKE UPDATE, DELETE ON TABLE llm_calls FROM ${role};`);
}

/** Derive the app-role connection URL from an admin DATABASE_URL. */
export function appConnectionString(adminUrl: string): string {
  const url = new URL(adminUrl);
  url.username = APP_ROLE;
  url.password = APP_PASSWORD;
  return url.toString();
}
