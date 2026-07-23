// AI-2 assistAppeal eval scoring — classifies the REAL assistAppeal() pipeline
// result without touching its internal self-judge verifyScore as the primary
// cross-provider metric (see the eval-suite plan's advisor note: assistAppeal
// injects ONE provider for both generation AND its internal verify-judge step,
// so a provider grading its own output is not comparable to another provider
// grading ITS OWN output — different self-generosity, not different quality).
//
// The pipeline's `reason` string (assistAppeal.ts) already carries the
// classification for free:
//   - suppressed, reason starts "en:"/"ar:" -> failed the DETERMINISTIC
//     checkParagraphs gate (appeal-guardrails.ts — pure regex, no model
//     involved: no invented numbers, no unknown slots, non-empty). This is
//     the PRIMARY cross-provider metric: objective structural safety.
//   - suppressed, reason starts "verify:<score>" -> failed the SELF-judged
//     gate. Reported separately, explicitly caveated, never blended into the
//     primary score.
//   - ok:true -> passed both the objective gate AND the self-verify.
// Pure/sync, no server-only/DB/network — unit-testable directly.

import type { AssistAppealResult } from "../src/features/assistAppeal.js";
import { ARABIC_INDIC_DIGITS, rate } from "./scoringUtils.js";

export type AssistAppealOutcome =
  | "ok"
  | "objective-gate-failed"
  | "self-verify-suppressed"
  | "unrecognized-suppression"
  | "schema-invalid";

const MIN_PARAGRAPHS = 1;
const MAX_PARAGRAPHS = 4;

export interface AssistAppealCheck {
  outcome: AssistAppealOutcome;
  /** only set when outcome === "ok" */
  paragraphShapeOk?: boolean;
  digitLawOk?: boolean;
  /** self-judged verify score, when the pipeline reached that stage — informational only, see file header. */
  selfVerifyScore?: number;
}

function classifyReason(reason: string): AssistAppealOutcome {
  if (reason.startsWith("en:") || reason.startsWith("ar:")) {
    return "objective-gate-failed";
  }
  if (reason.startsWith("verify:")) return "self-verify-suppressed";
  return "unrecognized-suppression";
}

export function scoreAssistAppeal(result: AssistAppealResult): AssistAppealCheck {
  if (!result.ok) {
    const outcome = classifyReason(result.reason);
    const check: AssistAppealCheck = { outcome };
    if (outcome === "self-verify-suppressed") {
      const scoreStr = result.reason.split(":")[1];
      const score = scoreStr === undefined ? undefined : Number(scoreStr);
      if (score !== undefined && !Number.isNaN(score)) check.selfVerifyScore = score;
    }
    return check;
  }

  const paragraphCounts = [
    result.suggestion.paragraphs_en.length,
    result.suggestion.paragraphs_ar.length,
  ];
  const paragraphShapeOk = paragraphCounts.every(
    (n) => n >= MIN_PARAGRAPHS && n <= MAX_PARAGRAPHS,
  );
  const allText = [
    ...result.suggestion.paragraphs_en,
    ...result.suggestion.paragraphs_ar,
  ].join(" ");
  const digitLawOk = !ARABIC_INDIC_DIGITS.test(allText);

  return {
    outcome: "ok",
    paragraphShapeOk,
    digitLawOk,
    selfVerifyScore: result.verifyScore,
  };
}

export interface AssistAppealReport {
  provider: string;
  itemCount: number;
  /** PRIMARY cross-provider metric — objective, not self-judged. */
  objectiveGatePassRate: number;
  okRate: number;
  selfVerifySuppressedRate: number;
  schemaInvalidRate: number;
  unrecognizedSuppressionCount: number;
}

export function buildAssistAppealReport(
  provider: string,
  checks: AssistAppealCheck[],
): AssistAppealReport {
  return {
    provider,
    itemCount: checks.length,
    // "Passed the objective gate" = reached ok:true OR was only suppressed by
    // the self-judge (which means it ALREADY cleared the objective gate) —
    // explicitly enumerated (not "everything except objective-gate-failed")
    // so schema-invalid and unrecognized-suppression are correctly counted
    // as NOT passing rather than silently defaulting to a pass.
    objectiveGatePassRate: rate(
      checks,
      (c) => c.outcome === "ok" || c.outcome === "self-verify-suppressed",
    ),
    okRate: rate(checks, (c) => c.outcome === "ok"),
    selfVerifySuppressedRate: rate(checks, (c) => c.outcome === "self-verify-suppressed"),
    schemaInvalidRate: rate(checks, (c) => c.outcome === "schema-invalid"),
    unrecognizedSuppressionCount: checks.filter(
      (c) => c.outcome === "unrecognized-suppression",
    ).length,
  };
}

/** A miss-shaped check for a structured-output parse failure (resilience.ts's runEvalLoop). */
export function schemaInvalidAssistAppealCheck(): AssistAppealCheck {
  return { outcome: "schema-invalid" };
}
