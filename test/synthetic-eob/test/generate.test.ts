import { describe, it, expect } from "vitest";
import {
  EOB_SCENARIOS,
  generateEobGroundTruth,
  generateAllEob,
  type EobScenarioName,
} from "@taweed/synthetic-eob";

const SEED = 42;

// Cross-check against the (parallel-task) EobExtractionSchema when it's
// available. Dynamic import so a missing symbol OR a missing/erroring
// package never breaks this suite regardless of task-ordering — degrade to
// structural validation against our own local type otherwise.
async function loadEobExtractionSchema(): Promise<{
  safeParse: (value: unknown) => { success: boolean };
} | null> {
  try {
    const mod: Record<string, unknown> = await import("@taweed/ai");
    const schema = mod["EobExtractionSchema"];
    if (
      schema &&
      typeof (schema as { safeParse?: unknown }).safeParse === "function"
    ) {
      return schema as { safeParse: (value: unknown) => { success: boolean } };
    }
    return null;
  } catch {
    return null;
  }
}

describe("generateEobGroundTruth — round-trip parseability", () => {
  it("EobExtractionSchema is loadable (fails loudly, not silently, if @taweed/ai regresses)", async () => {
    // EobExtractionSchema landed in packages/ai/src/schemas/eobExtraction.ts
    // partway through this package's development (see types.ts reconciliation
    // note). The schema now always exists, so this asserts the cross-check
    // below is exercising the REAL schema, not silently degrading to the
    // structural fallback that was only meant to cover its absence.
    const schema = await loadEobExtractionSchema();
    expect(schema).not.toBeNull();
  });

  it("every scenario's extraction cross-checks against EobExtractionSchema when available", async () => {
    const schema = await loadEobExtractionSchema();
    for (const scenario of EOB_SCENARIOS) {
      const { extraction } = generateEobGroundTruth(scenario, SEED);
      if (schema) {
        expect(schema.safeParse(extraction).success).toBe(true);
      } else {
        // Fallback structural check (EobExtractionSchema not built yet).
        expect(typeof extraction.payerName).toBe("string");
        expect(typeof extraction.payerNphiesId).toBe("string");
        expect(typeof extraction.remittanceDate).toBe("string");
        expect(Number.isInteger(extraction.remittanceTotalPaidHalalas)).toBe(true);
        expect(Array.isArray(extraction.claims)).toBe(true);
        for (const claim of extraction.claims) {
          expect(typeof claim.claimId).toBe("string");
          expect(Array.isArray(claim.lines)).toBe(true);
          for (const line of claim.lines) {
            expect(Number.isInteger(line.billedHalalas)).toBe(true);
            expect(Number.isInteger(line.paidHalalas)).toBe(true);
          }
        }
      }
    }
  });
});

