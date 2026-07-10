// AI-4 — deterministic, pure post-hoc validation of an EobExtraction against
// its own arithmetic and against the source PDF's text layer (plan 04 §9).
// This module makes NO accept/reject decision: it only reports findings. A
// failing report (passed:false) must NEVER be auto-accepted by a caller — the
// caller is responsible for routing a failing extraction to human review or a
// higher-tier model retry. That routing decision deliberately does not live
// here, mirroring how scrub()/the rules-engine reports flags without itself
// deciding claim disposition.
//
// No network/model calls happen in this file — everything here is pure and
// synchronous, operating only on data already produced by a prior
// runStructured() call (see run.ts / features/*.ts for that boundary).

import { toSar } from "@taweed/analytics";
import { isDenialReasonCode } from "@taweed/shared";
import { normalizeArabicOutput } from "./postprocess-ar.js";
import type { EobClaim, EobExtraction, EobLine } from "./schemas/eobExtraction.js";

export interface ValidatorFinding {
  check: string;
  passed: boolean;
  detail: string;
}

export interface ValidatorReport {
  passed: boolean;
  findings: ValidatorFinding[];
}

// --- normalization helpers for text-layer comparison ------------------------

// A digit-agnostic, bidi-agnostic haystack: normalizeArabicOutput already
// folds Arabic-Indic/Eastern-Arabic-Indic digits to Western, strips stray
// tashkeel, and strips/re-isolates bidi control marks (postprocess-ar.ts is
// the single source of truth for this — reused, not reimplemented, here). We
// only need a plain substring search, so we additionally strip the LRM marks
// normalizeArabicOutput re-adds around Latin runs — cosmetic isolation for
// display, not present in the raw needle strings we compare against.
function normalizeForMatch(input: string): string {
  return normalizeArabicOutput(input).replace(/‎/g, "");
}

// Presence check, not a positional one: a plain substring search means a
// short, non-unique needle (e.g. a repeated amount like "0.00") can false-pass
// if it happens to appear anywhere else in the text layer, even attached to a
// different line. The cross-total checks above are the real arithmetic guard
// for amounts — a wrong per-line amount will independently break
// billed == paid+rejected+patientShare and fail "line-total" — so this check
// is deliberately scoped to "does this value appear verbatim somewhere",
// mainly load-bearing for high-cardinality needles (claim ids, SBS/ICD codes).
function textLayerContains(haystack: string, needle: string): boolean {
  return normalizeForMatch(haystack).includes(normalizeForMatch(needle));
}

// --- mixed-digit-set anomaly -------------------------------------------------

const ARABIC_INDIC_DIGIT = /[٠-٩۰-۹]/;
const WESTERN_DIGIT = /[0-9]/;

// Soft anomaly, not a hard failure (documented choice): a single field mixing
// Arabic-Indic and Western digits is unusual — genuine remittance PDFs are
// scenario-consistent in digit script (see test/synthetic-eob's per-scenario
// `digitSet` spec — mixing happens across a scenario's fields, not within one
// field) — but a mixed field isn't on its own proof of a wrong value.
//
// The report contract is "ANY finding failing means overall passed:false" —
// so a soft signal MUST be encoded as an always-`passed:true` finding whose
// `detail` carries the anomaly text, never as `passed:false`. That keeps
// `report.passed === findings.every(f => f.passed)` an honest identity: a
// caller filtering `findings.some(f => !f.passed)` to decide "route to
// review" gets exactly the same answer as reading `report.passed`, and never
// mistakes this soft signal for a hard failure. Callers who want to act on
// the anomaly anyway can still inspect `check === "mixed-digit-set"` and read
// its `detail`.
function hasMixedDigitSet(value: string): boolean {
  return ARABIC_INDIC_DIGIT.test(value) && WESTERN_DIGIT.test(value);
}

function mixedDigitFinding(fieldPath: string, value: string): ValidatorFinding {
  const mixed = hasMixedDigitSet(value);
  return {
    check: "mixed-digit-set",
    passed: true, // always non-blocking — see comment above
    detail: mixed
      ? `${fieldPath} mixes Arabic-Indic and Western digits in one field: ${JSON.stringify(value)} (soft anomaly, not a hard failure — does not affect report.passed)`
      : `${fieldPath} uses a single consistent digit script`,
  };
}

// --- cross-total checks -------------------------------------------------------

