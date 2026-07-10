import { describe, it, expect } from "vitest";
import { toSar } from "@taweed/analytics";
import {
  validateEobExtraction,
  validateEobExtractionArithmetic,
} from "../src/eob-validators.js";
import type { EobExtraction } from "../src/schemas/eobExtraction.js";

// A clean, internally-consistent extraction: every cross-total identity holds
// exactly, and every id/amount below is reproduced verbatim in `textLayer`.
// Mirrors the shape (and SAR text formatting: halalas/100 → toFixed(2)) that
// test/synthetic-eob/src/generate.ts's buildTextLayer emits.
const CLEAN_EXTRACTION: EobExtraction = {
  payerName: "Placeholder Insurer",
  payerNphiesId: "payer-nphies-0",
  remittanceDate: "2026-01-15",
  remittanceTotalPaidHalalas: 3600,
  claims: [
    {
      claimId: "claim-partialDenial-42-0",
      nphiesClaimId: "NPHIES-CLM-partialDenial-42-0",
      patientRef: "Patient/patient-partialDenial-0",
      serviceDate: "2026-01-05",
      lines: [
        {
          claimLineRef: "line-0-0",
          sbsCode: "SBS-2681",
          icd10amCode: "ICD10AM-494",
          billedHalalas: 2100,
          paidHalalas: 1890,
          patientShareHalalas: 210,
          rejectedHalalas: 0,
          adjustmentHalalas: 0,
          denialCode: null,
          confidence: 0.89,
        },
        {
          claimLineRef: "line-0-1",
          sbsCode: "SBS-4777",
          icd10amCode: "ICD10AM-178",
          billedHalalas: 4100,
          paidHalalas: 0,
          patientShareHalalas: 0,
          rejectedHalalas: 4100,
          adjustmentHalalas: 0,
          denialCode: "TWD-D03",
          confidence: 0.9,
        },
        {
          claimLineRef: "line-0-2",
          sbsCode: "SBS-1547",
          icd10amCode: "ICD10AM-671",
          billedHalalas: 1900,
          paidHalalas: 1710,
          patientShareHalalas: 190,
          rejectedHalalas: 0,
          adjustmentHalalas: 0,
          denialCode: null,
          confidence: 0.96,
        },
      ],
      totalBilledHalalas: 8100,
      totalPaidHalalas: 3600,
      totalRejectedHalalas: 4100,
      totalAdjustmentHalalas: 0,
      confidence: 0.94,
    },
  ],
  overallConfidence: 0.98,
};

const CLEAN_TEXT_LAYER =
  "Remittance Advice\n" +
  "Payer: Placeholder Insurer\n" +
  "Payer NPHIES ID: payer-nphies-0\n" +
  "Remittance Date: 2026-01-15\n" +
  "Total Paid: 36.00 SAR\n" +
  "\n" +
  "Claim: NPHIES-CLM-partialDenial-42-0 (claim-partialDenial-42-0)\n" +
  "Patient: Patient/patient-partialDenial-0\n" +
  "Service Date: 2026-01-05\n" +
  "  line-0-0 | SBS-2681 | ICD10AM-494 | Billed 21.00 | Paid 18.90 | Patient Share 2.10 | Rejected 0.00\n" +
  "  line-0-1 | SBS-4777 | ICD10AM-178 | Billed 41.00 | Paid 0.00 | Patient Share 0.00 | Rejected 41.00 | Denial TWD-D03\n" +
  "  line-0-2 | SBS-1547 | ICD10AM-671 | Billed 19.00 | Paid 17.10 | Patient Share 1.90 | Rejected 0.00\n";

// Deep-clone helper so each case mutates its own copy, never CLEAN_EXTRACTION.
function clone(extraction: EobExtraction): EobExtraction {
  return JSON.parse(JSON.stringify(extraction)) as EobExtraction;
}

