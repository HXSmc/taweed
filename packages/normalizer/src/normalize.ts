import type { Claim, ClaimResponse } from "@medplum/fhirtypes";
import type { ClaimPair } from "@taweed/fhir";
import {
  newId,
  type ClaimLineRow,
  type ClaimResponseRow,
  type ClaimRow,
  type ClaimStatus,
  type DataOrigin,
  type DenialRow,
  type NormalizedClaim,
} from "@taweed/shared";

export interface NormalizeContext {
  tenantId: string;
  branchId: string;
  providerId: string;
  payerId: string;
  patientId: string;
  // EXECUTE B5: 'production' locks out the synthetic scrubber projection downstream.
  dataOrigin: DataOrigin;
}

/**
 * Pre-authorization signal (EXECUTE B5). A preAuthRef on any insurance line means
 * a pre-auth exists; insurance present with none means it does not; NO insurance
 * array at all means the source carries no signal → null → rule goes unevaluable.
 */
function preauthPresent(claim: Claim): boolean | null {
  if (!claim.insurance || claim.insurance.length === 0) return null;
  return claim.insurance.some((ins) => (ins.preAuthRef?.length ?? 0) > 0);
}

/** Supporting-documentation signal (EXECUTE B5): supportingInfo present → boolean, absent → null. */
function hasDocumentation(claim: Claim): boolean | null {
  if (claim.supportingInfo === undefined) return null;
  return claim.supportingInfo.length > 0;
}

const DEFAULT_CURRENCY = "SAR";

function moneyStr(value: number | undefined): string {
  return (value ?? 0).toFixed(2);
}

function moneyStrOrNull(value: number | undefined): string | null {
  return value === undefined ? null : value.toFixed(2);
}

function toClaimStatus(status: Claim["status"]): ClaimStatus {
  // Claim.status is 1..1 in R4; fall back defensively.
  return (status ?? "active") as ClaimStatus;
}

/**
 * Map a parsed `{ claim, claimResponse }` pair into canonical DB-ready rows:
 * one ClaimLineRow per Claim.item, and DenialRow exploded to one row per
 * denied line × reason (build-plan §3, §7). Dimension ids come from `ctx`
 * (resolved/seeded upstream); NPHIES ids are retained on the rows.
 */
export function normalize(
  pair: ClaimPair,
  ctx: NormalizeContext,
): NormalizedClaim {
  const { claim, claimResponse } = pair;

  const claimRow: ClaimRow = {
    id: newId(),
    tenant_id: ctx.tenantId,
    branch_id: ctx.branchId,
    provider_id: ctx.providerId,
    payer_id: ctx.payerId,
    patient_id: ctx.patientId,
    nphies_claim_id: claim.id ?? null,
    status: toClaimStatus(claim.status),
    submitted_at: claim.created ?? null,
    total_amount: moneyStr(claim.total?.value),
    currency: claim.total?.currency ?? DEFAULT_CURRENCY,
    data_origin: ctx.dataOrigin,
    preauth_present: preauthPresent(claim),
    // Eligibility outcome is a CoverageEligibilityResponse, not on the Claim, and
    // duplicate detection is cross-claim — both resolved at ingest, null here.
    eligibility_verified: null,
    is_duplicate: null,
    has_documentation: hasDocumentation(claim),
  };

  // line_number → row, so denials can resolve their line by itemSequence.
  const lineByNumber = new Map<number, ClaimLineRow>();
  const lines: ClaimLineRow[] = [];
  (claim.item ?? []).forEach((item, index) => {
    const lineNumber = item.sequence ?? index + 1;
    const line: ClaimLineRow = {
      id: newId(),
      tenant_id: ctx.tenantId,
      claim_id: claimRow.id,
      line_number: lineNumber,
      sbs_code: item.productOrService?.coding?.[0]?.code ?? null,
      icd10am_code: null,
      qty: item.quantity?.value ?? 1,
      unit_price: moneyStr(item.unitPrice?.value),
      line_amount: moneyStr(item.net?.value),
    };
    lines.push(line);
    lineByNumber.set(lineNumber, line);
  });

  const response: ClaimResponseRow = {
    id: newId(),
    tenant_id: ctx.tenantId,
    claim_id: claimRow.id,
    nphies_response_id: claimResponse.id ?? null,
    outcome: (claimResponse.outcome ?? "complete") as ClaimResponseRow["outcome"],
    adjudicated_amount: moneyStrOrNull(adjudicatedTotal(claimResponse)),
    received_at: claimResponse.created ?? null,
  };

  const denials = explodeDenials(claimResponse, ctx.tenantId, lineByNumber);

  return { claim: claimRow, lines, response, denials };
}

/** Sum of accepted ("benefit") adjudication amounts; undefined if none. */
function adjudicatedTotal(response: ClaimResponse): number | undefined {
  let total: number | undefined;
  for (const item of response.item ?? []) {
    for (const adj of item.adjudication ?? []) {
      const isBenefit = adj.category?.coding?.some((c) => c.code === "benefit");
      if (isBenefit && adj.amount?.value !== undefined) {
        total = (total ?? 0) + adj.amount.value;
      }
    }
  }
  return total;
}

/** One DenialRow per (denied line × reason). Adjudication with a `reason` = denial. */
function explodeDenials(
  response: ClaimResponse,
  tenantId: string,
  lineByNumber: Map<number, ClaimLineRow>,
): DenialRow[] {
  const denials: DenialRow[] = [];
  for (const item of response.item ?? []) {
    for (const adj of item.adjudication ?? []) {
      const reasonCoding = adj.reason?.coding?.[0];
      if (!reasonCoding) continue;

      const line =
        item.itemSequence !== undefined
          ? lineByNumber.get(item.itemSequence)
          : undefined;
      if (!line) {
        throw new Error(
          `denial references claim line ${String(item.itemSequence)} which is not present on the claim`,
        );
      }

      denials.push({
        id: newId(),
        tenant_id: tenantId,
        claim_line_id: line.id,
        reason_code: reasonCoding.code ?? "UNKNOWN",
        reason_text: reasonCoding.display ?? null,
        category: adj.category?.coding?.[0]?.code ?? null,
        denied_amount: moneyStr(adj.amount?.value),
      });
    }
  }
  return denials;
}
