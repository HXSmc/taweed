// AI-4 eval scoring (plan 04 §9, §6 step 6) — field-level exact-match scoring
// of a candidate EobExtraction against synthetic-corpus ground truth. PURE and
// synchronous: no server-only, no DB, no network, no fs. Kept separate from
// extractEob.eval.ts (which IS server-only-tainted via @taweed/ai's feature
// functions) so this module can be unit-tested in the normal CI-safe unit
// suite (see ../test/eval-scoring.test.ts) instead of only ever running under
// the live-gated `evals` vitest project.
//
// Matching policy (deliberate, not positional): claims are matched by
// `claimId` and lines by `claimLineRef`, NOT by array index. A model that
// reorders, drops, or merges claims/lines would make positional (index-based)
// comparison silently score every subsequent field as wrong for the wrong
// reason — the numbers would look like an accuracy problem when the real
// defect is alignment. Matching by identifier means:
//   - An expected claim/line with no identifier match in the actual output
//     counts every one of its fields as incorrect (denominator still comes
//     from the expected/ground-truth side).
//   - An actual claim/line with no identifier match in the expected output
//     (a hallucination) does NOT inflate the denominator — it is reported
//     separately via `hallucinatedClaims`/`hallucinatedLines` as a diagnostic
//     signal, not folded into the exact-match rate.

import type {
  EobClaim,
  EobExtraction,
  EobLine,
} from "../src/schemas/eobExtraction.js";

export interface FieldScore {
  correct: number;
  total: number;
}

export interface EobScoreBreakdown {
  /** identifiers/dates: payer/claim/patient/date fields + claimLineRef. */
  ids: FieldScore;
  /** money fields, always integer halalas (design-brief digit-exactness). */
  amounts: FieldScore;
  /** SBS / ICD-10-AM / denial reason codes. */
  codes: FieldScore;
  /** ids + amounts + codes combined. */
  overall: FieldScore;
  /** actual claims with no claimId match in the expected corpus item. */
  hallucinatedClaims: number;
  /** actual lines (across all claims) with no claimLineRef match. */
  hallucinatedLines: number;
}

function scoreField(expectedVal: unknown, actualVal: unknown): FieldScore {
  return { correct: expectedVal === actualVal ? 1 : 0, total: 1 };
}

function combine(...scores: FieldScore[]): FieldScore {
  return scores.reduce(
    (acc, s) => ({ correct: acc.correct + s.correct, total: acc.total + s.total }),
    { correct: 0, total: 0 },
  );
}

interface LineScore {
  ids: FieldScore;
  amounts: FieldScore;
  codes: FieldScore;
}

function scoreLine(expected: EobLine, actual: EobLine | undefined): LineScore {
  const ids = scoreField(expected.claimLineRef, actual?.claimLineRef);
  const amounts = combine(
    scoreField(expected.billedHalalas, actual?.billedHalalas),
    scoreField(expected.paidHalalas, actual?.paidHalalas),
    scoreField(expected.patientShareHalalas, actual?.patientShareHalalas),
    scoreField(expected.rejectedHalalas, actual?.rejectedHalalas),
    scoreField(expected.adjustmentHalalas, actual?.adjustmentHalalas),
  );
  const codes = combine(
    scoreField(expected.sbsCode, actual?.sbsCode),
    scoreField(expected.icd10amCode, actual?.icd10amCode),
    scoreField(expected.denialCode, actual?.denialCode),
  );
  return { ids, amounts, codes };
}

interface ClaimScore {
  ids: FieldScore;
  amounts: FieldScore;
  codes: FieldScore;
  hallucinatedLines: number;
}

function scoreClaim(expected: EobClaim, actual: EobClaim | undefined): ClaimScore {
  const claimIds = combine(
    scoreField(expected.claimId, actual?.claimId),
    scoreField(expected.nphiesClaimId, actual?.nphiesClaimId),
    scoreField(expected.patientRef, actual?.patientRef),
    scoreField(expected.serviceDate, actual?.serviceDate),
  );
  const claimAmounts = combine(
    scoreField(expected.totalBilledHalalas, actual?.totalBilledHalalas),
    scoreField(expected.totalPaidHalalas, actual?.totalPaidHalalas),
    scoreField(expected.totalRejectedHalalas, actual?.totalRejectedHalalas),
    scoreField(expected.totalAdjustmentHalalas, actual?.totalAdjustmentHalalas),
  );

  const actualLinesByRef = new Map(
    (actual?.lines ?? []).map((line) => [line.claimLineRef, line] as const),
  );
  const lineScores = expected.lines.map((line) =>
    scoreLine(line, actualLinesByRef.get(line.claimLineRef)),
  );

  const expectedRefs = new Set(expected.lines.map((line) => line.claimLineRef));
  const hallucinatedLines = (actual?.lines ?? []).filter(
    (line) => !expectedRefs.has(line.claimLineRef),
  ).length;

  return {
    ids: combine(claimIds, ...lineScores.map((s) => s.ids)),
    amounts: combine(claimAmounts, ...lineScores.map((s) => s.amounts)),
    codes: combine(...lineScores.map((s) => s.codes)),
    hallucinatedLines,
  };
}

