import {
  newId,
  isDenialReasonCode,
  denialLabel,
  type ClaimLineRow,
  type ClaimOutcome,
  type ClaimResponseRow,
  type ClaimRow,
  type DenialRow,
  type NormalizedClaim,
} from "@taweed/shared";
import type { EobClaim, EobExtraction } from "@taweed/ai";

// AI-4 — approved-EOB → NormalizedClaim (plan 04 §9). Pure boundary converter: the
// ONLY place a reviewed EobExtraction (integer halalas, model-shaped) turns into
// the SAR-string rows @taweed/db's insertNormalizedClaim expects. Every halalas
// field is converted via the caller-supplied `toSar` at this single seam — see
// eobExtraction.ts's own top-of-file comment for why the wire schema carries
// integer halalas in the first place. This file does not touch a live DB
// connection; the caller inserts the returned rows inside its own `withTenant`.
//
// An EOB/remittance carries no branch/provider/patient — those dimensions are
// not resolvable from a payer's remittance the way `payerName` is (B6
// resolveDimension). The caller resolves/defaults them (mirrors the FHIR-bundle
// ingest path's precedent of defaulting to the tenant's seeded dimensions) and
// passes the resolved ids in `ctx`.

export interface EobIngestContext {
  tenantId: string;
  branchId: string;
  providerId: string;
  payerId: string;
  patientId: string;
}

function lineNumberFor(ref: string, index: number): number {
  const n = Number(ref);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : index + 1;
}