describe("validateEobExtraction — cross-total checks", () => {
  interface Case {
    name: string;
    build: () => EobExtraction;
    textLayer: string;
    expectPassed: boolean;
    expectFailingCheck?: string;
  }

  const CASES: Case[] = [
    {
      name: "clean extraction passes every check",
      build: () => clone(CLEAN_EXTRACTION),
      textLayer: CLEAN_TEXT_LAYER,
      expectPassed: true,
    },
    {
      name: "per-line total breaks when paid+rejected+patientShare != billed",
      build: () => {
        const e = clone(CLEAN_EXTRACTION);
        e.claims[0]!.lines[0]!.paidHalalas = 999999;
        return e;
      },
      textLayer: CLEAN_TEXT_LAYER,
      expectPassed: false,
      expectFailingCheck: "line-total",
    },
    {
      name: "per-claim total breaks when totalPaidHalalas != sum of line paid",
      build: () => {
        const e = clone(CLEAN_EXTRACTION);
        e.claims[0]!.totalPaidHalalas = 1;
        return e;
      },
      textLayer: CLEAN_TEXT_LAYER,
      expectPassed: false,
      expectFailingCheck: "claim-total",
    },
    {
      name: "remittance total breaks when it doesn't match sum of claim paid",
      build: () => {
        const e = clone(CLEAN_EXTRACTION);
        e.remittanceTotalPaidHalalas = 1;
        return e;
      },
      textLayer: CLEAN_TEXT_LAYER,
      expectPassed: false,
      expectFailingCheck: "remittance-total",
    },
  ];

  it.each(CASES.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    const report = validateEobExtraction(c.build(), c.textLayer);
    expect(report.passed).toBe(c.expectPassed);
    if (c.expectFailingCheck) {
      const failing = report.findings.filter((f) => !f.passed);
      expect(failing.some((f) => f.check === c.expectFailingCheck)).toBe(true);
    }
  });
});

describe("validateEobExtraction — verbatim text-layer match", () => {
  it("passes when every claim id / amount / code reproduces in the text layer", () => {
    const report = validateEobExtraction(clone(CLEAN_EXTRACTION), CLEAN_TEXT_LAYER);
    const textFindings = report.findings.filter((f) => f.check === "text-layer-match");
    expect(textFindings.every((f) => f.passed)).toBe(true);
  });

  it("fails when a claim id is corrupted / absent from the text layer", () => {
    const corruptedText = CLEAN_TEXT_LAYER.replace(
      "NPHIES-CLM-partialDenial-42-0",
      "NPHIES-CLM-WRONG-ID",
    );
    const report = validateEobExtraction(clone(CLEAN_EXTRACTION), corruptedText);
    expect(report.passed).toBe(false);
    const failing = report.findings.filter(
      (f) => !f.passed && f.check === "text-layer-match",
    );
    expect(failing.length).toBeGreaterThan(0);
  });

  it("fails when a billed amount in the extraction is missing from the text layer", () => {
    const e = clone(CLEAN_EXTRACTION);
    e.claims[0]!.lines[0]!.billedHalalas = 500000; // 5000.00 SAR — not in text layer
    // Keep the line-total identity intact so only the text-match check fires.
    e.claims[0]!.lines[0]!.paidHalalas = 450000;
    e.claims[0]!.lines[0]!.patientShareHalalas = 50000;
    e.claims[0]!.totalBilledHalalas = 500000 + 4100 + 1900;
    e.claims[0]!.totalPaidHalalas = 450000 + 0 + 1710;
    e.remittanceTotalPaidHalalas = 450000 + 0 + 1710;
    const report = validateEobExtraction(e, CLEAN_TEXT_LAYER);
    expect(report.passed).toBe(false);
    const failing = report.findings.filter(
      (f) => !f.passed && f.check === "text-layer-match",
    );
    expect(failing.length).toBeGreaterThan(0);
  });

  it("matches through Arabic-Indic digits and stray tashkeel/bidi marks in the text layer", () => {
    // Arabic-Indic digits for the amounts, plus a bidi LRM mark injected around
    // the claim id — normalizeArabicOutput's pipeline (digits + tashkeel strip +
    // bidi strip via isolateLatinRuns) must still find a match.
    const arabicText =
      "إشعار تسوية مطالبات\n" +
      "الدافع: Placeholder Insurer\n" +
      "رقم الدافع: payer-nphies-0\n" +
      "تاريخ التسوية: ٢٠٢٦-٠١-١٥\n" +
      "إجمالي المسدد: ٣٦.٠٠ SAR\n" +
      "\n" +
      "مطالبة: ‎NPHIES-CLM-partialDenial-42-0‎ (‎claim-partialDenial-42-0‎)\n" +
      "المريض: Patient/patient-partialDenial-0\n" +
      "تاريخ الخدمة: ٢٠٢٦-٠١-٠٥\n" +
      "  line-0-0 | SBS-2681 | ICD10AM-494 | المفوتر ٢١.٠٠ | المسدد ١٨.٩٠ | تحمل المريض ٢.١٠ | المرفوض ٠.٠٠\n" +
      "  line-0-1 | SBS-4777 | ICD10AM-178 | المفوتر ٤١.٠٠ | المسدد ٠.٠٠ | تحمل المريض ٠.٠٠ | المرفوض ٤١.٠٠ | سبب الرفض TWD-D03\n" +
      "  line-0-2 | SBS-1547 | ICD10AM-671 | المفوتر ١٩.٠٠ | المسدد ١٧.١٠ | تحمل المريض ١.٩٠ | المرفوض ٠.٠٠\n";
    const report = validateEobExtraction(clone(CLEAN_EXTRACTION), arabicText);
    const textFindings = report.findings.filter((f) => f.check === "text-layer-match");
    expect(textFindings.every((f) => f.passed)).toBe(true);
  });
});