describe("generateEobGroundTruth — determinism", () => {
  it("same scenario + seed produces byte-identical JSON", () => {
    for (const scenario of EOB_SCENARIOS) {
      const a = generateEobGroundTruth(scenario, SEED);
      const b = generateEobGroundTruth(scenario, SEED);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });

  it("generateAllEob(count) is byte-identical across calls", () => {
    const a = generateAllEob(12);
    const b = generateAllEob(12);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("generateEobGroundTruth — per-scenario semantics", () => {
  it("clean has no denials and every line fully paid", () => {
    const { extraction } = generateEobGroundTruth("clean", SEED);
    for (const claim of extraction.claims) {
      for (const line of claim.lines) {
        expect(line.denialCode).toBeNull();
        expect(line.paidHalalas).toBeGreaterThan(0);
        expect(line.rejectedHalalas).toBe(0);
      }
    }
  });

  it("fullDenial: every line paidHalalas === 0 and denialCode is non-null", () => {
    const { extraction } = generateEobGroundTruth("fullDenial", SEED);
    for (const claim of extraction.claims) {
      for (const line of claim.lines) {
        expect(line.paidHalalas).toBe(0);
        expect(line.denialCode).not.toBeNull();
      }
    }
    expect(extraction.remittanceTotalPaidHalalas).toBe(0);
  });

  it("partialDenial denies some lines and accepts others", () => {
    const { extraction } = generateEobGroundTruth("partialDenial", SEED);
    const lines = extraction.claims.flatMap((c) => c.lines);
    const denied = lines.filter((l) => l.denialCode !== null);
    expect(denied.length).toBeGreaterThan(0);
    expect(denied.length).toBeLessThan(lines.length);
  });

  it("multiClaim bundles more than one claim under one remittance", () => {
    const { extraction } = generateEobGroundTruth("multiClaim", SEED);
    expect(extraction.claims.length).toBeGreaterThan(1);
  });

  it("mixedDigitSets: textLayer contains both Arabic-Indic and Western digits", () => {
    const { textLayer } = generateEobGroundTruth("mixedDigitSets", SEED);
    expect(/[٠-٩]/.test(textLayer)).toBe(true);
    expect(/[0-9]/.test(textLayer)).toBe(true);
  });

  it("lowQualityScan yields lower confidence than clean at the same seed", () => {
    const clean = generateEobGroundTruth("clean", SEED);
    const scan = generateEobGroundTruth("lowQualityScan", SEED);
    expect(scan.extraction.overallConfidence).toBeLessThan(
      clean.extraction.overallConfidence,
    );
    for (const claim of scan.extraction.claims) {
      expect(claim.confidence).toBeLessThan(1);
      for (const line of claim.lines) {
        expect(line.confidence).toBeLessThan(1);
      }
    }
  });

  it("arabicHeavy carries Arabic script and Arabic-Indic digits in payer name and textLayer", () => {
    const { extraction, textLayer } = generateEobGroundTruth("arabicHeavy", SEED);
    expect(/\p{Script=Arabic}/u.test(extraction.payerName)).toBe(true);
    expect(/\p{Script=Arabic}/u.test(textLayer)).toBe(true);
    expect(/[٠-٩]/.test(textLayer)).toBe(true);
  });

  it("bundledLines denies a line with the bundled code TWD-D07", () => {
    const { extraction } = generateEobGroundTruth("bundledLines", SEED);
    const codes = extraction.claims.flatMap((c) => c.lines.map((l) => l.denialCode));
    expect(codes).toContain("TWD-D07");
  });

  it("contractualAdjustment carries a nonzero write-off on the adjusted line, cross-totals with billed, and coexists with an ordinary denial", () => {
    const { extraction, textLayer } = generateEobGroundTruth("contractualAdjustment", SEED);
    const claim = extraction.claims[0]!;
    const adjustedLine = claim.lines[0]!;
    const deniedLine = claim.lines[2]!;

    // Gap 2's whole point: a genuine write-off > 0 on a non-denied line, and
    // the 5-bucket cross-total identity still holds exactly.
    expect(adjustedLine.adjustmentHalalas).toBeGreaterThan(0);
    expect(adjustedLine.denialCode).toBeNull();
    expect(
      adjustedLine.paidHalalas +
        adjustedLine.rejectedHalalas +
        adjustedLine.patientShareHalalas +
        adjustedLine.adjustmentHalalas,
    ).toBe(adjustedLine.billedHalalas);

    // A denied line never carries an adjustment (nothing left to write off).
    expect(deniedLine.denialCode).not.toBeNull();
    expect(deniedLine.adjustmentHalalas).toBe(0);

    // Claim-level total cross-totals against the sum of its lines' adjustments.
    const sumOfLineAdjustments = claim.lines.reduce(
      (sum, l) => sum + l.adjustmentHalalas,
      0,
    );
    expect(claim.totalAdjustmentHalalas).toBe(sumOfLineAdjustments);
    expect(claim.totalAdjustmentHalalas).toBeGreaterThan(0);

    // The write-off amount must actually be rendered into the text layer
    // (Gap 2's validator text-layer-match candidate depends on this), not
    // just carried in the structured extraction.
    expect(textLayer).toContain("Adjustment");
  });

  it("every scenario's htmlTemplate is a minimal valid bilingual RTL-aware document", () => {
    for (const scenario of EOB_SCENARIOS) {
      const { htmlTemplate } = generateEobGroundTruth(scenario, SEED);
      expect(htmlTemplate).toMatch(/^<!doctype html>/);
      expect(htmlTemplate).toContain("<html");
      expect(htmlTemplate).toMatch(/dir="(rtl|ltr)"/);
    }
  });

  // Code-review finding: buildHtmlTemplate never applied spec.digitSet — its
  // sar()/date output was always Western ASCII digits, even though the live
  // vision eval (packages/ai/evals/extractEob.eval.ts) rasterizes THIS
  // template to PDF and feeds that to extractEob(), never textLayer. So the
  // arabicHeavy/mixedDigitSets scenarios presented only Western numerals to
  // the model through the actual eval path, defeating the digit-diversity
  // property the corpus exists to stress.
  it("mixedDigitSets: htmlTemplate contains both Arabic-Indic and Western digits, not just textLayer", () => {
    const { htmlTemplate } = generateEobGroundTruth("mixedDigitSets", SEED);
    expect(/[٠-٩]/.test(htmlTemplate)).toBe(true);
    expect(/[0-9]/.test(htmlTemplate)).toBe(true);
  });

  it("arabicHeavy: htmlTemplate carries Arabic-Indic digits (arabicIndic digitSet), not Western-only", () => {
    const { htmlTemplate } = generateEobGroundTruth("arabicHeavy", SEED);
    expect(/[٠-٩]/.test(htmlTemplate)).toBe(true);
  });

  // Document-size stress pair (2026-07-18): the smallest and largest shapes
  // the corpus produces, so the rasterizer/extraction/scoring pipeline is
  // exercised at both size extremes, not just the 1-3 claim / 2-4 line
  // middle ground every other scenario sits in.
  it("minimalSingleLine has exactly one claim with exactly one line", () => {
    const { extraction, htmlTemplate } = generateEobGroundTruth("minimalSingleLine", SEED);
    expect(extraction.claims).toHaveLength(1);
    expect(extraction.claims[0]!.lines).toHaveLength(1);
    // Exactly one data row in the rendered <tbody>, not zero (an off-by-one
    // in the claim/line loop could silently render an empty table for
    // count=1) — <thead> also carries one <tr> of its own, so this counts
    // only within <tbody>, not the raw document-wide <tr> count.
    const tbody = htmlTemplate.match(/<tbody>([\s\S]*)<\/tbody>/)![1]!;
    expect(tbody.match(/<tr>/g)).toHaveLength(1);
  });

  it("denseLargeRemittance bundles 8 claims x 6 lines and every claim/line surfaces in the rendered document", () => {
    const { extraction, htmlTemplate } = generateEobGroundTruth("denseLargeRemittance", SEED);
    expect(extraction.claims).toHaveLength(8);
    for (const claim of extraction.claims) {
      expect(claim.lines).toHaveLength(6);
    }
    const totalLines = extraction.claims.reduce((sum, c) => sum + c.lines.length, 0);
    expect(totalLines).toBe(48);
    // Every claim's identity block (Claim/Patient/Service Date) and every
    // line's table row actually reached the rendered HTML — this is exactly
    // the class of bug the 2026-07-18 AI-4 eval investigation found (fields
    // computed in `extraction` but never rendered into `htmlTemplate`), so a
    // large scenario is the place most likely to expose a partial render
    // (e.g. only the first page's claims making it into the table).
    for (const claim of extraction.claims) {
      expect(htmlTemplate).toContain(claim.nphiesClaimId);
      expect(htmlTemplate).toContain(claim.patientRef);
    }
    const tbody = htmlTemplate.match(/<tbody>([\s\S]*)<\/tbody>/)![1]!;
    expect(tbody.match(/<tr>/g)).toHaveLength(48);
    // Cross-claim denials/adjustment (spread across claims 0, 2, 4, 5, 7 —
    // not just claim 0) all made it through.
    expect(htmlTemplate).toContain("TWD-D02");
    expect(htmlTemplate).toContain("TWD-D05");
    expect(htmlTemplate).toContain("TWD-D06");
    expect(htmlTemplate).toContain("TWD-D08");
    const adjustedClaim = extraction.claims[4]!;
    expect(adjustedClaim.lines[2]!.adjustmentHalalas).toBeGreaterThan(0);
  });
});

describe("generateAllEob", () => {
  it("cycles through EOB_SCENARIOS with per-item deterministic seeds", () => {
    const all = generateAllEob(40);
    expect(all).toHaveLength(40);
    const scenarioNames = new Set<EobScenarioName>(EOB_SCENARIOS);
    for (const item of all) {
      expect(scenarioNames.has(item.scenario)).toBe(true);
    }
    // No two items share a seed (base + index, strictly increasing).
    const seeds = all.map((item) => item.seed);
    expect(new Set(seeds).size).toBe(seeds.length);
  });

  it("defaults to 40 items", () => {
    expect(generateAllEob()).toHaveLength(40);
  });
});
