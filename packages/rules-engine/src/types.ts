// Public contracts for the pre-submission scrubber (build-plan §3 rules-as-data,
// §7). HIGH-STAKES: every flag must trace to a named rule + the field that
// failed, so ScrubFlag carries ruleId/ruleName/field, never a bare message.

/** Facts derived from one claim + its lines, fed to the rules engine. */
export interface ClaimFacts {
  claimId: string;
  payerId: string;
  hasPreAuth: boolean;
  patientGender: "male" | "female" | "other" | "unknown";
  // null when age is genuinely unknown — a rule that needs it must go
  // "unevaluable", never silently pass (design-brief §8.3).
  patientAgeYears: number | null;
  serviceDate: string;
  policyActive: boolean;
  sbsCodes: string[];
  // per-SBS billed units, e.g. { "SBS-0002": 6 }.
  lineUnits: Record<string, number>;
  totalAmount: number;
  // Added facts the rules need — all present (boolean, never null) so the only
  // "unevaluable" trigger is patientAgeYears being null (needs-data, not false pass).
  isDuplicate: boolean;
  hasDiagnosis: boolean;
  hasDocumentation: boolean;
}

export type Severity = "info" | "warn" | "high";

/** A scrubber rule expressed as DATA (json-rules-engine condition tree, no eval). */
export interface ScrubRule {
  id: string;
  name: string;
  scope: "global" | "tenant" | "payer";
  version: number;
  severity: Severity;
  weight: number;
  field: string;
  message_en: string;
  message_ar: string;
  // json-rules-engine TopLevelCondition; kept `unknown` so rules stay pure data.
  conditions: unknown;
}

/** One raised flag — traces back to the rule id + name and the field that failed. */
export interface ScrubFlag {
  ruleId: string;
  ruleName: string;
  field: string;
  severity: Severity;
  message_en: string;
  message_ar: string;
}

export interface ScrubResult {
  claimId: string;
  riskScore: number; // 0..100
  flags: ScrubFlag[];
  // rule ids whose required fact was absent (null/undefined) — evaluated to
  // "needs data", NOT a false pass.
  unevaluable: string[];
}