// Gap 2 — the 5th "adjustment/withholding" money bucket. A contractual
// write-off is money that is neither paid, patient-owed, nor formally
// rejected/denied — without this bucket, a real remittance carrying one can
// never cross-total and is permanently stuck failing the arithmetic gate
// even when every extracted value is accurate. Exercises BOTH
// validateEobExtraction (the full report, including the text-layer-match
// candidate added for this field) and validateEobExtractionArithmetic (the
// no-text-layer variant approveEobExtractionAction actually re-runs on a
// human-edited payload).
describe("validateEobExtraction / validateEobExtractionArithmetic — adjustment (5th) bucket", () => {
  it("passes when billed == paid+rejected+patientShare+adjustment (a genuine contractual write-off)", () => {
    const e = clone(CLEAN_EXTRACTION);
    // Move 100 halalas out of "paid" and into "adjustment" on line-0-0 — the
    // line still balances (2100 == 1790+0+210+100), just with a 5th term.
    e.claims[0]!.lines[0]!.paidHalalas = 1790;
    e.claims[0]!.lines[0]!.adjustmentHalalas = 100;
    e.claims[0]!.totalPaidHalalas -= 100;
    e.claims[0]!.totalAdjustmentHalalas = 100;
    e.remittanceTotalPaidHalalas -= 100; // validateEobExtractionArithmetic still
    // checks the remittance-level cross-total (unchanged by this gap — see
    // eob-validators.ts's remittanceTotalFinding comment), so it must move
    // too, or this positive case would spuriously fail on an unrelated check.
    const report = validateEobExtractionArithmetic(e);
    expect(report.passed).toBe(true);
  });

  it("fails (line-total) when a line's adjustment is set but billed != paid+rejected+patientShare+adjustment", () => {
    const e = clone(CLEAN_EXTRACTION);
    // adjustment added on top WITHOUT reducing paid — billed 2100 !=
    // 1890+0+210+50 (=2150). A too-permissive 5-bucket validator would let
    // this slide; it must still fail.
    e.claims[0]!.lines[0]!.adjustmentHalalas = 50;
    const report = validateEobExtractionArithmetic(e);
    expect(report.passed).toBe(false);
    const failing = report.findings.filter((f) => !f.passed);
    expect(failing.some((f) => f.check === "line-total")).toBe(true);
  });

  it("fails (claim-total) when totalAdjustmentHalalas doesn't match the sum of line adjustments", () => {
    const e = clone(CLEAN_EXTRACTION);
    e.claims[0]!.lines[0]!.paidHalalas = 1790;
    e.claims[0]!.lines[0]!.adjustmentHalalas = 100; // line balances on its own
    e.claims[0]!.totalPaidHalalas -= 100;
    e.claims[0]!.totalAdjustmentHalalas = 999; // wrong — should be 100
    e.remittanceTotalPaidHalalas -= 100; // keep remittance-total consistent
    // so the ONLY failing check is the claim-total mismatch under test.
    const report = validateEobExtractionArithmetic(e);
    expect(report.passed).toBe(false);
    const failing = report.findings.filter((f) => !f.passed);
    expect(failing.some((f) => f.check === "claim-total")).toBe(true);
    expect(failing.every((f) => f.check === "claim-total")).toBe(true);
  });

  it("fails when an adjustment amount in the extraction is missing from the text layer", () => {
    const e = clone(CLEAN_EXTRACTION);
    // Move 733 halalas (7.33 SAR — distinctive, no substring collision with
    // any amount already present in CLEAN_TEXT_LAYER) out of "paid" and into
    // "adjustment" on line-0-0. Every cross-total identity stays intact (see
    // the totals recomputed below), so ONLY the text-match checks for the
    // (now-different) paid/adjustment amounts can fail — mirrors the existing
    // "billed amount missing" test's approach.
    e.claims[0]!.lines[0]!.paidHalalas = 1890 - 733;
    e.claims[0]!.lines[0]!.adjustmentHalalas = 733;
    e.claims[0]!.totalPaidHalalas -= 733;
    e.claims[0]!.totalAdjustmentHalalas = 733;
    e.remittanceTotalPaidHalalas -= 733;
    const report = validateEobExtraction(e, CLEAN_TEXT_LAYER);
    expect(report.passed).toBe(false);
    const failing = report.findings.filter(
      (f) => !f.passed && f.check === "text-layer-match",
    );
    expect(
      failing.some((f) => f.detail.includes("adjustmentHalalas")),
    ).toBe(true);
  });
});