function lineTotalFinding(claimId: string, line: EobLine): ValidatorFinding {
  const sum =
    line.paidHalalas + line.rejectedHalalas + line.patientShareHalalas + line.adjustmentHalalas;
  const ok = sum === line.billedHalalas;
  const path = `${claimId}/${line.claimLineRef}`;
  return {
    check: "line-total",
    passed: ok,
    detail: ok
      ? `${path}: billed ${line.billedHalalas} == paid+rejected+patientShare+adjustment (${sum})`
      : `${path}: billed ${line.billedHalalas} != paid(${line.paidHalalas})+rejected(${line.rejectedHalalas})+patientShare(${line.patientShareHalalas})+adjustment(${line.adjustmentHalalas})=${sum}`,
  };
}

function claimTotalFindings(claim: EobClaim): ValidatorFinding[] {
  const sums = claim.lines.reduce(
    (acc, l) => ({
      billed: acc.billed + l.billedHalalas,
      paid: acc.paid + l.paidHalalas,
      rejected: acc.rejected + l.rejectedHalalas,
      adjustment: acc.adjustment + l.adjustmentHalalas,
    }),
    { billed: 0, paid: 0, rejected: 0, adjustment: 0 },
  );

  const checks: Array<[string, number, number]> = [
    ["totalBilledHalalas", claim.totalBilledHalalas, sums.billed],
    ["totalPaidHalalas", claim.totalPaidHalalas, sums.paid],
    ["totalRejectedHalalas", claim.totalRejectedHalalas, sums.rejected],
    ["totalAdjustmentHalalas", claim.totalAdjustmentHalalas, sums.adjustment],
  ];

  return checks.map(([field, declared, computed]) => {
    const ok = declared === computed;
    return {
      check: "claim-total",
      passed: ok,
      detail: ok
        ? `${claim.claimId}: ${field} ${declared} == sum of line values (${computed})`
        : `${claim.claimId}: ${field} ${declared} != sum of line values (${computed})`,
    };
  });
}

function remittanceTotalFinding(extraction: EobExtraction): ValidatorFinding {
  const computed = extraction.claims.reduce(
    (sum, claim) => sum + claim.totalPaidHalalas,
    0,
  );
  const ok = extraction.remittanceTotalPaidHalalas === computed;
  return {
    check: "remittance-total",
    passed: ok,
    detail: ok
      ? `remittanceTotalPaidHalalas ${extraction.remittanceTotalPaidHalalas} == sum of claim totalPaidHalalas (${computed})`
      : `remittanceTotalPaidHalalas ${extraction.remittanceTotalPaidHalalas} != sum of claim totalPaidHalalas (${computed})`,
  };
}

// --- verbatim text-layer match ------------------------------------------------

function textMatchFinding(
  textLayer: string,
  fieldPath: string,
  needle: string | null,
): ValidatorFinding | null {
  if (needle === null || needle.trim() === "") return null;
  const found = textLayerContains(textLayer, needle);
  return {
    check: "text-layer-match",
    passed: found,
    detail: found
      ? `${fieldPath} value ${JSON.stringify(needle)} found verbatim in the text layer`
      : `${fieldPath} value ${JSON.stringify(needle)} NOT found in the text layer (missing or corrupted)`,
  };
}

function lineTextFindings(
  textLayer: string,
  claimId: string,
  line: EobLine,
): ValidatorFinding[] {
  const path = `${claimId}/${line.claimLineRef}`;
  const candidates: Array<[string, string | null]> = [
    [`${path}.claimLineRef`, line.claimLineRef],
    [`${path}.sbsCode`, line.sbsCode],
    [`${path}.icd10amCode`, line.icd10amCode],
    [`${path}.billedHalalas`, toSar(line.billedHalalas)],
    [`${path}.paidHalalas`, toSar(line.paidHalalas)],
    [`${path}.patientShareHalalas`, toSar(line.patientShareHalalas)],
    [`${path}.rejectedHalalas`, toSar(line.rejectedHalalas)],
    [`${path}.adjustmentHalalas`, toSar(line.adjustmentHalalas)],
    [`${path}.denialCode`, line.denialCode],
  ];
  return candidates
    .map(([field, value]) => textMatchFinding(textLayer, field, value))
    .filter((f): f is ValidatorFinding => f !== null);
}

function claimTextFindings(textLayer: string, claim: EobClaim): ValidatorFinding[] {
  const candidates: Array<[string, string | null]> = [
    [`${claim.claimId}.claimId`, claim.claimId],
    [`${claim.claimId}.nphiesClaimId`, claim.nphiesClaimId],
    [`${claim.claimId}.patientRef`, claim.patientRef],
  ];
  const claimFindings = candidates
    .map(([field, value]) => textMatchFinding(textLayer, field, value))
    .filter((f): f is ValidatorFinding => f !== null);
  const lineFindings = claim.lines.flatMap((line) =>
    lineTextFindings(textLayer, claim.claimId, line),
  );
  return [...claimFindings, ...lineFindings];
}