/**
 * Scores one candidate extraction against its ground truth. Denominators
 * (`total`) always come from `expected` — see the file header for the
 * identifier-matching policy and how hallucinated claims/lines are reported
 * instead of silently inflating totals.
 */
export function scoreEobExtraction(
  expected: EobExtraction,
  actual: EobExtraction,
): EobScoreBreakdown {
  const topIds = combine(
    scoreField(expected.payerName, actual.payerName),
    scoreField(expected.payerNphiesId, actual.payerNphiesId),
    scoreField(expected.remittanceDate, actual.remittanceDate),
  );
  const topAmounts = scoreField(
    expected.remittanceTotalPaidHalalas,
    actual.remittanceTotalPaidHalalas,
  );

  const actualClaimsById = new Map(
    actual.claims.map((claim) => [claim.claimId, claim] as const),
  );
  const claimScores = expected.claims.map((claim) =>
    scoreClaim(claim, actualClaimsById.get(claim.claimId)),
  );

  const expectedClaimIds = new Set(expected.claims.map((claim) => claim.claimId));
  const hallucinatedClaims = actual.claims.filter(
    (claim) => !expectedClaimIds.has(claim.claimId),
  ).length;
  const hallucinatedLines = claimScores.reduce(
    (sum, s) => sum + s.hallucinatedLines,
    0,
  );

  const ids = combine(topIds, ...claimScores.map((s) => s.ids));
  const amounts = combine(topAmounts, ...claimScores.map((s) => s.amounts));
  const codes = combine(...claimScores.map((s) => s.codes));
  const overall = combine(ids, amounts, codes);

  return { ids, amounts, codes, overall, hallucinatedClaims, hallucinatedLines };
}

/** Exact-match rate for one FieldScore; a field category with 0 fields reads as 1 (vacuously correct). */
export function scoreRate(score: FieldScore): number {
  return score.total === 0 ? 1 : score.correct / score.total;
}

/** Sums an array of per-document breakdowns into one aggregate breakdown. */
export function aggregateScores(scores: EobScoreBreakdown[]): EobScoreBreakdown {
  return scores.reduce(
    (acc, s) => ({
      ids: combine(acc.ids, s.ids),
      amounts: combine(acc.amounts, s.amounts),
      codes: combine(acc.codes, s.codes),
      overall: combine(acc.overall, s.overall),
      hallucinatedClaims: acc.hallucinatedClaims + s.hallucinatedClaims,
      hallucinatedLines: acc.hallucinatedLines + s.hallucinatedLines,
    }),
    {
      ids: { correct: 0, total: 0 },
      amounts: { correct: 0, total: 0 },
      codes: { correct: 0, total: 0 },
      overall: { correct: 0, total: 0 },
      hallucinatedClaims: 0,
      hallucinatedLines: 0,
    },
  );
}

// Documented SUGGESTED targets (plan 04 §9 step 6: "suggest >=98% on amounts,
// >=95% overall — tune with the golden data"). These are printed in the
// report for comparison; nothing in this module or extractEob.eval.ts asserts
// a live run must clear them — see extractEob.eval.ts's header comment for why.
export const EVAL_TARGET_THRESHOLDS = {
  amounts: 0.98,
  overall: 0.95,
} as const;

export type EvalModelTier = "sonnet" | "opus";

export interface TierReport {
  tier: EvalModelTier;
  scenarioCount: number;
  ids: FieldScore;
  amounts: FieldScore;
  codes: FieldScore;
  overall: FieldScore;
  hallucinatedClaims: number;
  hallucinatedLines: number;
  amountsRate: number;
  overallRate: number;
  meetsAmountsTarget: boolean;
  meetsOverallTarget: boolean;
}

/** Aggregates a tier's per-document scores into a report row, with target-threshold comparisons attached (informational, not asserted). */
export function buildTierReport(
  tier: EvalModelTier,
  scenarioCount: number,
  scores: EobScoreBreakdown[],
): TierReport {
  const agg = aggregateScores(scores);
  const amountsRate = scoreRate(agg.amounts);
  const overallRate = scoreRate(agg.overall);
  return {
    tier,
    scenarioCount,
    ...agg,
    amountsRate,
    overallRate,
    meetsAmountsTarget: amountsRate >= EVAL_TARGET_THRESHOLDS.amounts,
    meetsOverallTarget: overallRate >= EVAL_TARGET_THRESHOLDS.overall,
  };
}

/** Renders a TierReport as a flat row suitable for console.table. */
export function tierReportRow(report: TierReport): Record<string, string | number> {
  return {
    tier: report.tier,
    scenarios: report.scenarioCount,
    "ids (n)": `${report.ids.correct}/${report.ids.total}`,
    "amounts (n)": `${report.amounts.correct}/${report.amounts.total}`,
    "codes (n)": `${report.codes.correct}/${report.codes.total}`,
    "amounts %": `${(report.amountsRate * 100).toFixed(1)}%`,
    "overall %": `${(report.overallRate * 100).toFixed(1)}%`,
    "target amounts %": `${(EVAL_TARGET_THRESHOLDS.amounts * 100).toFixed(0)}%`,
    "target overall %": `${(EVAL_TARGET_THRESHOLDS.overall * 100).toFixed(0)}%`,
    hallucinatedClaims: report.hallucinatedClaims,
    hallucinatedLines: report.hallucinatedLines,
  };
}
