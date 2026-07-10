import { describe, it, expect } from "vitest";
import { toSar } from "@taweed/analytics";
import type { EobExtraction, EobClaim, EobLine } from "@taweed/ai";
import {
  buildNormalizedClaimsFromEob,
  type EobIngestContext,
} from "../lib/eob-to-normalized";

// AI-4 — buildOneClaim's denial-row explosion. Regression coverage for the
// bug where a line with rejected money but no (or an unrecognized) denial
// code produced zero denial rows, silently dropping that money from the
// denials table money-at-risk analytics (lib/data.ts) and the appeals
// pipeline (lib/appeals-data.ts) both key off of.

const CTX: EobIngestContext = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  branchId: "22222222-2222-4222-8222-222222222222",
  providerId: "33333333-3333-4333-8333-333333333333",
  payerId: "44444444-4444-4444-8444-444444444444",
  patientId: "55555555-5555-4555-8555-555555555555",
};

function makeLine(overrides: Partial<EobLine>): EobLine {
  return {
    claimLineRef: "1",
    sbsCode: null,
    icd10amCode: null,
    billedHalalas: 10_000,
    paidHalalas: 0,
    patientShareHalalas: 0,
    rejectedHalalas: 10_000,
    adjustmentHalalas: 0,
    denialCode: null,
    confidence: 0.9,
    ...overrides,
  };
}

function makeClaim(lines: EobLine[]): EobClaim {
  const totalBilledHalalas = lines.reduce((s, l) => s + l.billedHalalas, 0);
  const totalPaidHalalas = lines.reduce((s, l) => s + l.paidHalalas, 0);
  const totalRejectedHalalas = lines.reduce((s, l) => s + l.rejectedHalalas, 0);
  const totalAdjustmentHalalas = lines.reduce((s, l) => s + l.adjustmentHalalas, 0);
  return {
    claimId: "CLM-1",
    nphiesClaimId: null,
    patientRef: null,
    serviceDate: "2026-01-01",
    lines,
    totalBilledHalalas,
    totalPaidHalalas,
    totalRejectedHalalas,
    totalAdjustmentHalalas,
    confidence: 0.9,
  };
}

function makeExtraction(claims: EobClaim[]): EobExtraction {
  const remittanceTotalPaidHalalas = claims.reduce((s, c) => s + c.totalPaidHalalas, 0);
  return {
    payerName: "Test Payer",
    payerNphiesId: null,
    remittanceDate: "2026-01-01",
    remittanceTotalPaidHalalas,
    claims,
    overallConfidence: 0.9,
  };
}

describe("buildNormalizedClaimsFromEob — denial-row explosion", () => {
  it("creates a denial row for rejected money even when denialCode is null", () => {
    // Arrange: one line, fully rejected, with no denial code on file.
    const extraction = makeExtraction([makeClaim([makeLine({})])]);

    // Act
    const [normalized] = buildNormalizedClaimsFromEob(extraction, CTX, toSar);

    // Assert: the rejected money must not be dropped from the denials table.
    expect(normalized!.denials).toHaveLength(1);
    expect(normalized!.denials[0]!.reason_code).toBe("UNKNOWN");
    expect(normalized!.denials[0]!.denied_amount).toBe(toSar(10_000));
    expect(normalized!.denials[0]!.claim_line_id).toBe(normalized!.lines[0]!.id);
  });

  it("still uses the recognized code and label when denialCode is valid", () => {
    // Arrange
    const extraction = makeExtraction([
      makeClaim([makeLine({ denialCode: "TWD-D01" })]),
    ]);

    // Act
    const [normalized] = buildNormalizedClaimsFromEob(extraction, CTX, toSar);

    // Assert
    expect(normalized!.denials).toHaveLength(1);
    expect(normalized!.denials[0]!.reason_code).toBe("TWD-D01");
    expect(normalized!.denials[0]!.category).toBe("Service not covered by plan");
  });

  it("produces no denial row when nothing was rejected", () => {
    // Arrange: fully paid line, no denial code.
    const extraction = makeExtraction([
      makeClaim([
        makeLine({ paidHalalas: 10_000, rejectedHalalas: 0 }),
      ]),
    ]);

    // Act
    const [normalized] = buildNormalizedClaimsFromEob(extraction, CTX, toSar);

    // Assert
    expect(normalized!.denials).toHaveLength(0);
  });
});
