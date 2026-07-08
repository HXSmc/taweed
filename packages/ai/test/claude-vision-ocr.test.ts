import { describe, it, expect, vi } from "vitest";
import type { Pool } from "@taweed/db";
import { extractEobFromPdf } from "@taweed/ingest";
import {
  createClaudeVisionOcrAdapter,
  resolveEobExtractionAdapter,
  type ClaudeVisionOcrAdapterOptions,
} from "../src/adapters/claude-vision-ocr.js";
import type {
  ExtractEobOptions,
  ExtractEobResult,
} from "../src/features/extractEob.js";
import type { EobExtraction } from "../src/schemas/eobExtraction.js";
import type { ValidatorReport } from "../src/eob-validators.js";

// The public EobExtractionAdapter seam types `validatorReport` as `unknown`
// (packages/ingest's eob-extraction-adapter.ts) since ingest has no reason to
// know eob-validators' shape. These tests DO know it (same package), so cast
// at the assertion site rather than loosening the seam's public type.
function asValidatorReport(report: unknown): ValidatorReport {
  return report as ValidatorReport;
}

// AI-4 — ClaudeVisionOcrAdapter orchestrates extractEob (generation, Sonnet
// first) + eob-validators (deterministic gate) behind packages/ingest's
// EobExtractionAdapter seam. `extractFn` is injected in every test below so
// nothing here ever reaches the network, a provider, or Postgres.

const UNREACHABLE_POOL = new Proxy(
  {},
  {
    get() {
      throw new Error("pool must not be accessed directly by the adapter");
    },
  },
) as unknown as Pool;

// A well-formed, internally CONSISTENT extraction — every cross-total
// identity holds, so eob-validators' arithmetic checks all pass. No textLayer
// is supplied in most tests below, so text-layer-match findings are skipped
// by design (see claude-vision-ocr.ts's runValidation for why).
const CONSISTENT_LINE = {
  claimLineRef: "line-1",
  sbsCode: "SBS-001",
  icd10amCode: "A00.0",
  billedHalalas: 10000,
  paidHalalas: 8000,
  patientShareHalalas: 1000,
  rejectedHalalas: 1000,
  denialCode: null,
  confidence: 0.9,
} satisfies EobExtraction["claims"][number]["lines"][number];

const CONSISTENT_CLAIM = {
  claimId: "claim-1",
  nphiesClaimId: "NPH-1",
  patientRef: "patient-1",
  serviceDate: "2026-01-01",
  lines: [CONSISTENT_LINE],
  totalBilledHalalas: 10000,
  totalPaidHalalas: 8000,
  totalRejectedHalalas: 1000,
  confidence: 0.9,
} satisfies EobExtraction["claims"][number];

const CONSISTENT_EXTRACTION: EobExtraction = {
  payerName: "Bupa Arabia",
  payerNphiesId: "PAYER-1",
  remittanceDate: "2026-01-02",
  remittanceTotalPaidHalalas: 8000,
  claims: [CONSISTENT_CLAIM],
  overallConfidence: 0.93,
};

// Same shape, but the line's amounts do not sum to `billedHalalas` — this
// independently breaks eob-validators' "line-total" check regardless of any
// textLayer, so it is a reliable way to force `passed: false` in these tests.
function brokenExtraction(overallConfidence: number): EobExtraction {
  return {
    ...CONSISTENT_EXTRACTION,
    overallConfidence,
    claims: [
      {
        ...CONSISTENT_CLAIM,
        lines: [
          {
            ...CONSISTENT_LINE,
            paidHalalas: 1000, // 1000+1000+1000 = 3000 != billed 10000
          },
        ],
      },
    ],
  };
}

function stubExtractFn(
  results: ExtractEobResult[],
): { fn: typeof import("../src/features/extractEob.js").extractEob; calls: ExtractEobOptions[] } {
  const calls: ExtractEobOptions[] = [];
  let i = 0;
  const fn = vi.fn(async (opts: ExtractEobOptions) => {
    calls.push(opts);
    const result = results[Math.min(i, results.length - 1)];
    i += 1;
    return result;
  });
  return { fn: fn as unknown as typeof import("../src/features/extractEob.js").extractEob, calls };
}