// MONEY-PATH EXTRA-SCRUTINY REGRESSION — adversarial finding (eob-validators.ts):
// the cross-total checks are pure sign-blind linear identities, so a
// hallucinated NEGATIVE adjustmentHalalas can mask an impossible paid>billed
// state as passed:true, and validateEobExtractionArithmetic (the ONLY check
// run for scanned PDFs with no text layer, and the same re-check
// approveEobExtractionAction runs on a human-edited payload) had zero
// text-layer-match findings to catch it. Fixed by nonNegativeMoneyFinding
// (originally nonNegativeAdjustmentFinding; generalized below — the
// "non-negative-money" check name reflects that generalization).
describe("validateEobExtraction / validateEobExtractionArithmetic — adjustment non-negativity (money-path fix)", () => {
  it("fails a line whose negative adjustment sign-cancels an impossible paid>billed relationship", () => {
    // Exact scenario from the adversarial finding: billed=500, paid=700,
    // rejected=0, patientShare=0, adjustment=-200. Every pure cross-total sum
    // (700+0+0-200=500) balances despite paid genuinely exceeding billed —
    // before the fix this reported passed:true.
    const e = clone(CLEAN_EXTRACTION);
    e.claims[0]!.lines[0]!.billedHalalas = 50000;
    e.claims[0]!.lines[0]!.paidHalalas = 70000;
    e.claims[0]!.lines[0]!.rejectedHalalas = 0;
    e.claims[0]!.lines[0]!.patientShareHalalas = 0;
    e.claims[0]!.lines[0]!.adjustmentHalalas = -20000;
    // Keep the OTHER two lines and the claim/remittance totals consistent
    // with this single line's new values so only the adjustment sign is
    // under test, not an unrelated cross-total mismatch.
    e.claims[0]!.lines = [e.claims[0]!.lines[0]!];
    e.claims[0]!.totalBilledHalalas = 50000;
    e.claims[0]!.totalPaidHalalas = 70000;
    e.claims[0]!.totalRejectedHalalas = 0;
    e.claims[0]!.totalAdjustmentHalalas = -20000;
    e.remittanceTotalPaidHalalas = 70000;

    const report = validateEobExtractionArithmetic(e);
    // The line/claim/remittance cross-total checks still all pass — proving
    // the masking actually works at the arithmetic layer.
    const crossTotalChecks = report.findings.filter((f) =>
      ["line-total", "claim-total", "remittance-total"].includes(f.check),
    );
    expect(crossTotalChecks.every((f) => f.passed)).toBe(true);
    // But the new non-negativity guard catches it, so the overall report
    // must never report passed:true for this payload.
    expect(report.passed).toBe(false);
    const failing = report.findings.filter((f) => !f.passed);
    expect(failing.some((f) => f.check === "non-negative-money")).toBe(true);
  });

  it("fails when totalAdjustmentHalalas is negative at the claim level", () => {
    const e = clone(CLEAN_EXTRACTION);
    e.claims[0]!.totalAdjustmentHalalas = -1;
    const report = validateEobExtractionArithmetic(e);
    expect(report.passed).toBe(false);
    const failing = report.findings.filter((f) => !f.passed);
    expect(
      failing.some(
        (f) => f.check === "non-negative-money" && f.detail.includes(e.claims[0]!.claimId),
      ),
    ).toBe(true);
  });

  it("passes a genuinely non-negative adjustment (no false positive)", () => {
    const report = validateEobExtractionArithmetic(clone(CLEAN_EXTRACTION));
    const failing = report.findings.filter(
      (f) => !f.passed && f.check === "non-negative-money",
    );
    expect(failing.length).toBe(0);
  });
});

