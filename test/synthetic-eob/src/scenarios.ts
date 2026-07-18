import type { DenialReasonCode } from "@taweed/shared";

export const EOB_SCENARIOS = [
  "clean",
  "fullDenial",
  "partialDenial",
  "multiClaim",
  "mixedDigitSets",
  "lowQualityScan",
  "arabicHeavy",
  "bundledLines",
  "contractualAdjustment",
  "minimalSingleLine",
  "denseLargeRemittance",
] as const;

export type EobScenarioName = (typeof EOB_SCENARIOS)[number];

export type DigitSet = "western" | "arabicIndic" | "mixed";

export interface EobScenarioSpec {
  /** Number of claims bundled into this synthetic remittance. */
  claimCount: number;
  /** Line count per claim (uniform across claims, for generator simplicity). */
  linesPerClaim: number;
  /**
   * claim-index -> line-index -> denial reason code. Absent entries are
   * accepted lines (paidHalalas > 0, denialCode null).
   */
  denials: Record<number, Record<number, DenialReasonCode>>;
  /**
   * claim-index -> line-index -> contractual write-off/withholding amount
   * (halalas), Gap 2's 5th money bucket. Absent entries carry no adjustment
   * (adjustmentHalalas: 0). Mirrors `denials`' shape exactly. Only ever
   * applied to a non-denied line (see generate.ts buildLine) — a denied
   * line's paidHalalas is already 0 and cannot absorb a write-off too.
   */
  adjustments: Record<number, Record<number, number>>;
  /** Header/table language — drives payer name + textLayer/htmlTemplate copy. */
  language: "en" | "ar";
  /** Digit script used when rendering numbers into textLayer/htmlTemplate. */
  digitSet: DigitSet;
  /**
   * Marker only (no image degradation this session) — lowers generated
   * confidence values so a downstream consumer can assert on the observable
   * effect (confidence) rather than a synthetic flag baked into extraction.
   */
  lowQualityScan: boolean;
  payer: { name: string; nphiesId: string };
}

const PAYER_DEFAULT = { name: "Placeholder Insurer", nphiesId: "payer-nphies-0" };
const PAYER_AR = { name: "شركة التأمين التعاونية (تجريبي)", nphiesId: "payer-nphies-AR" };

export const EOB_SCENARIO_SPECS: Record<EobScenarioName, EobScenarioSpec> = {
  clean: {
    claimCount: 1,
    linesPerClaim: 2,
    denials: {},
    adjustments: {},
    language: "en",
    digitSet: "western",
    lowQualityScan: false,
    payer: PAYER_DEFAULT,
  },
  fullDenial: {
    claimCount: 1,
    linesPerClaim: 2,
    denials: { 0: { 0: "TWD-D01", 1: "TWD-D05" } },
    adjustments: {},
    language: "en",
    digitSet: "western",
    lowQualityScan: false,
    payer: PAYER_DEFAULT,
  },
  partialDenial: {
    claimCount: 1,
    linesPerClaim: 3,
    denials: { 0: { 1: "TWD-D03" } },
    adjustments: {},
    language: "en",
    digitSet: "western",
    lowQualityScan: false,
    payer: PAYER_DEFAULT,
  },
  multiClaim: {
    claimCount: 3,
    linesPerClaim: 2,
    denials: { 1: { 0: "TWD-D02" } },
    adjustments: {},
    language: "en",
    digitSet: "western",
    lowQualityScan: false,
    payer: PAYER_DEFAULT,
  },
  mixedDigitSets: {
    claimCount: 1,
    linesPerClaim: 2,
    denials: {},
    adjustments: {},
    language: "en",
    digitSet: "mixed",
    lowQualityScan: false,
    payer: PAYER_DEFAULT,
  },
  lowQualityScan: {
    claimCount: 1,
    linesPerClaim: 2,
    denials: {},
    adjustments: {},
    language: "en",
    digitSet: "western",
    lowQualityScan: true,
    payer: PAYER_DEFAULT,
  },
  arabicHeavy: {
    claimCount: 2,
    linesPerClaim: 2,
    denials: { 0: { 0: "TWD-D06" } },
    adjustments: {},
    language: "ar",
    digitSet: "arabicIndic",
    lowQualityScan: false,
    payer: PAYER_AR,
  },
  bundledLines: {
    claimCount: 1,
    linesPerClaim: 4,
    denials: { 0: { 2: "TWD-D07" } },
    adjustments: {},
    language: "en",
    digitSet: "western",
    lowQualityScan: false,
    payer: PAYER_DEFAULT,
  },
  // Gap 2 — a real remittance carrying a contractual write-off/withholding
  // (5th money bucket) alongside an ordinary denial, so the corpus exercises
  // both a non-denied adjusted line (line 0, generate.ts's buildLine
  // subtracts the write-off from paidHalalas) and a denied line (line 2,
  // paidHalalas already 0 and never adjusted) in the same claim.
  contractualAdjustment: {
    claimCount: 1,
    linesPerClaim: 3,
    denials: { 0: { 2: "TWD-D01" } },
    adjustments: { 0: { 0: 150 } },
    language: "en",
    digitSet: "western",
    lowQualityScan: false,
    payer: PAYER_DEFAULT,
  },
  // Document-size stress test, smallest end: exactly one claim, one line —
  // the minimum shape the extraction schema allows. Exercises the
  // rasterizer/extraction/scoring path at the opposite extreme from
  // denseLargeRemittance below, where a near-empty claims table or an
  // off-by-one in claim/line iteration would otherwise go unnoticed.
  minimalSingleLine: {
    claimCount: 1,
    linesPerClaim: 1,
    denials: {},
    adjustments: {},
    language: "en",
    digitSet: "western",
    lowQualityScan: false,
    payer: PAYER_DEFAULT,
  },
  // Document-size stress test, largest end: 8 claims x 6 lines = 48 rows,
  // well past every other scenario's max (3 claims x 4 lines) and large
  // enough that Chromium's page.pdf({format: "A4"}) (rasterize.ts) must
  // paginate across multiple real pages rather than fitting on one — the
  // live vision eval needs to prove multi-page documents extract and score
  // correctly, not just single-page ones. Denials/an adjustment are spread
  // across several claims (not just claim 0) so cross-claim matching is
  // exercised at scale too, not just per-claim arithmetic.
  denseLargeRemittance: {
    claimCount: 8,
    linesPerClaim: 6,
    denials: {
      0: { 0: "TWD-D02" },
      2: { 3: "TWD-D05" },
      5: { 1: "TWD-D06" },
      7: { 5: "TWD-D08" },
    },
    adjustments: { 4: { 2: 200 } },
    language: "en",
    digitSet: "western",
    lowQualityScan: false,
    payer: PAYER_DEFAULT,
  },
};
