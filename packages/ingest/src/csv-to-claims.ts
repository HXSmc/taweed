import {
  newId,
  type ClaimLineRow,
  type ClaimResponseRow,
  type ClaimRow,
  type DataOrigin,
  type DenialRow,
  type NormalizedClaim,
} from "@taweed/shared";
import type { FieldMapping } from "./mapping.js";

// EXECUTE B6 — CSV row -> canonical NormalizedClaim, pure (no DB access; the
// caller inserts via @taweed/db's insertNormalizedClaim). Mirrors
// apps/web/lib/actions/ingest.ts's requiredAmountIssue + per-claim quarantine
// pattern: quarantine, never silently drop or corrupt a claim.
//
// Deliberate scope cut: one CSV row = one claim = one claim line. No
// multi-row claim grouping in this pass (that needs a claim-id grouping key
// plus a line-aggregation policy) — a real requirement for a later pass, not
// a TODO threatening a rewrite of this one.

export interface QuarantineItem {
  ref: string;
  reason: string;
}

/** Same shape apps/web/lib/actions/ingest.ts already builds from its
 *  withSession dimension lookup — every CSV-derived claim maps onto the
 *  tenant's existing first branch/provider/payer/patient (no per-row
 *  dimension creation in this pass, mirroring ingestBundle's own simplification). */
export interface CsvToClaimsContext {
  tenantId: string;
  branchId: string;
  providerId: string;
  payerId: string;
  patientId: string;
  dataOrigin: DataOrigin;
}

export interface CsvToClaimsResult {
  claims: NormalizedClaim[];
  quarantined: QuarantineItem[];
}

const DEFAULT_CURRENCY = "SAR";

/** Read a mapped column's value for a row, or null if unmapped/absent. */
function mappedValue(
  row: Record<string, string>,
  mapping: FieldMapping,
  field: keyof FieldMapping,
): string | null {
  const column = mapping[field];
  if (column === null) return null;
  const value = row[column];
  return value === undefined ? null : value;
}

