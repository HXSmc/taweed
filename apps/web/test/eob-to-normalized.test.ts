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

// AI-4 code-review finding: buildOneClaim/buildNormalizedClaimsFromEob were
// not exercised by any test with a non-zero adjustmentHalalas before this
// pass. This does not assert the write-off is persisted anywhere (it is
// documented, not persisted — see eob-to-normalized.ts's comment above
// buildOneClaim's claimRow for why: no `denials` row, because a write-off is
// not an appealable denial, and no schema column exists for it yet). It pins
// TODAY'S actual behavior so a future change to how the adjustment bucket is
// handled is a deliberate, reviewed diff instead of an accidental one.
describe("buildNormalizedClaimsFromEob — adjustment bucket (write-off) is not silently mis-recorded", () => {
  it("a fully-written-off claim (paid=0, adjustment=billed, nothing rejected) persists total_amount as billed, adjudicated_amount as 0, and outcome 'complete' — no denial row is fabricated for the write-off", () => {
    // Arrange: billed 100 SAR, paid 0, adjustment 100 (fully written off,
    // no denial). Passes the arithmetic gate: 10_000 = 0 + 0 + 0 + 10_000.
    const line = makeLine({
      billedHalalas: 10_000,
      paidHalalas: 0,
      rejectedHalalas: 0,
      adjustmentHalalas: 10_000,
    });
    const extraction = makeExtraction([makeClaim([line])]);

    // Act
    const [normalized] = buildNormalizedClaimsFromEob(extraction, CTX, toSar);

    // Assert: today's documented behavior — the write-off is not written to
    // any field, and it does not fabricate an appealable denial row.
    expect(normalized!.claim.total_amount).toBe(toSar(10_000));
    expect(normalized!.response.adjudicated_amount).toBe(toSar(0));
    expect(normalized!.response.outcome).toBe("complete");
    expect(normalized!.denials).toHaveLength(0);
  });

  it("a partial adjustment alongside real rejected money still produces exactly one denial row, for the rejected money only", () => {
    // Arrange: billed 100, paid 60, adjustment 20, rejected 20.
    const line = makeLine({
      billedHalalas: 10_000,
      paidHalalas: 6_000,
      rejectedHalalas: 2_000,
      adjustmentHalalas: 2_000,
      denialCode: "TWD-D01",
    });
    const extraction = makeExtraction([makeClaim([line])]);

    // Act
    const [normalized] = buildNormalizedClaimsFromEob(extraction, CTX, toSar);

    // Assert: only the genuinely rejected 20 SAR is recorded as a denial —
    // the 20 SAR adjustment is not folded into it and not double-counted.
    expect(normalized!.denials).toHaveLength(1);
    expect(normalized!.denials[0]!.denied_amount).toBe(toSar(2_000));
    expect(normalized!.response.adjudicated_amount).toBe(toSar(6_000));
    expect(normalized!.response.outcome).toBe("partial");
  });
});