function baseOptions(
  extractFn: ClaudeVisionOcrAdapterOptions["extractFn"],
): ClaudeVisionOcrAdapterOptions {
  return {
    actor: "u1",
    tenantId: "t1",
    pool: UNREACHABLE_POOL,
    extractFn,
  };
}

const PDF_BYTES = new Uint8Array([1, 2, 3]);

describe("createClaudeVisionOcrAdapter", () => {
  it("(a)+(d) calls sonnet first and never calls opus when validation passes on the first attempt", async () => {
    const { fn, calls } = stubExtractFn([
      { extraction: CONSISTENT_EXTRACTION, model: "stub-sonnet", promptSha256: "h1" },
    ]);
    const adapter = createClaudeVisionOcrAdapter(baseOptions(fn));

    const result = await adapter.extract(PDF_BYTES);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.model).toBe("sonnet");
    expect(result).toEqual({
      data: CONSISTENT_EXTRACTION,
      modelTier: "sonnet",
      escalated: false,
      confidence: CONSISTENT_EXTRACTION.overallConfidence,
      model: "stub-sonnet",
      promptSha256: "h1",
      validatorReport: expect.objectContaining({ passed: true }),
    });
  });

  it("(b) retries exactly ONCE at opus with a hi-res flag when the sonnet validator report fails", async () => {
    const { fn, calls } = stubExtractFn([
      { extraction: brokenExtraction(0.8), model: "stub-sonnet", promptSha256: "h1" },
      { extraction: CONSISTENT_EXTRACTION, model: "stub-opus", promptSha256: "h2" },
    ]);
    const adapter = createClaudeVisionOcrAdapter(baseOptions(fn));

    const result = await adapter.extract(PDF_BYTES);

    expect(calls).toHaveLength(2);
    expect(calls[0]!.model).toBe("sonnet");
    expect(calls[0]!.input.hiRes).not.toBe(true);
    expect(calls[1]!.model).toBe("opus");
    expect(calls[1]!.input.hiRes).toBe(true);
    // Recovered on the opus retry.
    expect(result.modelTier).toBe("opus");
    expect(result.escalated).toBe(true);
    expect(result.data).toEqual(CONSISTENT_EXTRACTION);
  });

  it("(c) never throws when the opus retry ALSO fails validation — returns escalated:true with a confidence reflecting the failure", async () => {
    const stillBroken = brokenExtraction(0.95); // model is confident; validators disagree
    const { fn, calls } = stubExtractFn([
      { extraction: brokenExtraction(0.8), model: "stub-sonnet", promptSha256: "h1" },
      { extraction: stillBroken, model: "stub-opus", promptSha256: "h2" },
    ]);
    const adapter = createClaudeVisionOcrAdapter(baseOptions(fn));

    const result = await adapter.extract(PDF_BYTES);

    expect(calls).toHaveLength(2); // exactly one retry, no further escalation loop
    expect(result.modelTier).toBe("opus");
    expect(result.escalated).toBe(true);
    expect(result.data).toEqual(stillBroken);
    // The report still fails, so the returned confidence must NOT parrot the
    // model's own (overly confident) self-report.
    expect(result.confidence).toBeLessThan(stillBroken.overallConfidence);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });

  it("retries at opus when the sonnet call THROWS outright (schema-parse/provider failure), not just on a validator-failing report", async () => {
    const calls: ExtractEobOptions[] = [];
    const fn = vi.fn(async (opts: ExtractEobOptions) => {
      calls.push(opts);
      if (opts.model === "sonnet") {
        throw new Error("runStructured: parsed_output was null");
      }
      return { extraction: CONSISTENT_EXTRACTION, model: "stub-opus", promptSha256: "h2" };
    }) as unknown as ClaudeVisionOcrAdapterOptions["extractFn"];
    const adapter = createClaudeVisionOcrAdapter(baseOptions(fn));

    const result = await adapter.extract(PDF_BYTES);

    expect(calls).toHaveLength(2);
    expect(calls[0]!.model).toBe("sonnet");
    expect(calls[1]!.model).toBe("opus");
    expect(result.modelTier).toBe("opus");
    expect(result.escalated).toBe(true);
    expect(result.data).toEqual(CONSISTENT_EXTRACTION);
  });

  it("never throws when BOTH sonnet and opus reject outright — returns escalated:true, confidence 0, falling back to sonnet's data if sonnet at least resolved", async () => {
    const calls: ExtractEobOptions[] = [];
    const fn = vi.fn(async (opts: ExtractEobOptions) => {
      calls.push(opts);
      throw new Error(`${opts.model} call failed`);
    }) as unknown as ClaudeVisionOcrAdapterOptions["extractFn"];
    const adapter = createClaudeVisionOcrAdapter(baseOptions(fn));

    const result = await adapter.extract(PDF_BYTES);

    expect(calls).toHaveLength(2);
    expect(result.escalated).toBe(true);
    expect(result.confidence).toBe(0);
    expect(result.data).toBeNull();
    expect(result.model).toBeUndefined();
  });

  it("when opus rejects outright after a sonnet validator-failure, falls back to sonnet's own extraction as data", async () => {
    const calls: ExtractEobOptions[] = [];
    const fn = vi.fn(async (opts: ExtractEobOptions) => {
      calls.push(opts);
      if (opts.model === "sonnet") {
        return { extraction: brokenExtraction(0.8), model: "stub-sonnet", promptSha256: "h1" };
      }
      throw new Error("opus call failed");
    }) as unknown as ClaudeVisionOcrAdapterOptions["extractFn"];
    const adapter = createClaudeVisionOcrAdapter(baseOptions(fn));

    const result = await adapter.extract(PDF_BYTES);

    expect(calls).toHaveLength(2);
    expect(result.escalated).toBe(true);
    expect(result.confidence).toBe(0);
    expect(result.data).toEqual(brokenExtraction(0.8));
    expect(result.model).toBe("stub-sonnet");
    // BUG: the original Sonnet validator findings (the actual defect in the
    // `data` being returned — a line-total arithmetic mismatch) must survive
    // an outright-failing Opus retry, not be replaced entirely by the Opus
    // error. A reviewer reading `validatorReport` needs both: why the
    // returned data is flawed, AND why no better data exists.
    const report = asValidatorReport(result.validatorReport);
    expect(report.passed).toBe(false);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          check: "line-total",
          passed: false,
          detail: expect.stringContaining("billed"),
        }),
        expect.objectContaining({ check: "extraction-error", passed: false }),
      ]),
    );
  });

  it("passes opts.textLayer through to validation, and a textLayer mismatch fails an otherwise-consistent extraction", async () => {
    const { fn, calls } = stubExtractFn([
      { extraction: CONSISTENT_EXTRACTION, model: "stub-sonnet", promptSha256: "h1" },
      { extraction: CONSISTENT_EXTRACTION, model: "stub-opus", promptSha256: "h2" },
    ]);
    const adapter = createClaudeVisionOcrAdapter(baseOptions(fn));

    // A textLayer that does NOT contain the claimed payer name / amounts —
    // arithmetic is fine but text-layer-match findings fail, so this must
    // still escalate to opus exactly once (same contract as (b)).
    const result = await adapter.extract(PDF_BYTES, {
      textLayer: "this document mentions none of the extracted values",
    });

    expect(calls).toHaveLength(2);
    expect(result.escalated).toBe(true);
  });

  it("skips text-layer-match checks (does not escalate) when no textLayer is available, e.g. a scanned/non-born-digital PDF", async () => {
    const { fn, calls } = stubExtractFn([
      { extraction: CONSISTENT_EXTRACTION, model: "stub-sonnet", promptSha256: "h1" },
    ]);
    const adapter = createClaudeVisionOcrAdapter(baseOptions(fn));

    // No opts at all — no textLayer available. A consistent extraction must
    // still pass (text-layer-match findings are skipped entirely, not scored
    // against an empty string, which would otherwise spuriously fail).
    const result = await adapter.extract(PDF_BYTES);

    expect(calls).toHaveLength(1);
    expect(result.escalated).toBe(false);
  });

  it("BUG: treats an empty-string textLayer the same as no textLayer (arithmetic-only), instead of scoring against an empty haystack", async () => {
    const { fn, calls } = stubExtractFn([
      { extraction: CONSISTENT_EXTRACTION, model: "stub-sonnet", promptSha256: "h1" },
    ]);
    const adapter = createClaudeVisionOcrAdapter(baseOptions(fn));

    // A caller passing textLayer: "" for a scanned document (a natural
    // mistake, since "" also reads as "no text") must not make every
    // text-layer-match finding fail spuriously and force an Opus escalation.
    const result = await adapter.extract(PDF_BYTES, { textLayer: "" });

    expect(calls).toHaveLength(1);
    expect(result.escalated).toBe(false);
    expect(asValidatorReport(result.validatorReport).passed).toBe(true);
  });

  it("BUG: clamps an out-of-range model-emitted overallConfidence into [0, 1] even on the passing-report path", async () => {
    const runawayConfidenceExtraction: EobExtraction = {
      ...CONSISTENT_EXTRACTION,
      overallConfidence: 1.7, // model misbehaves; validator report still passes
    };
    const { fn, calls } = stubExtractFn([
      { extraction: runawayConfidenceExtraction, model: "stub-sonnet", promptSha256: "h1" },
    ]);
    const adapter = createClaudeVisionOcrAdapter(baseOptions(fn));

    const result = await adapter.extract(PDF_BYTES);

    expect(calls).toHaveLength(1);
    expect(result.escalated).toBe(false);
    expect(asValidatorReport(result.validatorReport).passed).toBe(true);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });
});

