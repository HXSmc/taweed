import * as z from "zod/v4";
import { DENIAL_REASON_CODES } from "@taweed/shared";

// AI-4 output schema (plan 04 §9). The wire shape a model returns when
// extracting a payer EOB/remittance PDF into structured claim/line data. Same
// two hard constraints from structured outputs as scrubRuleDraft.ts (the
// template for this file — read it first):
//   1. STRICT objects everywhere — structured outputs require
//      additionalProperties:false on every object, and strictness is also how
//      we make sure the model can't smuggle an extra field past validation at
//      any nesting level (line / claim / top level all strictObject).
//   2. numeric constraints (.min/.max) are stripped from the wire schema by
//      the SDK client-side only (see scrubRuleDraft.ts comment) — so halalas
//      fields are plain z.number(), not z.number().int(). Money is carried as
//      INTEGER HALALAS on the wire so the model does exact integer arithmetic
//      (billed = paid + rejected + patientShare + adjustment) instead of lossy
//      decimal SAR strings. @taweed/shared/ClaimRow (and friends) store money
//      as SAR strings (Postgres numeric) — NOT halalas — so any caller
//      persisting this extraction MUST convert at the boundary via
//      @taweed/analytics's moneyToHalalas(value: string): number and
//      toSar(halalas: number): string. This schema does not perform that
//      conversion; it is purely the model's wire contract.
//
// payerName / payerNphiesId are plain nullable strings, NOT z.enum. Payers
// have no closed registry in this codebase (packages/ingest/src/dimensions.ts
// resolveDimension/resolveDimensions finds-or-creates a per-tenant payer row
// by normalized name) — constraining to an enum here would force the model to
// hallucinate membership in a set it can't see. denialCode, by contrast, IS
// enum-constrained: DENIAL_REASON_CODES (packages/shared/src/denial-codes.ts)
// is a closed, code-owned registry (same reasoning as scrubRuleDraft's
// fact/operator enums) — the model can only name a denial code the system
// actually recognizes, and downstream code can trust
// isDenialReasonCode/denialLabel against whatever it emits.
//
// confidence / overallConfidence are plain z.number() on the wire (again, no
// client-only .min/.max). Callers should treat [0, 1] as an expectation to
// enforce themselves, not a server-side guarantee.

const DENIAL_CODES = DENIAL_REASON_CODES.map((c) => c.code) as [
  (typeof DENIAL_REASON_CODES)[number]["code"],
  ...(typeof DENIAL_REASON_CODES)[number]["code"][],
];

const MAX_LINES_PER_CLAIM = 50;
const MAX_CLAIMS_PER_EXTRACTION = 20;

export const EobLineSchema = z.strictObject({
  claimLineRef: z.string(),
  sbsCode: z.string().nullable(),
  icd10amCode: z.string().nullable(),
  billedHalalas: z.number(),
  paidHalalas: z.number(),
  patientShareHalalas: z.number(),
  rejectedHalalas: z.number(),
  // Contractual write-off / withholding (Gap 2): money that is neither paid
  // to the provider, billed to the patient, nor formally rejected/denied —
  // e.g. a payer-contract adjustment. Without this 5th bucket, a real
  // remittance carrying a write-off can never cross-total (billed !=
  // paid+rejected+patientShare) and would be permanently stuck failing the
  // arithmetic gate even when every extracted value is accurate.
  adjustmentHalalas: z.number(),
  denialCode: z.enum(DENIAL_CODES).nullable(),
  confidence: z.number(),
});

export const EobClaimSchema = z.strictObject({
  claimId: z.string(),
  nphiesClaimId: z.string().nullable(),
  patientRef: z.string().nullable(),
  serviceDate: z.string().nullable(),
  lines: z.array(EobLineSchema).max(MAX_LINES_PER_CLAIM),
  totalBilledHalalas: z.number(),
  totalPaidHalalas: z.number(),
  totalRejectedHalalas: z.number(),
  totalAdjustmentHalalas: z.number(),
  confidence: z.number(),
});

export const EobExtractionSchema = z.strictObject({
  payerName: z.string().nullable(),
  payerNphiesId: z.string().nullable(),
  remittanceDate: z.string().nullable(),
  remittanceTotalPaidHalalas: z.number(),
  claims: z.array(EobClaimSchema).max(MAX_CLAIMS_PER_EXTRACTION),
  overallConfidence: z.number(),
});

export type EobLine = z.infer<typeof EobLineSchema>;
export type EobClaim = z.infer<typeof EobClaimSchema>;
export type EobExtraction = z.infer<typeof EobExtractionSchema>;
