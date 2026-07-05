import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseBundle } from "@taweed/fhir";
import { normalize, type NormalizeContext } from "@taweed/normalizer";
import { generateBundle, type ScenarioName } from "@taweed/synthetic-fhir";
import { newId } from "@taweed/shared";
import {
  getPool,
  withTenant,
  insertNormalizedClaim,
  schema,
  type Database,
  type Pool,
} from "@taweed/db";
import { denialRateBy, moneyScope, reasonPareto, trend } from "../src/index.js";
// Reuse the db package's destructive migrator + app-role helper (read-only
// import) so this suite stands up an identical schema with RLS FORCE active.
import { migrate, appConnectionString } from "../../db/test/migrate.js";

// Admin pool (superuser) migrates + seeds tenants; app pool (NOBYPASSRLS role)
// runs every analytics query so RLS actually scopes them — same split as the db
// integration suite.
const adminUrl = process.env.DATABASE_URL ?? "";
const adminPool: Pool = getPool(adminUrl);
const pool: Pool = getPool(appConnectionString(adminUrl));

const tenantA = newId();
const tenantB = newId();
const tenantC = newId();
const ctxA: NormalizeContext = {
  tenantId: tenantA,
  branchId: newId(),
  providerId: newId(),
  payerId: newId(),
  patientId: newId(),
  dataOrigin: "synthetic",
};

// Distinct seeds so each bundle carries a distinct nphies_claim_id (unique per
// tenant). Reason spread across scenarios: partialDenial => 1 denial (D03),
// fullDenial => 2 (D01,D05), multiReason => 2 on one line (D03,D06). 3 claims,
// 5 denials total, all under one payer/branch/provider (ctxA).
const SEEDED: ReadonlyArray<{ scenario: ScenarioName; seed: number }> = [
  { scenario: "partialDenial", seed: 11 },
  { scenario: "fullDenial", seed: 12 },
  { scenario: "multiReason", seed: 13 },
];

const WON_RECOVERED = "150.00";