// MONEY-PATH EXTRA-SCRUTINY REGRESSION — adversarial re-review findings
// (eob-validators.ts): the non-negativity guard above, in its first form,
// covered ONLY adjustmentHalalas. But billedHalalas, paidHalalas,
// patientShareHalalas, and rejectedHalalas remained plain unsigned-unchecked
// z.number() fields, so the IDENTICAL sign-cancellation exploit the guard
// was written to close was still open via any of the other four buckets —
// at the line, claim-total, and remittance-total levels. Fixed by
// generalizing nonNegativeAdjustmentFinding into nonNegativeMoneyFinding /
// lineNonNegativityFindings / claimNonNegativityFindings, applied to all
// five line-level buckets, all four claim-level totals, and the
// remittance-level total.
describe("validateEobExtraction / validateEobExtractionArithmetic — non-adjustment bucket non-negativity (money-path fix, extra-scrutiny pass #2)", () => {
  it("fails a line whose negative rejectedHalalas sign-cancels an impossible paid>billed relationship", () => {
    // Exact scenario from the adversarial finding: billed=50000, paid=70000
    // (paid > billed — physically impossible for a remittance),
    // rejected=-20000 (a negative "rejection"), patientShare=0,
    // adjustment=0. Every pure cross-total sum (70000-20000+0+0=50000)
    // balances despite paid genuinely exceeding billed — before this fix
    // this reported passed:true, since only adjustmentHalalas was guarded.
    const e = clone(CLEAN_EXTRACTION);
    e.claims[0]!.lines[0]!.billedHalalas = 50000;
    e.claims[0]!.lines[0]!.paidHalalas = 70000;
    e.claims[0]!.lines[0]!.rejectedHalalas = -20000;
    e.claims[0]!.lines[0]!.patientShareHalalas = 0;
    e.claims[0]!.lines[0]!.adjustmentHalalas = 0;
    e.claims[0]!.lines = [e.claims[0]!.lines[0]!];
    e.claims[0]!.totalBilledHalalas = 50000;
    e.claims[0]!.totalPaidHalalas = 70000;
    e.claims[0]!.totalRejectedHalalas = -20000;
    e.claims[0]!.totalAdjustmentHalalas = 0;
    e.remittanceTotalPaidHalalas = 70000;

    const report = validateEobExtractionArithmetic(e);
    // The line/claim/remittance cross-total checks still all pass — proving
    // the masking actually works at the arithmetic layer via a bucket the
    // first-pass fix did not guard.
    const crossTotalChecks = report.findings.filter((f) =>
      ["line-total", "claim-total", "remittance-total"].includes(f.check),
    );
    expect(crossTotalChecks.every((f) => f.passed)).toBe(true);
    // But the generalized non-negativity guard now catches it.
    expect(report.passed).toBe(false);
    const failing = report.findings.filter((f) => !f.passed);
    expect(
      failing.some(
        (f) => f.check === "non-negative-money" && f.detail.includes("rejectedHalalas"),
      ),
    ).toBe(true);
  });

  it.each([
    "billedHalalas",
    "paidHalalas",
    "patientShareHalalas",
    "rejectedHalalas",
  ] as const)("fails when line-level %s is negative", (field) => {
    const e = clone(CLEAN_EXTRACTION);
    (e.claims[0]!.lines[0] as unknown as Record<string, number>)[field] = -1;
    const report = validateEobExtractionArithmetic(e);
    expect(report.passed).toBe(false);
    const failing = report.findings.filter((f) => !f.passed);
    expect(
      failing.some((f) => f.check === "non-negative-money" && f.detail.includes(field)),
    ).toBe(true);
  });

  it.each(["totalBilledHalalas", "totalPaidHalalas", "totalRejectedHalalas"] as const)(
    "fails when claim-level %s is negative",
    (field) => {
      const e = clone(CLEAN_EXTRACTION);
      (e.claims[0] as unknown as Record<string, number>)[field] = -1;
      const report = validateEobExtractionArithmetic(e);
      expect(report.passed).toBe(false);
      const failing = report.findings.filter((f) => !f.passed);
      expect(
        failing.some(
          (f) =>
            f.check === "non-negative-money" &&
            f.detail.includes(field) &&
            f.detail.includes(e.claims[0]!.claimId),
        ),
      ).toBe(true);
    },
  );

  it("fails when remittanceTotalPaidHalalas is negative", () => {
    const e = clone(CLEAN_EXTRACTION);
    e.remittanceTotalPaidHalalas = -1;
    const report = validateEobExtractionArithmetic(e);
    expect(report.passed).toBe(false);
    const failing = report.findings.filter((f) => !f.passed);
    expect(
      failing.some(
        (f) => f.check === "non-negative-money" && f.detail.includes("remittanceTotalPaidHalalas"),
      ),
    ).toBe(true);
  });

  it("passes ordinary non-negative buckets across all fields (no false positive)", () => {
    const report = validateEobExtractionArithmetic(clone(CLEAN_EXTRACTION));
    const failing = report.findings.filter(
      (f) => !f.passed && f.check === "non-negative-money",
    );
    expect(failing.length).toBe(0);
  });
});

