import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { newId } from "@taweed/shared";
import { getPool, withTenant, schema, type Pool } from "../src/index.js";
import { migrate, appConnectionString } from "./migrate.js";

// Review-fix #1 regression (HIGH): the authored-rule upsert (apps/web
// persistDraftRule) targets the PARTIAL unique index from migration 0007
// (`rules_tenant_key_version_idx ... WHERE rule_key IS NOT NULL`). Postgres can
// only infer a partial index as the ON CONFLICT arbiter when the statement repeats
// the predicate — without `targetWhere` every insert throws 42P10 and no authored
// rule can ever be saved. This test exercises the exact drizzle shape against real
// Postgres so the regression cannot ship silently again (the web layer has no
// vitest project of its own).

const adminUrl = process.env.DATABASE_URL ?? "";
const adminPool: Pool = getPool(adminUrl);
const pool: Pool = getPool(appConnectionString(adminUrl));

const tenantA = newId();

async function seedTenant(id: string): Promise<void> {
  const client = await adminPool.connect();
  try {
    await client.query("INSERT INTO tenants (id, name) VALUES ($1, $2)", [id, "Clinic A"]);
  } finally {
    client.release();
  }
}

function upsert(ruleKey: string, messageEn: string) {
  return withTenant(pool, tenantA, async (db) => {
    await db
      .insert(schema.rules)
      .values({
        tenant_id: sql`current_setting('app.tenant_id')::uuid`,
        rule_key: ruleKey,
        name: "authored",
        scope: "global",
        severity: "warn",
        field: "hasPreAuth",
        weight: 20,
        version: 1,
        message_en: messageEn,
        message_ar: "ar",
        condition: { all: [{ fact: "hasPreAuth", operator: "equal", value: false }] },
        authored_by: "llm",
        status: "draft",
        active: false,
      })
      .onConflictDoUpdate({
        target: [schema.rules.tenant_id, schema.rules.rule_key, schema.rules.version],
        targetWhere: sql`${schema.rules.rule_key} IS NOT NULL`,
        set: { message_en: messageEn, status: "draft", active: false },
      });
  });
}

beforeAll(async () => {
  await migrate(adminPool);
  await seedTenant(tenantA);
}, 60_000);

afterAll(async () => {
  await pool.end();
  await adminPool.end();
});

describe("authored-rule partial-index upsert (ON CONFLICT arbiter)", () => {
  it("persists a first draft without 42P10", async () => {
    const key = `R-LLM-${newId().replace(/-/g, "").slice(0, 8)}`;
    await expect(upsert(key, "first")).resolves.not.toThrow();
    const rows = await withTenant(pool, tenantA, (db) =>
      db.select().from(schema.rules).where(eq(schema.rules.rule_key, key)),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.message_en).toBe("first");
  });

  it("is an idempotent update on the same (tenant, rule_key, version) — no duplicate row", async () => {
    const key = `R-LLM-${newId().replace(/-/g, "").slice(0, 8)}`;
    await upsert(key, "first");
    await upsert(key, "second"); // re-author same version -> UPDATE, not a 42P10 or a 2nd row
    const rows = await withTenant(pool, tenantA, (db) =>
      db
        .select()
        .from(schema.rules)
        .where(and(eq(schema.rules.rule_key, key), eq(schema.rules.version, 1))),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.message_en).toBe("second");
  });
});
