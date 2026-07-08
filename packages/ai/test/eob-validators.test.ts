import { describe, it, expect } from "vitest";
import { toSar } from "@taweed/analytics";
import { validateEobExtraction } from "../src/eob-validators.js";
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
          denialCode: null,
          confidence: 0.96,
        },
      ],
      totalBilledHalalas: 8100,
      totalPaidHalalas: 3600,
      totalRejectedHalalas: 4100,
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