// MONEY-PATH EXTRA-SCRUTINY REGRESSION — adversarial finding (eob-validators.ts):
// the `===` cross-total checks compare raw float64 halalas with no magnitude
// bound anywhere in the money path, so two genuinely different SAR amounts
// can collide once they exceed 2^53 halalas and still report passed:true.
// Fixed by withinMagnitudeFinding / MAX_HALALAS_MAGNITUDE.
describe("validateEobExtractionArithmetic — money-magnitude bound (money-path fix)", () => {
  it("fails when a claim total exceeds the numeric(14,2) precision-safe range and float64-collides with its own line sum", () => {
    // paidSar "90071992547409920.00" and totalPaidSar
    // "90071992547409921.00" (genuinely 1 SAR apart) both convert to the
    // SAME float64 halalas value once they exceed 2^53 — reproduced directly
    // in halalas here since this module operates on the wire (halalas)
    // shape, same magnitude the adversarial finding demonstrated via
    // moneyToHalalas.
    const collidedHalalas = 9_007_199_254_740_992_000; // beyond 2^53
    const e = clone(CLEAN_EXTRACTION);
    e.claims[0]!.lines = [
      {
        ...e.claims[0]!.lines[0]!,
        billedHalalas: collidedHalalas,
        paidHalalas: collidedHalalas,
        rejectedHalalas: 0,
        patientShareHalalas: 0,
        adjustmentHalalas: 0,
      },
    ];
    e.claims[0]!.totalBilledHalalas = collidedHalalas;
    e.claims[0]!.totalPaidHalalas = collidedHalalas;
    e.claims[0]!.totalRejectedHalalas = 0;
    e.claims[0]!.totalAdjustmentHalalas = 0;
    e.remittanceTotalPaidHalalas = collidedHalalas;

    const report = validateEobExtractionArithmetic(e);
    // Confirms the collision is real: the cross-total identity itself
    // reports passed:true at this magnitude.
    const claimTotalChecks = report.findings.filter((f) => f.check === "claim-total");
    expect(claimTotalChecks.every((f) => f.passed)).toBe(true);
    // The new magnitude guard must still flag the overall report as failing.
    expect(report.passed).toBe(false);
    const failing = report.findings.filter((f) => !f.passed);
    expect(failing.some((f) => f.check === "money-magnitude-bound")).toBe(true);
  });

  it("does not flag a value at the exact numeric(14,2) capacity (no false positive at the boundary)", () => {
    const e = clone(CLEAN_EXTRACTION);
    const atCapacity = 99_999_999_999_999; // 999999999999.99 SAR
    e.claims[0]!.lines = [
      {
        ...e.claims[0]!.lines[0]!,
        billedHalalas: atCapacity,
        paidHalalas: atCapacity,
        rejectedHalalas: 0,
        patientShareHalalas: 0,
        adjustmentHalalas: 0,
      },
    ];
    e.claims[0]!.totalBilledHalalas = atCapacity;
    e.claims[0]!.totalPaidHalalas = atCapacity;
    e.claims[0]!.totalRejectedHalalas = 0;
    e.claims[0]!.totalAdjustmentHalalas = 0;
    e.remittanceTotalPaidHalalas = atCapacity;

    const report = validateEobExtractionArithmetic(e);
    const failing = report.findings.filter(
      (f) => !f.passed && f.check === "money-magnitude-bound",
    );
    expect(failing.length).toBe(0);
  });

  it("passes ordinary small amounts (no false positive)", () => {
    const report = validateEobExtractionArithmetic(clone(CLEAN_EXTRACTION));
    const failing = report.findings.filter(
      (f) => !f.passed && f.check === "money-magnitude-bound",
    );
    expect(failing.length).toBe(0);
  });
});

