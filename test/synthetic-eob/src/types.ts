import type { DenialReasonCode } from "@taweed/shared";

// Local mirror of packages/ai/src/schemas/eobExtraction.ts's EobExtractionSchema
// (AI-4 vision extraction, landed by a parallel task partway through this
// package's development — reconciled against it, see below). This package
// still declares its OWN type rather than importing the real schema/type at
// runtime: @taweed/synthetic-eob must stay a pure fixture generator with no
// runtime dependency on @taweed/ai (only a devDependency, used solely by the
// test-time safeParse cross-check in test/generate.test.ts).
//
// Reconciled 2026-07-08 against the real EobExtractionSchema: field names
// below are IDENTICAL to the wire schema, with two differences worth noting
// for any future re-reconciliation:
//   - The real schema makes payerName/payerNphiesId/remittanceDate and several
//     claim-level string fields `.nullable()` (model may fail to read a
//     field). This generator always emits non-null strings, which still
//     satisfies `.nullable()` — no gap.
//   - EobClaim here carries totalBilledHalalas/totalPaidHalalas/
//     totalRejectedHalalas (required by EobClaimSchema) — added after
//     the schema landed; see generate.ts buildClaim for how they're derived
//     from the claim's own lines.
//
// Re-reconciled for Gap 2 (5th "adjustment/withholding" money bucket): every
// EobClaimLine now carries adjustmentHalalas and every EobClaim carries
// totalAdjustmentHalalas, mirroring EobLineSchema/EobClaimSchema's own
// adjustmentHalalas/totalAdjustmentHalalas fields exactly.
//
// Money: all amounts are integer halalas (1/100 SAR), per the brief's
// correction that EOB wire-schema fields use integer halalas internally for
// exact model arithmetic — NOT the SAR-string convention @taweed/shared uses
// on ClaimRow/ClaimLineRow. This package never touches ClaimRow/ClaimLineRow,
// so no @taweed/analytics halalas<->SAR conversion is needed here.
export interface EobClaimLine {
  claimLineRef: string;
  sbsCode: string;
  icd10amCode: string;
  billedHalalas: number;
  paidHalalas: number;
  patientShareHalalas: number;
  rejectedHalalas: number;
  /** Gap 2 — contractual write-off/withholding: money neither paid, patient-
   *  owed, nor formally rejected/denied. 0 on every line that carries none. */
  adjustmentHalalas: number;
  /** Null when the line was not denied. */
  denialCode: DenialReasonCode | null;
  /** Model's per-line extraction confidence, 0..1. */
  confidence: number;
}

export interface EobClaim {
  claimId: string;
  nphiesClaimId: string;
  patientRef: string;
  serviceDate: string;
  lines: EobClaimLine[];
  totalBilledHalalas: number;
  totalPaidHalalas: number;
  totalRejectedHalalas: number;
  /** Sum of this claim's lines' adjustmentHalalas — see EobClaimLine. */
  totalAdjustmentHalalas: number;
  /** Model's per-claim extraction confidence, 0..1. */
  confidence: number;
}

export interface EobExtraction {
  /** Plain string — payers have no closed enum (dynamic per-tenant dimension). */
  payerName: string;
  payerNphiesId: string;
  remittanceDate: string;
  remittanceTotalPaidHalalas: number;
  claims: EobClaim[];
  /** Model's overall document extraction confidence, 0..1. */
  overallConfidence: number;
}
