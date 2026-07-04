import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseBundle } from "@taweed/fhir";
import { normalize, type NormalizeContext } from "@taweed/normalizer";
import { generateBundle } from "@taweed/synthetic-fhir";
import { newId } from "@taweed/shared";
import {
  getPool,
  withTenant,
  insertNormalizedClaim,
  schema,
  type Pool,
} from "../src/index.js";
import { migrate, appConnectionString } from "./migrate.js";

// Admin pool (superuser) runs migrations; app pool (NOBYPASSRLS role) runs all
// tenant queries so RLS actually binds.
const adminUrl = process.env.DATABASE_URL ?? "";
const adminPool: Pool = getPool(adminUrl);
const pool: Pool = getPool(appConnectionString(adminUrl));

const tenantA = newId();
const tenantB = newId();
const ctxA: NormalizeContext = {
  tenantId: tenantA,
  branchId: newId(),
  providerId: newId(),
  payerId: newId(),
  patientId: newId(),
};

async function seedTenant(id: string, name: string): Promise<void> {
  const client = await pool.connect();
  try {
    // tenants has no RLS (it is the isolation root) — insert directly.
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

  await withTenant(pool, tenantA, async (db) => {
    await db.insert(schema.branches).values({
      id: ctxA.branchId,
      tenant_id: tenantA,
      name: "Main Branch",
      city: "Riyadh",
      license: null,
    });
    await db.insert(schema.providers).values({
      id: ctxA.providerId,
      tenant_id: tenantA,
      name: "Dr. Placeholder",
      specialty: null,
      nphies_practitioner_id: null,
    });
    await db.insert(schema.payers).values({
      id: ctxA.payerId,
      tenant_id: tenantA,
      name: "Placeholder Insurer",
      nphies_payer_id: null,
      type: "insurer",
    });
    await db.insert(schema.patients).values({
      id: ctxA.patientId,
      tenant_id: tenantA,
      pseudonym: "pat-001",
      birth_year: 1990,
      gender: "unknown",
    });
  });
}, 60_000);

afterAll(async () => {
  await pool.end();
  await adminPool.end();
});

describe("full parse → normalize → insert into Postgres (RLS active)", () => {
  it("persists a partial-denial claim as canonical rows for its tenant", async () => {
    const { pairs, issues } = parseBundle(generateBundle("partialDenial", 7));
    expect(issues).toHaveLength(0);
    const normalized = normalize(pairs[0]!, ctxA);

    await withTenant(pool, tenantA, async (db) => {
      await insertNormalizedClaim(db, normalized);
    });

    await withTenant(pool, tenantA, async (db) => {
      const claims = await db.select().from(schema.claims);
      const lines = await db.select().from(schema.claimLines);
      const responses = await db.select().from(schema.claimResponses);
      const denials = await db.select().from(schema.denials);

      expect(claims).toHaveLength(1);
      expect(lines).toHaveLength(3); // partialDenial => 3 lines
      expect(responses).toHaveLength(1);
      expect(denials).toHaveLength(1); // one line denied, one reason
      expect(claims[0]!.tenant_id).toBe(tenantA);
      expect(claims[0]!.nphies_claim_id).toBe(pairs[0]!.claim.id);
    });
  });

  it("RLS hides tenant A's rows from tenant B", async () => {
    await withTenant(pool, tenantB, async (db) => {
      const claims = await db.select().from(schema.claims);
      const denials = await db.select().from(schema.denials);
      expect(claims).toHaveLength(0);
      expect(denials).toHaveLength(0);
    });
  });

  it("RLS WITH CHECK rejects inserting another tenant's rows", async () => {
    const { pairs } = parseBundle(generateBundle("clean", 7));
    const foreign = normalize(pairs[0]!, ctxA); // tenant A rows

    await expect(
      withTenant(pool, tenantB, async (db) => {
        await insertNormalizedClaim(db, foreign); // GUC = B, rows = A
      }),
    ).rejects.toThrow();
  });
});