describe("validateEobExtraction — denial-code validity (defense in depth)", () => {
  it("passes when every non-null denialCode is a real registry code", () => {
    const report = validateEobExtraction(clone(CLEAN_EXTRACTION), CLEAN_TEXT_LAYER);
    const denialFindings = report.findings.filter((f) => f.check === "denial-code-valid");
    expect(denialFindings.every((f) => f.passed)).toBe(true);
  });

  it("fails when a hand-edited denialCode is not in DENIAL_REASON_CODES", () => {
    const e = clone(CLEAN_EXTRACTION);
    // Simulate a review-queue hand-edit bypassing the schema's enum guard.
    (e.claims[0]!.lines[1] as unknown as { denialCode: string }).denialCode =
      "NOT-A-REAL-CODE";
    const report = validateEobExtraction(e, CLEAN_TEXT_LAYER);
    expect(report.passed).toBe(false);
    const failing = report.findings.filter(
      (f) => !f.passed && f.check === "denial-code-valid",
    );
    expect(failing.length).toBeGreaterThan(0);
  });
});

describe("validateEobExtraction — mixed-digit-set anomaly flag", () => {
  it("does not flag a field that is consistently Western digits", () => {
    const report = validateEobExtraction(clone(CLEAN_EXTRACTION), CLEAN_TEXT_LAYER);
    const mixedFindings = report.findings.filter((f) => f.check === "mixed-digit-set");
    expect(mixedFindings.every((f) => f.passed)).toBe(true);
  });

  it("does not flag a field that is consistently Arabic-Indic digits", () => {
    const e = clone(CLEAN_EXTRACTION);
    e.remittanceDate = "٢٠٢٦-٠١-١٥";
    const report = validateEobExtraction(e, CLEAN_TEXT_LAYER);
    const mixedFindings = report.findings.filter((f) => f.check === "mixed-digit-set");
    expect(mixedFindings.every((f) => f.passed)).toBe(true);
  });

  it("flags (soft, non-blocking) a single field mixing Arabic-Indic and Western digits", () => {
    const e = clone(CLEAN_EXTRACTION);
    e.remittanceDate = "2026-٠١-15"; // mixed within one field
    const report = validateEobExtraction(e, CLEAN_TEXT_LAYER);
    const mixedFindings = report.findings.filter((f) => f.check === "mixed-digit-set");
    // Documented choice: mixed-digit-set is a soft anomaly signal, encoded as
    // an always-passed:true finding whose `detail` names the anomaly — never
    // as passed:false. This keeps `report.passed === findings.every(passed)`
    // an honest identity (see the contract comment in eob-validators.ts): a
    // caller filtering `findings.some(f => !f.passed)` can never mistake this
    // soft signal for a hard failure.
    expect(mixedFindings.every((f) => f.passed)).toBe(true);
    const flaggedByDetail = mixedFindings.filter((f) => f.detail.includes("mixes"));
    expect(flaggedByDetail.length).toBeGreaterThan(0);
    expect(report.passed).toBe(true);
  });
});

