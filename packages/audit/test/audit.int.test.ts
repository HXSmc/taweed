import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { newId } from "@taweed/shared";
import { getPool, withTenant, schema, type Pool } from "@taweed/db";
import { logAudit } from "../src/index.js";
// Reuse @taweed/db's test harness directly (relative file import — it is not a
// package export). migrate() resets the schema + applies RLS; appConnectionString
// derives the NOBYPASSRLS app-role URL so RLS actually binds to our queries.
import { migrate, appConnectionString } from "../../db/test/migrate.js";

// Admin pool (superuser) runs migrations + seeds tenants; app pool
// (NOBYPASSRLS role) runs all tenant queries so RLS binds.
const adminUrl = process.env.DATABASE_URL ?? "";
const adminPool: Pool = getPool(adminUrl);
const pool: Pool = getPool(appConnectionString(adminUrl));

const tenantA = newId();
const tenantB = newId();

async function seedTenant(id: string, name: string): Promise<void> {
  // tenants has no RLS and the app role has no access to it — seed via admin.
  const client = await adminPool.connect();
  try {
    await client.query("INSERT INTO tenants (id, name) VALUES ($1, $2)", [
      id,
      name,
    ]);
  } finally {
    client.release();
  }
}

beforeAll(async () => {
  await migrate(adminPool);
  await seedTenant(tenantA, "Clinic A");
  await seedTenant(tenantB, "Clinic B");
}, 60_000);

afterAll(async () => {
  await pool.end();
  await adminPool.end();
});

describe("logAudit — append-only, tenant-scoped audit row (RLS active)", () => {
  it("appends exactly one row attributed to the active RLS tenant", async () => {
    await withTenant(pool, tenantA, async (db) => {
      await logAudit(db, {
        actor: "user-1",
        action: "read",
        entity: "claim",
        entityId: "claim-123",
        ip: "10.0.0.1",
      });
    });

    await withTenant(pool, tenantA, async (db) => {
      const rows = await db.select().from(schema.auditLogs);
      expect(rows).toHaveLength(1);
      // tenant_id came from current_setting('app.tenant_id'), NOT the entry, so
      // it must equal the transaction's tenant — never misattributed.
      expect(rows[0]!.tenant_id).toBe(tenantA);
      expect(rows[0]!.action).toBe("read");
      expect(rows[0]!.entity).toBe("claim");
      expect(rows[0]!.entity_id).toBe("claim-123");
      expect(rows[0]!.actor).toBe("user-1");
      expect(rows[0]!.ip).toBe("10.0.0.1");
    });
  });

  it("RLS hides tenant A's audit rows from tenant B", async () => {
    await withTenant(pool, tenantB, async (db) => {
      const rows = await db.select().from(schema.auditLogs);
      expect(rows).toHaveLength(0);
    });
  });

  it("denies the app role UPDATE and DELETE on audit_logs (append-only by privilege)", async () => {
    // drizzle wraps the pg error as "Failed query: …"; the real cause carries the
    // permission-denied message + SQLSTATE 42501. Each in its own transaction.
    const expectDenied = async (run: Promise<unknown>): Promise<void> => {
      let caught: unknown = null;
      try {
        await run;
      } catch (e) {
        caught = e;
      }
      expect(caught, "expected the query to be rejected").not.toBeNull();
      const e = caught as {
        message?: string;
        cause?: { message?: string; code?: string };
      };
      const chain = `${e.message ?? ""} ${e.cause?.message ?? ""} ${e.cause?.code ?? ""}`;
      expect(chain).toMatch(/permission denied|42501/i);
    };

    await expectDenied(
      withTenant(pool, tenantA, (db) =>
        db.execute(sql`UPDATE audit_logs SET actor = 'tampered'`),
      ),
    );
    await expectDenied(
      withTenant(pool, tenantA, (db) =>
        db.execute(sql`DELETE FROM audit_logs`),
      ),
    );

    // INSERT + SELECT stay allowed (append-only, not read-blocked): tenantA has a
    // row from the first test, still visible.
    const rows = await withTenant(pool, tenantA, (db) =>
      db.select().from(schema.auditLogs),
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });
});
