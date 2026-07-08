import type { ClaimFacts } from "./types.js";

// EXECUTE B5 — project a canonical claim (+ its lines + patient) into ClaimFacts.
//
// Two projections, one gate:
//  - claimToFactsReal:      reads REAL columns. A column that is null stays null in
//                           the facts, so the rule that reads it goes "unevaluable"
//                           (needs data, never a false pass — design-brief §8.3).
//  - claimToFactsSynthetic: the demo-only hash projection. It HARD-FAILS on a
//                           production-tagged claim so synthetic signals can never
//                           be mistaken for real ones once real PHI flows in.
//  - projectClaimFacts:     dispatches on claim.data_origin.
//
// The narrow Projection* interfaces are a structural subset of the canonical
// @taweed/shared rows (which drizzle's $inferSelect rows also satisfy), so the app
// passes DB rows straight in without an adapter, and unit tests build tiny literals.

export type DataOrigin = "synthetic" | "production";

export interface ProjectionClaim {
  id: string;
  payer_id: string;
  total_amount: string; // numeric(14,2) as string
  submitted_at: string | null;
  data_origin: DataOrigin;
  // EXECUTE real signals — null = genuinely unknown on this claim.
  preauth_present: boolean | null;
  eligibility_verified: boolean | null;
  is_duplicate: boolean | null;
  has_documentation: boolean | null;
}

export interface ProjectionLine {
  sbs_code: string | null;
  icd10am_code: string | null;
  qty: number;
}

export interface ProjectionPatient {
  birth_year: number | null;
  gender: string | null;
}

const GENDERS: ReadonlyArray<ClaimFacts["patientGender"]> = [
  "male",
  "female",
  "other",
  "unknown",
];

function normalizeGender(
  gender: string | null | undefined,
): ClaimFacts["patientGender"] {
  const g = (gender ?? "unknown") as ClaimFacts["patientGender"];
  return GENDERS.includes(g) ? g : "unknown";
}

function realCodes(lines: ProjectionLine[]): string[] {
  return lines.map((l) => l.sbs_code).filter((c): c is string => Boolean(c));
}

function lineUnitsOf(lines: ProjectionLine[]): Record<string, number> {
  const units: Record<string, number> = {};
  for (const l of lines)
    if (l.sbs_code) units[l.sbs_code] = (units[l.sbs_code] ?? 0) + l.qty;
  return units;
}

/**
 * REAL projection: canonical claim columns → ClaimFacts. Null columns pass
 * through as null so the engine marks the dependent rule "unevaluable".
 */
export function claimToFactsReal(
  claim: ProjectionClaim,
  lines: ProjectionLine[],
  patient: ProjectionPatient | undefined,
  currentYear: number,
): ClaimFacts {
  const age =
    patient && patient.birth_year != null
      ? currentYear - patient.birth_year
      : null;
  return {
    claimId: claim.id,
    payerId: claim.payer_id,
    hasPreAuth: claim.preauth_present,
    patientGender: normalizeGender(patient?.gender),
    patientAgeYears: age,
    serviceDate: claim.submitted_at ?? "",
    policyActive: claim.eligibility_verified,
    sbsCodes: Array.from(new Set(realCodes(lines))),
    lineUnits: lineUnitsOf(lines),
    totalAmount: Number(claim.total_amount),
    isDuplicate: claim.is_duplicate,
    // A diagnosis code on any line is a real, always-computable signal.
    hasDiagnosis: lines.some((l) => Boolean(l.icd10am_code)),
    hasDocumentation: claim.has_documentation,
  };
}

// Deterministic hash so the synthetic projection is stable across renders.
function hash(s: string): number {
  let x = 0;
  for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0;
  return x;
}

/**
 * DEMO-ONLY synthetic projection. The schema historically had no pre-auth /
 * eligibility / duplicate / documentation columns, so those signals were derived
 * from a stable per-claim hash purely to exercise the full rule set on synthetic
 * data. It HARD-FAILS on a production-tagged claim (EXECUTE B5 gate): synthetic
 * signals must never touch real PHI.
 */
export function claimToFactsSynthetic(
  claim: ProjectionClaim,
  lines: ProjectionLine[],
  patient: ProjectionPatient | undefined,
  currentYear: number,
): ClaimFacts {
  // Fail-closed: fabricate ONLY for an explicit 'synthetic' tag. Anything else
  // (production, unknown, or an unexpected value) is refused, so synthetic signals
  // can never reach real or untagged PHI (EXECUTE B5 gate).
  if (claim.data_origin !== "synthetic") {
    throw new Error(
      `refusing to run the synthetic hash projection on claim ${claim.id} tagged '${claim.data_origin}'; only explicit 'synthetic' is allowed (EXECUTE B5 gate)`,
    );
  }

  const seed = hash(claim.id);
  const bucket = seed % 10;
  // Map a subset of claims to placeholder edit scenarios so the scrubber shows
  // its full rule range on synthetic data.
  const injected: string[] = [];
  if (bucket === 0) injected.push("SBS-0003");
  else if (bucket === 1) injected.push("SBS-0004");
  else if (bucket === 2) injected.push("SBS-0007", "SBS-0008");
  else if (bucket === 3) injected.push("SBS-9999");

  const rawAge = patient?.birth_year ? currentYear - patient.birth_year : null;
  const ageUnknown = seed % 11 === 0; // ~9% -> unevaluable age rule
  const age = bucket === 1 ? 12 : ageUnknown ? null : rawAge;

  return {
    claimId: claim.id,
    payerId: claim.payer_id,
    hasPreAuth: seed % 4 !== 0,
    patientGender: normalizeGender(patient?.gender),
    patientAgeYears: age,
    serviceDate: claim.submitted_at ?? "",
    policyActive: seed % 12 !== 0,
    sbsCodes: Array.from(new Set([...realCodes(lines), ...injected])),
    lineUnits: lineUnitsOf(lines),
    totalAmount: Number(claim.total_amount),
    isDuplicate: seed % 9 === 0,
    hasDiagnosis: seed % 6 !== 0,
    hasDocumentation: seed % 5 !== 0,
  };
}

/**
 * Dispatch on data_origin: production claims use the real column projection,
 * synthetic claims use the demo hash projection. This is the single seam the app
 * calls so the guard cannot be bypassed.
 */
export function projectClaimFacts(
  claim: ProjectionClaim,
  lines: ProjectionLine[],
  patient: ProjectionPatient | undefined,
  currentYear: number,
): ClaimFacts {
  // Fail-closed: only an explicit 'synthetic' tag uses the fabricating projection;
  // production, untagged, and any unexpected value use the real column mapping
  // (null signals → unevaluable, never fabricated).
  return claim.data_origin === "synthetic"
    ? claimToFactsSynthetic(claim, lines, patient, currentYear)
    : claimToFactsReal(claim, lines, patient, currentYear);
}
