import { describe, it, expect } from "vitest";
import { EobExtractionSchema } from "@taweed/ai";
import { backfillLegacyAdjustmentFields } from "../lib/eob-review-data";

// AI-4 code-review finding: adjustmentHalalas (line) and totalAdjustmentHalalas
// (claim) were added as REQUIRED fields on EobExtractionSchema with no
// migration/backfill of any eob_extractions.extraction jsonb persisted before
// Gap 2. A pending_review row stored before this branch lacks both keys
// entirely and fails EobExtractionSchema.safeParse in eob-review-data.ts's
// rowToReview, surfacing as extraction:null — unopenable in the review queue
// (approvable only via reject, never via approve). This regression-tests the
// backfill that fixes it: backfillLegacyAdjustmentFields runs on the raw DB
// jsonb BEFORE safeParse, so a legacy row parses successfully with the
// missing money defaulted to 0 (exactly what "no write-off bucket existed
// yet" meant).

function legacyRawExtraction(): unknown {
  return {
    payerName: "Test Payer",
    payerNphiesId: null,
    remittanceDate: "2026-01-01",
    remittanceTotalPaidHalalas: 10_000,
    overallConfidence: 0.9,
    claims: [
      {
        claimId: "CLM-1",
        nphiesClaimId: null,
        patientRef: null,
        serviceDate: "2026-01-01",
        confidence: 0.9,
        totalBilledHalalas: 10_000,
        totalPaidHalalas: 10_000,
        totalRejectedHalalas: 0,
        // totalAdjustmentHalalas intentionally omitted — pre-Gap-2 row shape.
        lines: [
          {
            claimLineRef: "1",
            sbsCode: null,
            icd10amCode: null,
            billedHalalas: 10_000,
            paidHalalas: 10_000,
            patientShareHalalas: 0,
            rejectedHalalas: 0,
            // adjustmentHalalas intentionally omitted — pre-Gap-2 row shape.
            denialCode: null,
            confidence: 0.9,
          },
        ],
      },
    ],
  };
}

describe("backfillLegacyAdjustmentFields — pre-Gap-2 eob_extractions rows", () => {
  it("a legacy raw extraction (missing adjustment fields) fails EobExtractionSchema.safeParse before backfill", () => {
    const raw = legacyRawExtraction();
    expect(EobExtractionSchema.safeParse(raw).success).toBe(false);
  });

  it("the same raw extraction parses successfully after backfill, with adjustment defaulted to 0", () => {
    const raw = legacyRawExtraction();
    const backfilled = backfillLegacyAdjustmentFields(raw);
    const parsed = EobExtractionSchema.safeParse(backfilled);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.claims[0]!.totalAdjustmentHalalas).toBe(0);
      expect(parsed.data.claims[0]!.lines[0]!.adjustmentHalalas).toBe(0);
    }
  });

  it("does not touch a row that already carries the adjustment fields (new-shape row passthrough)", () => {
    const raw = legacyRawExtraction() as {
      claims: Array<Record<string, unknown> & { lines: Array<Record<string, unknown>> }>;
    };
    raw.claims[0]!.totalAdjustmentHalalas = 500;
    raw.claims[0]!.lines[0]!.adjustmentHalalas = 500;

    const backfilled = backfillLegacyAdjustmentFields(raw);
    const parsed = EobExtractionSchema.safeParse(backfilled);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.claims[0]!.totalAdjustmentHalalas).toBe(500);
      expect(parsed.data.claims[0]!.lines[0]!.adjustmentHalalas).toBe(500);
    }
  });

  it("passes through non-object / malformed input unchanged (defensive, never throws)", () => {
    expect(backfillLegacyAdjustmentFields(null)).toBe(null);
    expect(backfillLegacyAdjustmentFields("not an object")).toBe("not an object");
    expect(backfillLegacyAdjustmentFields({ claims: "not an array" })).toEqual({
      claims: "not an array",
    });
  });
});