// AI-4 — resolveEobExtractionAdapter is the feature-gate for the PDF-drop
// ingest flow (plan 04 §9): the ONLY new branch the flag-off path adds should
// be this early guard/return, composed with packages/ingest's UNTOUCHED
// eob-extraction-adapter.ts seam. These tests prove that composition
// reproduces the pre-existing "not wired" behavior byte-for-byte when the
// flag is off, and produces a real adapter when it is on.
describe("resolveEobExtractionAdapter", () => {
  const OFF_ENV = {} as NodeJS.ProcessEnv;
  const ON_ENV = {
    TAWEED_AI_ENABLED: "true",
    TAWEED_AI_EXTRACT_EOB_ENABLED: "true",
  } as NodeJS.ProcessEnv;

  it("returns undefined when the extractEob feature flag is off", () => {
    const adapter = resolveEobExtractionAdapter({
      actor: "u1",
      tenantId: "t1",
      pool: UNREACHABLE_POOL,
      env: OFF_ENV,
    });
    expect(adapter).toBeUndefined();
  });

  it("composed with extractEobFromPdf, an off flag reproduces the EXACT pre-existing 'not wired' throw (no new branch in the seam)", async () => {
    const pdfBytes = new Uint8Array([1, 2, 3]);
    const opts: ClaudeVisionOcrAdapterOptions = {
      actor: "u1",
      tenantId: "t1",
      pool: UNREACHABLE_POOL,
      env: OFF_ENV,
    };

    const adapter = resolveEobExtractionAdapter(opts);
    expect(adapter).toBeUndefined();

    await expect(extractEobFromPdf(pdfBytes, adapter)).rejects.toThrow(
      /EOB vision extraction not wired/,
    );
  });

  it("returns a real, usable EobExtractionAdapter when the flag is on", () => {
    const { fn } = stubExtractFn([
      { extraction: CONSISTENT_EXTRACTION, model: "stub-sonnet", promptSha256: "h1" },
    ]);
    const opts: ClaudeVisionOcrAdapterOptions = {
      actor: "u1",
      tenantId: "t1",
      pool: UNREACHABLE_POOL,
      env: ON_ENV,
      extractFn: fn,
    };

    const adapter = resolveEobExtractionAdapter(opts);
    expect(adapter).toBeDefined();
    expect(typeof adapter?.extract).toBe("function");
  });
});
