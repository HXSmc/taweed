import { describe, it, expect } from "vitest";
import { generateEobGroundTruth } from "@taweed/synthetic-eob";
import {
  scoreEobExtraction,
  scoreRate,
  aggregateScores,
  buildTierReport,
  tierReportRow,
  EVAL_TARGET_THRESHOLDS,
} from "../evals/scoring.js";
import type { EobExtraction } from "../src/schemas/eobExtraction.js";

// Ground truth from the real synthetic corpus (multiClaim: 3 claims x 2 lines,
// so reordering actually exercises identifier-based matching, not a no-op).
const GROUND_TRUTH = generateEobGroundTruth("multiClaim", 4242)
  .extraction as EobExtraction;

function clone(extraction: EobExtraction): EobExtraction {
  return structuredClone(extraction);
}

describe("scoreEobExtraction", () => {
  it("scores a byte-identical extraction as a perfect match", () => {
    const score = scoreEobExtraction(GROUND_TRUTH, clone(GROUND_TRUTH));
    expect(score.overall.correct).toBe(score.overall.total);
    expect(score.hallucinatedClaims).toBe(0);
    expect(score.hallucinatedLines).toBe(0);
  });

  it("counts a single wrong amount field as exactly one miss", () => {
    const actual = clone(GROUND_TRUTH);
    actual.claims[0]!.lines[0]!.paidHalalas += 100;
    const score = scoreEobExtraction(GROUND_TRUTH, actual);
    expect(score.amounts.total - score.amounts.correct).toBe(1);
    expect(score.overall.total - score.overall.correct).toBe(1);
  });

  // Gap 2 — proves the 5th "adjustment/withholding" bucket is actually
  // SCORED by scoreLine/scoreClaim's amounts category, not merely present on
  // the type. A candidate extraction that gets the write-off amount wrong
  // (line-level adjustmentHalalas, claim-level totalAdjustmentHalalas) must
  // be counted as a miss the same way every other money field is.
  it("counts a wrong line-level adjustmentHalalas as exactly one amounts miss", () => {
    const actual = clone(GROUND_TRUTH);
    actual.claims[0]!.lines[0]!.adjustmentHalalas += 1;
    const score = scoreEobExtraction(GROUND_TRUTH, actual);
    expect(score.amounts.total - score.amounts.correct).toBe(1);
    expect(score.overall.total - score.overall.correct).toBe(1);
  });

  it("counts a wrong claim-level totalAdjustmentHalalas as exactly one amounts miss", () => {
    const actual = clone(GROUND_TRUTH);
    actual.claims[0]!.totalAdjustmentHalalas += 1;
    const score = scoreEobExtraction(GROUND_TRUTH, actual);
    expect(score.amounts.total - score.amounts.correct).toBe(1);
    expect(score.overall.total - score.overall.correct).toBe(1);
  });

  it("matches claims and lines by identifier, not array position", () => {
    const actual = clone(GROUND_TRUTH);
    // Reverse claim order AND reverse each claim's line order — a positional
    // (index-based) comparison would now score nearly everything as wrong.
    actual.claims = [...actual.claims].reverse();
    for (const claim of actual.claims) {
      claim.lines = [...claim.lines].reverse();
    }
    const score = scoreEobExtraction(GROUND_TRUTH, actual);
    expect(score.overall.correct).toBe(score.overall.total);
    expect(score.hallucinatedClaims).toBe(0);
    expect(score.hallucinatedLines).toBe(0);
  });

  it("counts every field of a missing expected claim as incorrect, without crashing", () => {
    const actual = clone(GROUND_TRUTH);
    const removed = actual.claims.shift()!;
    const score = scoreEobExtraction(GROUND_TRUTH, actual);
    // The removed claim's ids (claimId, nphiesClaimId, patientRef, serviceDate)
    // + its lines' fields all miss; denominator still reflects the full
    // ground truth (expected) side.
    const expectedTotalFields = scoreEobExtraction(GROUND_TRUTH, GROUND_TRUTH).overall.total;
    expect(score.overall.total).toBe(expectedTotalFields);
    expect(score.overall.correct).toBeLessThan(score.overall.total);
    expect(removed.claimId).not.toBe("");
  });

  it("reports a hallucinated claim without inflating the denominator", () => {
    const actual = clone(GROUND_TRUTH);
    const hallucinated = structuredClone(actual.claims[0]!);
    // Matching is keyed by nphiesClaimId (see scoring.ts's claimKey) — a
    // claim identity is only genuinely novel/hallucinated if THAT field
    // differs, not claimId alone (claimId isn't reliably legible on a real
    // document, see scoring.ts's file-header comment for why it's not the
    // match key).
    hallucinated.nphiesClaimId = "NPHIES-CLM-hallucinated-999";
    hallucinated.claimId = "claim-hallucinated-999";
    actual.claims.push(hallucinated);
    const truthOnly = scoreEobExtraction(GROUND_TRUTH, GROUND_TRUTH);
    const withHallucination = scoreEobExtraction(GROUND_TRUTH, actual);
    expect(withHallucination.overall.total).toBe(truthOnly.overall.total);
    expect(withHallucination.hallucinatedClaims).toBe(1);
  });

  it("reports a hallucinated line without inflating the denominator", () => {
    const actual = clone(GROUND_TRUTH);
    const hallucinatedLine = structuredClone(actual.claims[0]!.lines[0]!);
    hallucinatedLine.claimLineRef = "line-hallucinated-999";
    actual.claims[0]!.lines.push(hallucinatedLine);
    const truthOnly = scoreEobExtraction(GROUND_TRUTH, GROUND_TRUTH);
    const withHallucination = scoreEobExtraction(GROUND_TRUTH, actual);
    expect(withHallucination.overall.total).toBe(truthOnly.overall.total);
    expect(withHallucination.hallucinatedLines).toBe(1);
  });
});

describe("scoreRate", () => {
  it("is vacuously 1 for an empty category", () => {
    expect(scoreRate({ correct: 0, total: 0 })).toBe(1);
  });

  it("divides correct by total otherwise", () => {
    expect(scoreRate({ correct: 49, total: 50 })).toBe(0.98);
  });
});

describe("aggregateScores / buildTierReport / tierReportRow", () => {
  it("sums per-document breakdowns and flags target-threshold comparisons", () => {
    const perfect = scoreEobExtraction(GROUND_TRUTH, clone(GROUND_TRUTH));
    const flawed = clone(GROUND_TRUTH);
    flawed.claims[0]!.lines[0]!.billedHalalas += 1;
    const withOneMiss = scoreEobExtraction(GROUND_TRUTH, flawed);

    const agg = aggregateScores([perfect, withOneMiss]);
    expect(agg.overall.total).toBe(perfect.overall.total + withOneMiss.overall.total);

    const report = buildTierReport("sonnet", 2, [perfect, withOneMiss]);
    expect(report.scenarioCount).toBe(2);
    expect(report.amountsRate).toBeLessThan(1);
    expect(report.meetsAmountsTarget).toBe(report.amountsRate >= EVAL_TARGET_THRESHOLDS.amounts);
    expect(report.meetsOverallTarget).toBe(report.overallRate >= EVAL_TARGET_THRESHOLDS.overall);

    const row = tierReportRow(report);
    expect(row.tier).toBe("sonnet");
    expect(row["target amounts %"]).toBe("98%");
    expect(row["target overall %"]).toBe("95%");
  });
});