// --- denial-code validity (defense in depth) ---------------------------------

// Validated again here (not just trusted from the schema) because this
// module may run on data that never passed through EobExtractionSchema's
// z.enum guard — e.g. a hand-edited review-queue correction.
function denialCodeFinding(claimId: string, line: EobLine): ValidatorFinding {
  const path = `${claimId}/${line.claimLineRef}.denialCode`;
  if (line.denialCode === null) {
    return { check: "denial-code-valid", passed: true, detail: `${path} is null (no denial)` };
  }
  const ok = isDenialReasonCode(line.denialCode);
  return {
    check: "denial-code-valid",
    passed: ok,
    detail: ok
      ? `${path} ${line.denialCode} is a recognized denial reason code`
      : `${path} ${JSON.stringify(line.denialCode)} is NOT in DENIAL_REASON_CODES — schema enum bypassed (e.g. hand-edited review-queue correction)`,
  };
}

// --- entry point --------------------------------------------------------------

/**
 * Validates an EobExtraction's internal arithmetic and its fidelity against
 * the source document's text layer. Pure and synchronous — no model or
 * network calls. NEVER auto-accepts: `passed:false` (or any individual failing
 * finding, aside from the soft `mixed-digit-set` signal) means the caller must
 * route to human review or a higher-tier model retry. This function only
 * reports; it makes no accept/reject decision itself.
 */
export function validateEobExtraction(
  extraction: EobExtraction,
  textLayer: string,
): ValidatorReport {
  const findings: ValidatorFinding[] = [];

  // Cross-totals: per-line, per-claim, remittance-level.
  for (const claim of extraction.claims) {
    for (const line of claim.lines) {
      findings.push(lineTotalFinding(claim.claimId, line));
    }
    findings.push(...claimTotalFindings(claim));
  }
  findings.push(remittanceTotalFinding(extraction));

  // Verbatim text-layer match — top-level fields, then every claim/line field.
  const topLevelText: Array<[string, string | null]> = [
    ["payerName", extraction.payerName],
    ["payerNphiesId", extraction.payerNphiesId],
    ["remittanceDate", extraction.remittanceDate],
    ["remittanceTotalPaidHalalas", toSar(extraction.remittanceTotalPaidHalalas)],
  ];
  for (const [field, value] of topLevelText) {
    const finding = textMatchFinding(textLayer, field, value);
    if (finding) findings.push(finding);
  }
  for (const claim of extraction.claims) {
    findings.push(...claimTextFindings(textLayer, claim));
  }

  // Denial-code validity (defense in depth — schema enum may be bypassed).
  for (const claim of extraction.claims) {
    for (const line of claim.lines) {
      findings.push(denialCodeFinding(claim.claimId, line));
    }
  }

  // Mixed-digit-set anomaly (soft — reported, does not flip `passed`).
  const digitFields: Array<[string, string | null]> = [
    ["remittanceDate", extraction.remittanceDate],
    ...extraction.claims.map(
      (claim): [string, string | null] => [`${claim.claimId}.serviceDate`, claim.serviceDate],
    ),
  ];
  for (const [field, value] of digitFields) {
    if (value !== null) findings.push(mixedDigitFinding(field, value));
  }

  // Contract: ANY finding failing means overall passed:false. mixed-digit-set
  // findings are always passed:true (see mixedDigitFinding) so this identity
  // holds literally — no special-cased exclusion needed.
  const passed = findings.every((f) => f.passed);

  return { passed, findings };
}

/**
 * validateEobExtraction scored WITHOUT a text layer: every text-layer-match
 * finding is filtered out (scoring against "" would otherwise make all of
 * them fail spuriously) and `passed` is recomputed from what remains
 * (arithmetic cross-totals, denial-code validity, the soft mixed-digit-set
 * signal). Shared by every caller that may not have the source PDF's text
 * layer on hand: claude-vision-ocr.ts's extraction path when no textLayer was
 * supplied, and eob-review.ts's re-check-on-approve path (the stored row
 * persists the report, not the text layer itself).
 */
export function validateEobExtractionArithmetic(
  extraction: EobExtraction,
): ValidatorReport {
  const report = validateEobExtraction(extraction, "");
  const findings = report.findings.filter((f) => f.check !== "text-layer-match");
  return { passed: findings.every((f) => f.passed), findings };
}