async function seedTenant(id: string, name: string): Promise<void> {
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

async function seedDimensions(db: Database): Promise<void> {
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
}

beforeAll(async () => {
  await migrate(adminPool);
  await seedTenant(tenantA, "Clinic A");
  await seedTenant(tenantB, "Clinic B");

  await withTenant(pool, tenantA, async (db) => {
    await seedDimensions(db);
    for (const { scenario, seed } of SEEDED) {
      const { pairs, issues } = parseBundle(generateBundle(scenario, seed));
      expect(issues).toHaveLength(0);
      await insertNormalizedClaim(db, normalize(pairs[0]!, ctxA));
    }
  });

  // Attach appeals: one WON (recovered) and one DRAFT (still at risk), so
  // moneyScope can separate recovered from at-risk money.
  await withTenant(pool, tenantA, async (db) => {
    const denials = await db.select().from(schema.denials);
    expect(denials.length).toBe(5);
    await db.insert(schema.appeals).values({
      id: newId(),
      tenant_id: tenantA,
      denial_id: denials[0]!.id,
      status: "won",
      recovered_amount: WON_RECOVERED,
    });
    await db.insert(schema.appeals).values({
      id: newId(),
      tenant_id: tenantA,
      denial_id: denials[1]!.id,
      status: "draft",
      recovered_amount: null,
    });
  });

  // tenantC: a KNOWN partial win (denied 1000, recovered 600) to prove at-risk
  // keeps the 400 unrecovered remainder rather than excluding the whole denial.
  await seedTenant(tenantC, "Clinic C");
  await withTenant(pool, tenantC, async (db) => {
    const branchId = newId();
    const providerId = newId();
    const payerId = newId();
    const patientId = newId();
    const claimId = newId();
    const lineId = newId();
    const denialId = newId();
    await db.insert(schema.branches).values({
      id: branchId,
      tenant_id: tenantC,
      name: "C Branch",
      city: null,
      license: null,
    });
    await db.insert(schema.providers).values({
      id: providerId,
      tenant_id: tenantC,
      name: "C Provider",
      specialty: null,
      nphies_practitioner_id: null,
    });
    await db.insert(schema.payers).values({
      id: payerId,
      tenant_id: tenantC,
      name: "C Insurer",
      nphies_payer_id: null,
      type: "insurer",
    });
    await db.insert(schema.patients).values({
      id: patientId,
      tenant_id: tenantC,
      pseudonym: "pat-c",
      birth_year: 1990,
      gender: "unknown",
    });
    await db.insert(schema.claims).values({
      id: claimId,
      tenant_id: tenantC,
      branch_id: branchId,
      provider_id: providerId,
      payer_id: payerId,
      patient_id: patientId,
      nphies_claim_id: "C-CLM-1",
      status: "denied",
      submitted_at: "2026-03-01",
      total_amount: "1000.00",
      currency: "SAR",
      data_origin: "synthetic",
    });
    await db.insert(schema.claimLines).values({
      id: lineId,
      tenant_id: tenantC,
      claim_id: claimId,
      line_number: 1,
      sbs_code: null,
      icd10am_code: null,
      qty: 1,
      unit_price: "1000.00",
      line_amount: "1000.00",
    });
    await db.insert(schema.denials).values({
      id: denialId,
      tenant_id: tenantC,
      claim_line_id: lineId,
      reason_code: "TWD-D01",
      reason_text: null,
      category: null,
      denied_amount: "1000.00",
    });
    await db.insert(schema.appeals).values({
      id: newId(),
      tenant_id: tenantC,
      denial_id: denialId,
      status: "won",
      recovered_amount: "600.00",
    });
  });
}, 60_000);

afterAll(async () => {
  await pool.end();
  await adminPool.end();
});

describe("analytics rollups over the canonical model (RLS active)", () => {
  it("denialRateBy(reason) groups every denial by its reason code", async () => {
    await withTenant(pool, tenantA, async (db) => {
      const rows = await denialRateBy(db, "reason");
      const byCode = new Map(rows.map((r) => [r.key, r]));
      // 4 distinct codes: D01, D03(x2), D05, D06 => 5 denials total.
      expect(rows).toHaveLength(4);
      expect(rows.reduce((n, r) => n + r.denied, 0)).toBe(5);
      expect(byCode.get("TWD-D03")?.denied).toBe(2);
      // reason label resolves through the placeholder taxonomy.
      expect(byCode.get("TWD-D03")?.label).toBe(
        "Diagnosis / procedure mismatch",
      );
      // at-risk money is a valid 2-decimal SAR string.
      for (const r of rows) expect(r.atRiskSar).toMatch(/^\d+\.\d{2}$/);
    });
  });

  it("denialRateBy(payer) rolls all denials under the one seeded payer", async () => {
    await withTenant(pool, tenantA, async (db) => {
      const rows = await denialRateBy(db, "payer");
      expect(rows).toHaveLength(1);
      const row = rows[0]!;
      expect(row.key).toBe(ctxA.payerId);
      expect(row.label).toBe("Placeholder Insurer");
      expect(row.claims).toBe(3); // distinct denied claims
      expect(row.denied).toBe(5); // denial rows
      expect(row.rate).toBeCloseTo(5 / 3, 4);
    });
  });

  it("reasonPareto ranks by money and reaches 100% cumulative", async () => {
    await withTenant(pool, tenantA, async (db) => {
      const rows = await reasonPareto(db);
      expect(rows).toHaveLength(4);
      expect(rows.reduce((n, r) => n + r.count, 0)).toBe(5);
      // Sorted by sar descending → cumulative is non-decreasing, last == 100.
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i]!.cumulativePct).toBeGreaterThanOrEqual(
          rows[i - 1]!.cumulativePct,
        );
      }
      expect(rows.at(-1)!.cumulativePct).toBe(100);
      expect(rows.every((r) => r.label.length > 0)).toBe(true);
    });
  });

  it("moneyScope separates recovered from at-risk money", async () => {
    await withTenant(pool, tenantA, async (db) => {
      const scope = await moneyScope(db);
      expect(scope.claimCount).toBe(3);
      expect(scope.deniedCount).toBe(5);
      expect(scope.recoveredSar).toBe(WON_RECOVERED);
      // At-risk = denied money not yet recovered; there are still-open denials.
      expect(Number(scope.atRiskSar)).toBeGreaterThan(0);
      expect(scope.atRiskSar).toMatch(/^\d+\.\d{2}$/);
    });
  });

  it("at-risk keeps a partial win's unrecovered remainder (denied - recovered), not zero", async () => {
    await withTenant(pool, tenantC, async (db) => {
      const scope = await moneyScope(db);
      expect(scope.deniedCount).toBe(1);
      expect(scope.claimCount).toBe(1);
      expect(scope.recoveredSar).toBe("600.00");
      // The 400 remainder stays at-risk — NOT excluded just because a won appeal
      // exists — so at_risk + recovered reconciles to total denied (design §8.5).
      expect(scope.atRiskSar).toBe("400.00");
      expect(Number(scope.atRiskSar) + Number(scope.recoveredSar)).toBeCloseTo(
        1000,
        2,
      );
    });
  });

  it("trend buckets denied money by YYYY-MM", async () => {
    await withTenant(pool, tenantA, async (db) => {
      const points = await trend(db);
      expect(points.length).toBeGreaterThanOrEqual(1);
      for (const p of points) {
        expect(p.period).toMatch(/^\d{4}-\d{2}$/);
        expect(p.deniedSar).toMatch(/^\d+\.\d{2}$/);
        expect(p.recoveredSar).toMatch(/^\d+\.\d{2}$/);
      }
      const totalDenied = points.reduce((n, p) => n + Number(p.deniedSar), 0);
      expect(totalDenied).toBeGreaterThan(0);
    });
  });

  it("is tenant-isolated: tenant B sees none of tenant A's rollups", async () => {
    await withTenant(pool, tenantB, async (db) => {
      expect(await denialRateBy(db, "reason")).toHaveLength(0);
      expect(await reasonPareto(db)).toHaveLength(0);
      expect(await trend(db)).toHaveLength(0);
      const scope = await moneyScope(db);
      expect(scope).toEqual({
        recoveredSar: "0.00",
        atRiskSar: "0.00",
        deniedCount: 0,
        claimCount: 0,
      });
    });
  });
});