/** One EOB claim + its lines -> one NormalizedClaim (claim, lines, response, denials). */
function buildOneClaim(
  claim: EobClaim,
  ctx: EobIngestContext,
  toSar: (halalas: number) => string,
): NormalizedClaim {
  const claimId = newId();

  // DOCUMENTED NON-PERSISTENCE DECISION (code-review finding, Gap 2 follow-up):
  // claim.totalAdjustmentHalalas / line.adjustmentHalalas (the contractual
  // write-off bucket added so the arithmetic gate can pass for a remittance
  // that legitimately carries one) are READ nowhere below. This mirrors the
  // pre-existing treatment of patientShareHalalas, which @taweed/shared's
  // ClaimRow/ClaimResponseRow/DenialRow have never had a column for either —
  // this is not a new gap this pass introduces, it is the same gap the 5th
  // bucket now also falls into.
  //
  // Why not just write it to `denials`: a write-off is not a denial — it is
  // an agreed, non-appealable reduction, whereas every row inserted into
  // `denials` is treated as appealable by getAppealables (apps/web/lib/
  // appeals-data.ts joins ALL denial rows with no won appeal). Recording it
  // there would surface a contractual adjustment as something a provider
  // should appeal, which is a worse, actively wrong money-path bug — not a
  // fix.
  //
  // Why outcome stays 'complete' when totalAdjustmentHalalas > 0 and nothing
  // was rejected: a claim with an ordinary contractual adjustment (e.g.
  // billed 100 / paid 90 / adjustment 10) IS a completed adjudication in
  // FHIR ClaimResponse.outcome terms — reclassifying it as 'partial' would
  // conflate every normal partial-payment remittance with the denial-rate
  // math denialRateDim (lib/data.ts) computes from 'partial'/'error' rows,
  // which is a strictly worse regression than the gap being fixed here.
  //
  // TODO(ai-route): persisting the write-off total requires a schema
  // migration (a new nullable column, e.g. on claim_responses) plus an
  // analytics decision for how it should surface in getMoneyScope/
  // getAppealables — out of scope for this pass; tracked as a follow-up, not
  // silently dropped (see eob-to-normalized.test.ts's adjustment-bucket
  // coverage below, which pins today's behavior so a future persistence
  // change is a deliberate, reviewed diff).
  const claimRow: ClaimRow = {
    id: claimId,
    tenant_id: ctx.tenantId,
    branch_id: ctx.branchId,
    provider_id: ctx.providerId,
    payer_id: ctx.payerId,
    patient_id: ctx.patientId,
    // The EOB's own claimId is the payer's remittance-line reference, not
    // necessarily a NPHIES id; prefer the NPHIES id when the model extracted
    // one and fall back to the payer's claim reference so the row is never
    // left with no external identifier at all.
    nphies_claim_id: claim.nphiesClaimId ?? claim.claimId ?? null,
    status: "active",
    submitted_at: claim.serviceDate,
    total_amount: toSar(claim.totalBilledHalalas),
    currency: "SAR",
    // Human-reviewed AI-4 uploads are demo/synthetic in this pass, same posture
    // as the FHIR-bundle path (actions/ingest.ts). TODO(nphies-creds): real
    // partner ingest (BLK-1) tags 'production', which routes the scrubber to
    // the real-column projection and hard-blocks the synthetic one (EXECUTE B5)
    // — this is a known platform-wide placeholder, not an AI-4-specific choice.
    //
    // TODO(ai-route): an EOB carries no B5 signal columns (preauth, eligibility,
    // duplicate, documentation) — left null (unevaluable), never guessed.
    data_origin: "synthetic",
    preauth_present: null,
    eligibility_verified: null,
    is_duplicate: null,
    has_documentation: null,
  };

  const lines: ClaimLineRow[] = [];
  const denials: DenialRow[] = [];
  claim.lines.forEach((line, i) => {
    const lineId = newId();
    lines.push({
      id: lineId,
      tenant_id: ctx.tenantId,
      claim_id: claimId,
      line_number: lineNumberFor(line.claimLineRef, i),
      sbs_code: line.sbsCode,
      icd10am_code: line.icd10amCode,
      // The wire schema carries no quantity; a remittance line is one billed
      // amount, so qty is always 1 and unit_price === line_amount.
      qty: 1,
      unit_price: toSar(line.billedHalalas),
      line_amount: toSar(line.billedHalalas),
    });
    // Any rejected money must surface as a denials row — money-at-risk
    // analytics (getMoneyScope/denialRateDim/reasonPareto in lib/data.ts) and
    // the appeals pipeline (getAppealables in lib/appeals-data.ts) only see
    // rejected halalas that landed here. A missing or unrecognized
    // denialCode is a data-quality gap, not a reason to silently drop the
    // money — fall back to an explicit "unknown reason" marker so the line
    // stays visible instead of vanishing from both. Also still fires on a
    // valid denialCode with zero rejected money (pre-existing behavior) in
    // case a hand-edited payload names a reason without denied halalas.
    const knownCode =
      line.denialCode && isDenialReasonCode(line.denialCode) ? line.denialCode : null;
    if (line.rejectedHalalas > 0 || knownCode) {
      denials.push({
        id: newId(),
        tenant_id: ctx.tenantId,
        claim_line_id: lineId,
        reason_code: knownCode ?? line.denialCode ?? "UNKNOWN",
        reason_text: null,
        category: knownCode ? denialLabel(knownCode) : null,
        denied_amount: toSar(line.rejectedHalalas),
      });
    }
  });

  // Simplification (documented, not hidden): the wire schema has no adjudication
  // status field beyond the money totals, so outcome is derived from whether
  // anything was rejected. "error" (FHIR processing failure) is never inferred
  // from a remittance — only "complete" or "partial".
  const outcome: ClaimOutcome = claim.totalRejectedHalalas > 0 ? "partial" : "complete";

  const response: ClaimResponseRow = {
    id: newId(),
    tenant_id: ctx.tenantId,
    claim_id: claimId,
    nphies_response_id: null,
    outcome,
    adjudicated_amount: toSar(claim.totalPaidHalalas),
    received_at: null,
  };

  return { claim: claimRow, lines, response, denials };
}

/** Every claim in an approved EobExtraction -> one NormalizedClaim per claim. */
export function buildNormalizedClaimsFromEob(
  extraction: EobExtraction,
  ctx: EobIngestContext,
  toSar: (halalas: number) => string,
): NormalizedClaim[] {
  return extraction.claims.map((claim) => buildOneClaim(claim, ctx, toSar));
}
