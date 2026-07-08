import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { getPool, withTenant, type Pool } from "../src/index.js";
import { appConnectionString } from "./migrate.js";

// Audit finding (docs/review.md): the entire tenant-isolation enforcement
// model (NOBYPASSRLS taweed_app role, blanket GRANT, and the REVOKEs that
// make RLS + append-only actually bind) used to live ONLY in
// packages/db/test/migrate.ts's ensureAppRole() — a TS helper reachable only
// through the test-only, schema-dropping migrate() script. If production
// were ever provisioned by applying drizzle/*.sql through any OTHER
// tool/process (a generic CI migration runner, `psql -f`, etc.), that TS step
// would never run and RLS would never bind to app traffic.
//
// This test proves the fix: it applies ONLY the raw drizzle/*.sql files, in
// order, via a plain pg client — with NO call into any @taweed/db TS helper
// that provisions the role. That is exactly what "any other tool" would do.
// Before the fix (grants only in ensureAppRole) this fails outright — the
// `taweed_app` role does not exist, so `getPool(appConnectionString(...))`
// cannot even connect. After the fix (grants moved into
// drizzle/0010_app_role_grants.sql) it passes, because the SQL files alone
// establish every guarantee.
const DRIZZLE_DIR = new URL("../drizzle/", import.meta.url);

async function applyRawSqlFilesOnly(pool: Pool): Promise<void> {
  const files = readdirSync(DRIZZLE_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = await pool.connect();
  try {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE;");
    await client.query("CREATE SCHEMA public;");
    for (const file of files) {
      const contents = readFileSync(
        fileURLToPath(new URL(file, DRIZZLE_DIR)),
        "utf8",
      );
      await client.query(contents);
    }
  } finally {
    client.release();
  }
}

const adminUrl = process.env.DATABASE_URL ?? "";
const adminPool: Pool = getPool(adminUrl);
let appPool: Pool;

beforeAll(async () => {
  await applyRawSqlFilesOnly(adminPool);
  appPool = getPool(appConnectionString(adminUrl));
}, 60_000);

afterAll(async () => {
  await appPool?.end();
  await adminPool.end();
});

describe("raw drizzle/*.sql alone (no TS grant helper) provisions the app role", () => {
  it("creates taweed_app as LOGIN + NOBYPASSRLS", async () => {
    const { rows } = await adminPool.query<{
      rolcanlogin: boolean;
      rolbypassrls: boolean;
    }>(
      "SELECT rolcanlogin, rolbypassrls FROM pg_roles WHERE rolname = $1",
      ["taweed_app"],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.rolcanlogin).toBe(true);
    expect(rows[0]!.rolbypassrls).toBe(false);
  });

  it("revokes ALL app-role access to tenants", async () => {
    await expect(
      appPool.query("SELECT * FROM tenants"),
    ).rejects.toThrow(/permission denied/i);
  });

  it("denies the app role UPDATE and DELETE on llm_calls (append-only)", async () => {
    await expect(
      appPool.query("UPDATE llm_calls SET model = 'tampered'"),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      appPool.query("DELETE FROM llm_calls"),
    ).rejects.toThrow(/permission denied/i);
  });

  it("denies the app role UPDATE and DELETE on audit_logs (append-only)", async () => {
    await expect(
      appPool.query("UPDATE audit_logs SET actor = 'tampered'"),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      appPool.query("DELETE FROM audit_logs"),
    ).rejects.toThrow(/permission denied/i);
  });

  it("still lets the app role read/write tenant-scoped tables under RLS", async () => {
    const tenantId = "00000000-0000-0000-0000-000000000001";
    await adminPool.query("INSERT INTO tenants (id, name) VALUES ($1, $2)", [
      tenantId,
      "Clinic Grants-Test",
    ]);

    await withTenant(appPool, tenantId, async (db) => {
      await db.execute(
        sql`INSERT INTO branches (tenant_id, name, city) VALUES (${tenantId}::uuid, 'Main', 'Riyadh')`,
      );
      const rows = await db.execute(sql`SELECT * FROM branches`);
      expect(rows.rows).toHaveLength(1);
    });
  });
});
