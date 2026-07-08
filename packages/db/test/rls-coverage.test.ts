import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { TENANT_SCOPED_TABLES } from "../src/schema.js";

// Regression guard for the "every TENANT_SCOPED_TABLES entry has RLS" audit
// finding (docs/review.md): confirms ENABLE ROW LEVEL SECURITY, FORCE ROW
// LEVEL SECURITY, and a tenant_isolation_* policy exist for every table in the
// list, across ALL drizzle migrations (not just 0001_rls.sql — later
// migrations such as 0005/0006/0007/0009 add their own tenant-scoped tables
// and must carry the same triad). This is a static/text-level check —
// packages/db/test/integration.int.test.ts separately proves the isolation
// behaves correctly against a live Postgres role.
//
// Without this test, a future migration that adds a table to
// TENANT_SCOPED_TABLES without granting it RLS (or that accidentally drops
// the FORCE clause / policy) would only be caught by a manual audit, not CI.
describe("RLS coverage for TENANT_SCOPED_TABLES", () => {
  const drizzleDir = fileURLToPath(new URL("../drizzle", import.meta.url));
  const migrationSql = readdirSync(drizzleDir)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => readFileSync(`${drizzleDir}/${name}`, "utf8"))
    .join("\n");

  it.each(TENANT_SCOPED_TABLES)(
    "%s has ENABLE + FORCE ROW LEVEL SECURITY and a tenant_isolation policy",
    (table) => {
      const enableRe = new RegExp(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`,
      );
      const forceRe = new RegExp(
        `ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`,
      );
      const policyRe = new RegExp(
        `CREATE POLICY "tenant_isolation_${table}" ON "${table}"`,
      );

      expect(migrationSql).toMatch(enableRe);
      expect(migrationSql).toMatch(forceRe);
      expect(migrationSql).toMatch(policyRe);
    },
  );

  it("does not silently drift: every table array-checked above is non-empty", () => {
    // Guards against a refactor that empties TENANT_SCOPED_TABLES and turns
    // every it.each assertion above into a vacuous no-op.
    expect(TENANT_SCOPED_TABLES.length).toBeGreaterThan(0);
  });
});