/** Non-empty (post-trim) mapped value, or null. */
function nonEmpty(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

// Strict money literal: optional sign, digits, optional decimal point + UP TO
// TWO digits (SAR/halala precision — there is no smaller SAR denomination, so
// a third decimal digit is not a valid amount, not a rounding nicety). No
// thousands separators, no locale decimal-comma, no hex/scientific notation.
// A comma is genuinely ambiguous ("1,234.56" US thousands vs "500,00"
// European/Arabic decimal) — guessing either way risks a silent 100x-off amount,
// so anything containing a comma (or any other non-numeric character) is
// rejected and the row is quarantined rather than "smart-parsed". Capping
// decimals at 2 also closes a float-precision footgun: JS float64 cannot
// represent 1.005 exactly (it's ~1.00499999999999989...), so
// `(1.005).toFixed(2)` silently rounds DOWN to "1.00" instead of up to "1.01"
// — a 3-decimal input would have produced a wrong stored amount instead of
// quarantining.
const MONEY_RE = /^[+-]?\d+(\.\d{1,2})?$/;

// A claim total above this is far outside any plausible single-claim amount
// and is far more likely a data error (extra zeros, wrong unit, a hostile
// input) than a real remittance line. It's also below the ~1e21 threshold
// where `Number.prototype.toFixed` switches to exponential notation
// ("1e+21") — a value that would not even be a valid decimal literal to
// store in a money column. No existing precedent constant in this repo to
// match; documented here as this module's own bound.
const MAX_MONEY_VALUE = 999_999_999.99;

/**
 * Parse a money-ish string: require a plain sign/digits/(up to 2)decimal-point
 * literal, then require a finite, non-negative number within
 * MAX_MONEY_VALUE. Returns null for anything that does not satisfy that —
 * including "" (Number("") is 0, which would otherwise slip a missing
 * required amount past this check).
 */
function parseMoney(raw: string | null): number | null {
  const trimmed = nonEmpty(raw);
  if (trimmed === null) return null;
  if (!MONEY_RE.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0 || n > MAX_MONEY_VALUE) return null;
  return n;
}

function resolveRef(
  row: Record<string, string>,
  mapping: FieldMapping,
  rowIndex: number,
): string {
  const claimIdValue = nonEmpty(mappedValue(row, mapping, "claimId"));
  return claimIdValue ?? `row-${rowIndex + 1}`;
}

interface DenialCheck {
  ok: boolean;
  reason: string | null;
  deniedAmount: number | null;
}

/** Validate the deniedAmount/reasonCode pair (design-brief: never silently
 *  drop or silently accept an ambiguous denial signal). */
function checkDenialPair(
  reasonCodeRaw: string | null,
  deniedAmountRaw: string | null,
  totalAmount: number,
): DenialCheck {
  const reasonCode = nonEmpty(reasonCodeRaw);
  const deniedAmount = parseMoney(deniedAmountRaw);
  const deniedAmountPresent = nonEmpty(deniedAmountRaw) !== null;

  if (reasonCode !== null) {
    if (deniedAmount === null) {
      return {
        ok: false,
        reason: "denial reason present but denied amount is missing/invalid",
        deniedAmount: null,
      };
    }
    if (deniedAmount === 0) {
      return {
        ok: false,
        reason: "denied amount is 0 with a denial reason present",
        deniedAmount: null,
      };
    }
    if (deniedAmount > totalAmount) {
      return { ok: false, reason: "denied amount exceeds total amount", deniedAmount: null };
    }
    return { ok: true, reason: null, deniedAmount };
  }

  if (deniedAmountPresent) {
    return {
      ok: false,
      reason: "denied amount present without a denial reason",
      deniedAmount: null,
    };
  }

  return { ok: true, reason: null, deniedAmount: null };
}

/**
 * Convert parsed + mapped CSV rows into canonical NormalizedClaims. Bad rows
 * are quarantined with a human reason; good rows are returned ready for
 * insertNormalizedClaim.
 */
export function csvRowsToClaims(
  rows: Record<string, string>[],
  mapping: FieldMapping,
  ctx: CsvToClaimsContext,
): CsvToClaimsResult {
  const claims: NormalizedClaim[] = [];
  const quarantined: QuarantineItem[] = [];

  rows.forEach((row, rowIndex) => {
    const ref = resolveRef(row, mapping, rowIndex);

    const totalAmount = parseMoney(mappedValue(row, mapping, "totalAmount"));
    if (totalAmount === null) {
      quarantined.push({ ref, reason: "total amount is missing or not a valid number" });
      return;
    }

    const denialCheck = checkDenialPair(
      mappedValue(row, mapping, "reasonCode"),
      mappedValue(row, mapping, "deniedAmount"),
      totalAmount,
    );
    if (!denialCheck.ok) {
      quarantined.push({ ref, reason: denialCheck.reason! });
      return;
    }

    const claimId = newId();
    const lineId = newId();
    const totalStr = totalAmount.toFixed(2);

    const claim: ClaimRow = {
      id: claimId,
      tenant_id: ctx.tenantId,
      branch_id: ctx.branchId,
      provider_id: ctx.providerId,
      payer_id: ctx.payerId,
      patient_id: ctx.patientId,
      nphies_claim_id: nonEmpty(mappedValue(row, mapping, "nphiesClaimId")),
      status: "active",
      submitted_at: nonEmpty(mappedValue(row, mapping, "serviceDate")),
      total_amount: totalStr,
      currency: DEFAULT_CURRENCY,
      data_origin: ctx.dataOrigin,
      // CSV carries no signal for these EXECUTE-B5 scrubber columns -> null
      // (unevaluable), never a fabricated boolean here. KNOWN LIMITATION:
      // this null only reaches the scrubber unfabricated once the claim's
      // data_origin is 'production' (real ingest, BLK-1) and
      // projectClaimFacts routes it through claimToFactsReal. Every CSV
      // upload in this pass is tagged 'synthetic' by the caller
      // (commitCsvMapping, apps/web/lib/actions/ingest-csv.ts), so today it
      // is instead routed through claimToFactsSynthetic, which ignores these
      // null columns and fabricates them from a hash of the claim id
      // (packages/rules-engine/src/project.ts) — a risk shared byte-for-byte
      // with ingestBundle, not new to this file.
      preauth_present: null,
      eligibility_verified: null,
      is_duplicate: null,
      has_documentation: null,
    };

    const line: ClaimLineRow = {
      id: lineId,
      tenant_id: ctx.tenantId,
      claim_id: claimId,
      line_number: 1,
      sbs_code: nonEmpty(mappedValue(row, mapping, "sbsCode")),
      icd10am_code: nonEmpty(mappedValue(row, mapping, "icd10amCode")),
      qty: 1,
      unit_price: totalStr,
      line_amount: totalStr,
    };

    const denials: DenialRow[] = [];
    if (denialCheck.deniedAmount !== null) {
      denials.push({
        id: newId(),
        tenant_id: ctx.tenantId,
        claim_line_id: lineId,
        reason_code: nonEmpty(mappedValue(row, mapping, "reasonCode"))!,
        reason_text: nonEmpty(mappedValue(row, mapping, "reasonText")),
        category: null,
        denied_amount: denialCheck.deniedAmount.toFixed(2),
      });
    }

    // FHIR ClaimResponse.outcome: no denial -> "complete"; denied amount equal
    // to the total -> "error" (fully rejected, not partially adjudicated);
    // any lesser denied amount -> "partial".
    const outcome: ClaimResponseRow["outcome"] =
      denialCheck.deniedAmount === null
        ? "complete"
        : denialCheck.deniedAmount === totalAmount
          ? "error"
          : "partial";

    const response: ClaimResponseRow = {
      id: newId(),
      tenant_id: ctx.tenantId,
      claim_id: claimId,
      nphies_response_id: null,
      outcome,
      adjudicated_amount: (totalAmount - (denialCheck.deniedAmount ?? 0)).toFixed(2),
      received_at: null,
    };

    claims.push({ claim, lines: [line], response, denials });
  });

  return { claims, quarantined };
}
