import { describe, it, expect, expectTypeOf } from "vitest";
import {
  EobLineSchema,
  EobClaimSchema,
  EobExtractionSchema,
  type EobLine,
} from "../../src/schemas/eobExtraction.js";
import type { DenialReasonCode } from "@taweed/shared";

// AI-4 — EOB extraction wire schema (plan 04 §9). Mirrors the scrubRuleDraft.ts
// test shape: accept well-formed shapes (single + multi claim/line), a null
// denialCode, and a valid enum denialCode; reject an unregistered denial code,
// any extra/unknown key at any strictObject level, a wrong type on a halalas
// field, and a missing required field.

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

describe("EobLineSchema", () => {
  it("infers denialCode as the closed DenialReasonCode union, not string", () => {
    // Compile-time only: if z.enum(DENIAL_CODES) ever widens to `string`, this
    // fails to typecheck, catching a silent loss of exhaustiveness checking
    // against the closed denial-code registry downstream.
    expectTypeOf<EobLine["denialCode"]>().toEqualTypeOf<DenialReasonCode | null>();
  });

  it("accepts a well-formed line with a null denialCode", () => {
    const result = EobLineSchema.safeParse(VALID_LINE);
    expect(result.success).toBe(true);
  });

  it("accepts a well-formed line with a valid enum denialCode", () => {
    const result = EobLineSchema.safeParse({
      ...VALID_LINE,
      denialCode: "TWD-D01",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unregistered denial-code string", () => {
    const result = EobLineSchema.safeParse({
      ...VALID_LINE,
      denialCode: "NOT-A-REAL-CODE",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an extra/unknown key", () => {
    const result = EobLineSchema.safeParse({
      ...VALID_LINE,
      extraField: "nope",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a wrong type on a halalas field", () => {
    const result = EobLineSchema.safeParse({
      ...VALID_LINE,
      billedHalalas: "10000",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing required field", () => {
    const { claimLineRef: _omit, ...rest } = VALID_LINE;
    const result = EobLineSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

describe("EobClaimSchema", () => {
  it("accepts a well-formed 1-line claim", () => {
    const result = EobClaimSchema.safeParse(VALID_CLAIM);
    expect(result.success).toBe(true);
  });

  it("accepts a well-formed multi-line claim", () => {
    const result = EobClaimSchema.safeParse({
      ...VALID_CLAIM,
      lines: [
        VALID_LINE,
        { ...VALID_LINE, claimLineRef: "line-2", denialCode: "TWD-D02" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an extra/unknown key", () => {
    const result = EobClaimSchema.safeParse({
      ...VALID_CLAIM,
      extraField: "nope",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a wrong type on a halalas field", () => {
    const result = EobClaimSchema.safeParse({
      ...VALID_CLAIM,
      totalBilledHalalas: "10000",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing required field", () => {
    const { claimId: _omit, ...rest } = VALID_CLAIM;
    const result = EobClaimSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects an unregistered denial code nested in a line", () => {
    const result = EobClaimSchema.safeParse({
      ...VALID_CLAIM,
      lines: [{ ...VALID_LINE, denialCode: "BOGUS" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("EobExtractionSchema", () => {
  it("accepts a well-formed single-claim/single-line extraction", () => {
    const result = EobExtractionSchema.safeParse(VALID_EXTRACTION);
    expect(result.success).toBe(true);
  });

  it("accepts a well-formed 2-claim, multi-line extraction", () => {
    const result = EobExtractionSchema.safeParse({
      ...VALID_EXTRACTION,
      claims: [
        VALID_CLAIM,
        {
          ...VALID_CLAIM,
          claimId: "claim-2",
          lines: [
            VALID_LINE,
            { ...VALID_LINE, claimLineRef: "line-2", denialCode: "TWD-D03" },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a null payerName/payerNphiesId", () => {
    const result = EobExtractionSchema.safeParse({
      ...VALID_EXTRACTION,
      payerName: null,
      payerNphiesId: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unregistered denial-code string nested deep", () => {
    const result = EobExtractionSchema.safeParse({
      ...VALID_EXTRACTION,
      claims: [{ ...VALID_CLAIM, lines: [{ ...VALID_LINE, denialCode: "XX" }] }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an extra/unknown key at the top level", () => {
    const result = EobExtractionSchema.safeParse({
      ...VALID_EXTRACTION,
      extraField: "nope",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a wrong type on a halalas field", () => {
    const result = EobExtractionSchema.safeParse({
      ...VALID_EXTRACTION,
      remittanceTotalPaidHalalas: "8000",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing required field", () => {
    const { claims: _omit, ...rest } = VALID_EXTRACTION;
    const result = EobExtractionSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects payerName as a non-string (guarding against accidental enum coercion)", () => {
    const result = EobExtractionSchema.safeParse({
      ...VALID_EXTRACTION,
      payerName: 123,
    });
    expect(result.success).toBe(false);
  });
});
