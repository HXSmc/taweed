import type { DenialReasonCode } from "./denial-codes.js";

// Canonical DB-ready row shapes (build-plan §7). Field names are snake_case to
// mirror the Postgres columns produced by @taweed/db. Money is carried as a
// string (Postgres `numeric`) to avoid float drift. Ids are UUID strings.
//
// One row per claim line; denials are exploded to one row per denied line ×
// reason (build-plan §3, §7).

export type ClaimStatus = "active" | "cancelled" | "draft" | "entered-in-error";
// Full FHIR R4 ClaimResponse.outcome value set — "queued" (interim, not yet
// adjudicated) must be representable so it is never silently coerced to a
// terminal state by downstream denial-rate math.
export type ClaimOutcome = "queued" | "complete" | "error" | "partial";

/** Root of tenant isolation. */
export interface TenantRow {
  id: string;
  name: string;
}

export interface BranchRow {
  id: string;
  tenant_id: string;
  name: string;
  city: string | null;
  license: string | null;
}

export interface ProviderRow {
  id: string;
  tenant_id: string;
  name: string;
  specialty: string | null;
  nphies_practitioner_id: string | null;
}

export interface PayerRow {
  id: string;
  tenant_id: string;
  name: string;
  nphies_payer_id: string | null;
  type: "insurer" | "tpa" | null;
}

/** PHI — minimized, encrypted + access-audited downstream. */
export interface PatientRow {
  id: string;
  tenant_id: string;
  pseudonym: string;
  birth_year: number | null;
  gender: "male" | "female" | "other" | "unknown" | null;
}

export interface ClaimRow {
  id: string;
  tenant_id: string;
  branch_id: string;
  provider_id: string;
  payer_id: string;
  patient_id: string;
  nphies_claim_id: string | null;
  status: ClaimStatus;
  submitted_at: string | null;
  total_amount: string;
  currency: string;
}

export interface ClaimLineRow {
  id: string;
  tenant_id: string;
  claim_id: string;
  line_number: number;
  sbs_code: string | null;
  icd10am_code: string | null;
  qty: number;
  unit_price: string;
  line_amount: string;
}

export interface ClaimResponseRow {
  id: string;
  tenant_id: string;
  claim_id: string;
  nphies_response_id: string | null;
  outcome: ClaimOutcome;
  adjudicated_amount: string | null;
  received_at: string | null;
}

/** Exploded analytics row: one per denied line × reason. */
export interface DenialRow {
  id: string;
  tenant_id: string;
  claim_line_id: string;
  reason_code: DenialReasonCode | string;
  reason_text: string | null;
  category: string | null;
  denied_amount: string;
}

/** Normalizer output — the canonical, DB-ready result of one claim + response. */
export interface NormalizedClaim {
  claim: ClaimRow;
  lines: ClaimLineRow[];
  response: ClaimResponseRow;
  denials: DenialRow[];
}