describe("validateEobExtraction — overall report shape", () => {
  it("passed is false if ANY finding fails, true only when all pass", () => {
    const passingReport = validateEobExtraction(clone(CLEAN_EXTRACTION), CLEAN_TEXT_LAYER);
    expect(passingReport.passed).toBe(true);
    expect(passingReport.findings.every((f) => f.passed)).toBe(true);

    const e = clone(CLEAN_EXTRACTION);
    e.remittanceTotalPaidHalalas = 42;
    const failingReport = validateEobExtraction(e, CLEAN_TEXT_LAYER);
    expect(failingReport.passed).toBe(false);
    expect(failingReport.findings.some((f) => !f.passed)).toBe(true);
  });

  it("every finding has a non-empty check name and detail string", () => {
    const report = validateEobExtraction(clone(CLEAN_EXTRACTION), CLEAN_TEXT_LAYER);
    for (const finding of report.findings) {
      expect(finding.check.trim().length).toBeGreaterThan(0);
      expect(typeof finding.passed).toBe("boolean");
      expect(finding.detail.trim().length).toBeGreaterThan(0);
    }
  });
});

// Confirms the module correctly reuses postprocess-ar.ts's normalizer rather
// than reimplementing digit conversion (sanity-checks the SAR formatting used
// above actually round-trips through @taweed/analytics's toSar the same way
// generate.ts's buildTextLayer formats amounts).
describe("sanity: toSar formatting matches the synthetic corpus's text-layer convention", () => {
  it.each([
    [2100, "21.00"],
    [4100, "41.00"],
    [0, "0.00"],
    [3600, "36.00"],
  ])("toSar(%d) === %j", (halalas, expected) => {
    expect(toSar(halalas)).toBe(expected);
  });
});
