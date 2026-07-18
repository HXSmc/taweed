import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newId } from "@taweed/shared";
import { getPool, withTenant, schema, type Pool } from "@taweed/db";
import { migrate, appConnectionString } from "../../db/test/migrate.js";
import { extractEob } from "../src/features/extractEob.js";
import { AiDisabledError } from "../src/errors.js";
import type { LlmProvider } from "../src/provider.js";
import type { EobExtraction } from "../src/schemas/eobExtraction.js";

// AI-4 — same audited-path parity as authorRule.int.test.ts/assistAppeal's
// integration coverage: tenant kill-switch read + llm_calls audit write over
// real Postgres (RLS active), not just the fixture-provider unit tests.

const adminUrl = process.env.DATABASE_URL ?? "";
const adminPool: Pool = getPool(adminUrl);
const pool: Pool = getPool(appConnectionString(adminUrl));

const tenantA = newId();
const tenantB = newId();

const ENABLED = {
  TAWEED_AI_ENABLED: "true",
  TAWEED_AI_EXTRACT_EOB_ENABLED: "true",
} as const;

// Carries an Arabic-Indic digit in payerName to prove the digit-law
// post-processor (normalizeArabicOutput) runs on that field before the
// extraction is returned. Every cross-total identity holds (not under test
// here — eob-validators.ts owns that), only the audited-path plumbing is.
const RAW_EXTRACTION: EobExtraction = {
  payerName: "شركة بوبا العربية ١",
  payerNphiesId: "PAYER-1",
  remittanceDate: "2026-01-02",
  remittanceTotalPaidHalalas: 8000,
  claims: [
    {
      claimId: "claim-1",
      nphiesClaimId: "NPH-1",
      patientRef: "patient-1",
      serviceDate: "2026-01-01",
      lines: [
        {
          claimLineRef: "line-1",
          sbsCode: "SBS-001",
          icd10amCode: "A00.0",
          billedHalalas: 10000,
          paidHalalas: 8000,
          patientShareHalalas: 1000,
          rejectedHalalas: 1000,
          adjustmentHalalas: 0,
          denialCode: null,
          confidence: 0.9,
        },
      ],
      totalBilledHalalas: 10000,
      totalPaidHalalas: 8000,
      totalRejectedHalalas: 1000,
      totalAdjustmentHalalas: 0,
      confidence: 0.9,
    },
  ],
  overallConfidence: 0.93,
};

function stubProvider(behavior: "ok" | "throws"): {
  provider: LlmProvider;
  calls: () => number;
} {
  let calls = 0;
  const provider: LlmProvider = {
    name: "stub",
    mapModelId: (m) => `stub-${m}`,
    client: {
      async parseStructured<T>() {
        calls += 1;
        if (behavior === "throws") throw new Error("stub extract boom");
        return {
          parsed: RAW_EXTRACTION as unknown as T,
          model: "stub-sonnet",
          requestId: "stub-req-1",
          usage: { inputTokens: 500, outputTokens: 800, cacheReadTokens: 0 },
          latencyMs: 1,
          rawOutput: JSON.stringify(RAW_EXTRACTION),
        };
      },
    },
  };
  return { provider, calls: () => calls };
}

async function seedTenant(id: string, name: string): Promise<void> {
  const client = await adminPool.connect();
  try {
    await client.query("INSERT INTO tenants (id, name) VALUES ($1, $2)", [id, name]);
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

describe("extractEob — audited PDF->extraction over Postgres (RLS active)", () => {
  it("returns a digit-normalized extraction and writes one extract_eob llm_calls row", async () => {
    const stub = stubProvider("ok");
    const result = await extractEob({
      actor: "rcm-a",
      tenantId: tenantA,
      pool,
      input: { pdfBase64: "ZmFrZS1wZGYtYnl0ZXM=", docId: "doc-1" },
      provider: stub.provider,
      env: ENABLED,
    });

    expect(stub.calls()).toBe(1);
    // Digit law applied to payerName (Arabic-Indic -> Western); amounts are
    // untouched numbers, not subject to the AR post-processor.
    expect(result.extraction.payerName).toContain("1");
    expect(result.extraction.payerName).not.toContain("١");
    expect(result.extraction.claims).toEqual(RAW_EXTRACTION.claims);
    expect(result.model).toBe("stub-sonnet");
    expect(result.promptSha256).toMatch(/^[0-9a-f]{64}$/);

    await withTenant(pool, tenantA, async (db) => {
      const calls = await db.select().from(schema.llmCalls);
      expect(calls).toHaveLength(1);
      expect(calls[0]!.purpose).toBe("extract_eob");
      expect(calls[0]!.provider).toBe("stub");
      expect(calls[0]!.model).toBe("stub-sonnet");
      expect(calls[0]!.prompt_sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(calls[0]!.output_sha256).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  it("honors the per-tenant kill switch without any model call", async () => {
    const stub = stubProvider("ok");
    await withTenant(pool, tenantB, async (db) => {
      await db.insert(schema.tenantAiSettings).values({
        tenant_id: tenantB,
        ai_enabled: false,
      });
    });
    await expect(
      extractEob({
        actor: "rcm-b",
        tenantId: tenantB,
        pool,
        input: { pdfBase64: "ZmFrZQ==", docId: "doc-2" },
        provider: stub.provider,
        env: ENABLED,
      }),
    ).rejects.toBeInstanceOf(AiDisabledError);
    expect(stub.calls()).toBe(0);
    await withTenant(pool, tenantB, async (db) => {
      const calls = await db.select().from(schema.llmCalls);
      expect(calls).toHaveLength(0);
    });
  });

  it("audits a provider exception then rethrows", async () => {
    const stub = stubProvider("throws");
    await expect(
      extractEob({
        actor: "rcm-a",
        tenantId: tenantA,
        pool,
        input: { pdfBase64: "ZmFrZQ==", docId: "doc-3" },
        provider: stub.provider,
        env: ENABLED,
      }),
    ).rejects.toThrow(/boom/);
    await withTenant(pool, tenantA, async (db) => {
      const errRows = await db.select().from(schema.llmCalls);
      // the earlier ok-call plus this error attempt.
      expect(errRows.length).toBeGreaterThanOrEqual(2);
    });
  });
});
