import { describe, it, expect } from "vitest";
import type { Pool } from "@taweed/db";
import { extractEob } from "../src/features/extractEob.js";
import { AiDisabledError } from "../src/errors.js";
import { EobExtractionSchema } from "../src/schemas/eobExtraction.js";
import type { LlmProvider, StructuredRequest } from "../src/provider.js";

// AI-4 — kill switches short-circuit before any DB or provider access, exactly
// like AI-1/AI-2/AI-3. The full audited path (provider + RLS + eob-validators
// gate a caller runs on the returned extraction) needs real Postgres and is
// out of scope for this unit file — see the sibling *.int.test.ts convention.

const UNREACHABLE_POOL = new Proxy(
  {},
  {
    get() {
      throw new Error("pool must not be accessed when the feature is off");
    },
  },
) as unknown as Pool;

const INPUT = { pdfBase64: "AAAA", docId: "doc-1" };

describe("extractEob feature kill switch (fails closed before any DB/provider access)", () => {
  it("throws AiDisabledError when the global switch is off", async () => {
    await expect(
      extractEob({
        actor: "u1",
        tenantId: "t1",
        pool: UNREACHABLE_POOL,
        input: INPUT,
        env: {},
      }),
    ).rejects.toBeInstanceOf(AiDisabledError);
  });

  it("throws AiDisabledError when the feature flag is off (global on)", async () => {
    await expect(
      extractEob({
        actor: "u1",
        tenantId: "t1",
        pool: UNREACHABLE_POOL,
        input: INPUT,
        env: { TAWEED_AI_ENABLED: "true" },
      }),
    ).rejects.toBeInstanceOf(AiDisabledError);
  });
});

// A well-formed extraction a model could plausibly return.
const VALID_LINE = {
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
};

const VALID_CLAIM = {
  claimId: "claim-1",
  nphiesClaimId: "NPH-1",
  patientRef: "patient-1",
  serviceDate: "2026-01-01",
  lines: [VALID_LINE],
  totalBilledHalalas: 10000,
  totalPaidHalalas: 8000,
  totalRejectedHalalas: 1000,
  totalAdjustmentHalalas: 0,
  confidence: 0.9,
};

const VALID_EXTRACTION = {
  payerName: "Bupa Arabia",
  payerNphiesId: "PAYER-1",
  remittanceDate: "2026-01-02",
  remittanceTotalPaidHalalas: 8000,
  claims: [VALID_CLAIM],
  overallConfidence: 0.85,
};

/**
 * A stub LlmProvider whose `parseStructured` mimics the ONE thing the real
 * anthropic-1p provider does that matters here: it runs the caller-supplied
 * `req.schema` against the raw model output and reports `parsed: null` when
 * that fails — the exact signal run.ts's runStructured branches on:
 *   if (result.parsed === null) throw new Error(`AI response failed schema
 *   validation for ${ctx.req.schemaName}`);
 * (packages/ai/src/run.ts). This file does not invoke runStructured directly
 * (it always opens a withTenant transaction and writes an audit row, so it
 * needs real Postgres — see authorRule.int.test.ts / assistAppeal.int.test.ts
 * for that full path); instead it tests the schema/provider BOUNDARY that
 * decides whether runStructured's documented throw fires, without inventing
 * any new null-handling behavior in extractEob.ts itself.
 */
function stubProviderReturning(rawOutput: unknown): LlmProvider {
  return {
    name: "stub",
    mapModelId: (m) => `stub-${m}`,
    capabilities: { batches: false, files: false },
    client: {
      async parseStructured<T>(req: StructuredRequest<T>) {
        const result = req.schema.safeParse(rawOutput);
        return {
          parsed: result.success ? (result.data as T) : null,
          model: "stub-sonnet",
          requestId: "stub-req-1",
          usage: { inputTokens: 10, outputTokens: 20, cacheReadTokens: 0 },
          latencyMs: 1,
          rawOutput: result.success ? JSON.stringify(result.data) : "",
        };
      },
    },
  };
}

describe("EobExtractionSchema / stub-provider safeParse boundary", () => {
  it("a well-formed model output parses successfully through the stub provider", async () => {
    const provider = stubProviderReturning(VALID_EXTRACTION);
    const result = await provider.client.parseStructured({
      model: "sonnet",
      system: "s",
      user: "u",
      schema: EobExtractionSchema,
      schemaName: "EobExtraction",
      maxTokens: 100,
    });
    expect(result.parsed).toEqual(VALID_EXTRACTION);
  });

  it("a malformed model output (wrong type on a halalas field) yields parsed=null — the exact condition runStructured's documented contract throws on", async () => {
    const malformed = {
      ...VALID_EXTRACTION,
      remittanceTotalPaidHalalas: "8000", // should be a number
    };
    const provider = stubProviderReturning(malformed);
    const result = await provider.client.parseStructured({
      model: "sonnet",
      system: "s",
      user: "u",
      schema: EobExtractionSchema,
      schemaName: "EobExtraction",
      maxTokens: 100,
    });
    expect(result.parsed).toBeNull();
    expect(result.rawOutput).toBe("");
  });

  it("a null/absent model output (e.g. a refusal) yields parsed=null the same way", async () => {
    const provider = stubProviderReturning(null);
    const result = await provider.client.parseStructured({
      model: "sonnet",
      system: "s",
      user: "u",
      schema: EobExtractionSchema,
      schemaName: "EobExtraction",
      maxTokens: 100,
    });
    expect(result.parsed).toBeNull();
  });
});
