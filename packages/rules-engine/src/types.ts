// Public contracts for the pre-submission scrubber (build-plan §3 rules-as-data,
// §7). HIGH-STAKES: every flag must trace to a named rule + the field that
// failed, so ScrubFlag carries ruleId/ruleName/field, never a bare message.

/** Facts derived from one claim + its lines, fed to the rules engine. */
export interface ClaimFacts {
  claimId: string;
  payerId: string;
  // null when the real claim carries no pre-auth signal at all (EXECUTE B5).
  // A rule that reads it then goes "unevaluable", never a silent pass.
  hasPreAuth: boolean | null;
  patientGender: "male" | "female" | "other" | "unknown";
  // null when age is genuinely unknown — a rule that needs it must go
  // "unevaluable", never silently pass (design-brief §8.3).
  patientAgeYears: number | null;
  serviceDate: string;
  // null when eligibility was never verified for this claim (EXECUTE B5).
  policyActive: boolean | null;
  sbsCodes: string[];
  // per-SBS billed units, e.g. { "SBS-0002": 6 }.
  lineUnits: Record<string, number>;
  totalAmount: number;
  // EXECUTE B5: real-column signals. null = the signal is genuinely absent on the
  // real claim, so any rule that reads it goes "unevaluable" (needs data, not a
  // false pass, design-brief §8.3). The synthetic projection always supplies a
  // boolean; the real projection passes null through when the column is null.
  isDuplicate: boolean | null;
  hasDiagnosis: boolean; // derived from claim lines (icd10am present) — always known
  hasDocumentation: boolean | null;
}

export type Severity = "info" | "warn" | "high";

/** A scrubber rule expressed as DATA (json-rules-engine condition tree, no eval). */
export interface ScrubRule {
  // Logical rule identity. Multiple rows may share an id across versions; the
  // highest version wins (EXECUTE B7 per-payer tuning).
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
  // EXECUTE B7 — scope bindings. A payer rule with payerId applies only to that
  // payer (null/undefined = any payer); a tenant rule likewise. Global rules
  // ignore both. These let rule SETS be authored + versioned per payer as data.
  payerId?: string | null;
  tenantId?: string | null;
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
