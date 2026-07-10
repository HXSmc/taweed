import { describe, it, expect } from "vitest";
import type { FieldMapping } from "@taweed/ingest";
import { csvRowsToClaims, type CsvToClaimsContext } from "@taweed/ingest";

// EXECUTE B6 — CSV row -> canonical NormalizedClaim, pure (no DB). Mirrors
// apps/web/lib/actions/ingest.ts's requiredAmountIssue + per-claim quarantine
// pattern: quarantine, never silently drop or corrupt a claim.
//
// Deliberate scope cut for this pass: one CSV row = one claim = one claim
// line. No multi-row claim grouping (that would need a claim-id column to
// group on, plus a line-aggregation policy) — out of scope here.

const CTX: CsvToClaimsContext = {
  tenantId: "tenant-1",
  branchId: "branch-1",
  providerId: "provider-1",
  payerId: "payer-1",
  patientId: "patient-1",
  dataOrigin: "synthetic",
};

function mapping(overrides: Partial<FieldMapping> = {}): FieldMapping {
  const base: FieldMapping = {
    claimId: "Claim ID",
    nphiesClaimId: "NPHIES ID",
    payerName: null,
    branchName: null,
    providerName: null,
    patientRef: null,
    sbsCode: "SBS Code",
    icd10amCode: "ICD10AM Code",
    serviceDate: "Service Date",
    totalAmount: "Total Amount",
    deniedAmount: "Denied Amount",
    reasonCode: "Reason Code",
    reasonText: "Reason Text",
  };
  return { ...base, ...overrides };
}

function row(fields: Record<string, string>): Record<string, string> {
  return {
    "Claim ID": "",
    "NPHIES ID": "",
    "SBS Code": "",
    "ICD10AM Code": "",
    "Service Date": "",
    "Total Amount": "",
    "Denied Amount": "",
    "Reason Code": "",
    "Reason Text": "",
    ...fields,
  };
}

describe("csvRowsToClaims — happy path", () => {
  it("builds one claim + one line + a complete response for a clean row with no denial", () => {
    const rows = [
      row({
        "Claim ID": "CLM-1",
        "NPHIES ID": "NPH-1",
        "SBS Code": "SBS-99",
        "ICD10AM Code": "A00.1",
        "Service Date": "2026-01-05",
        "Total Amount": "1234.56",
      }),
    ];

    const { claims, quarantined } = csvRowsToClaims(rows, mapping(), CTX);

    expect(quarantined).toEqual([]);
    expect(claims).toHaveLength(1);
    const c = claims[0]!;

    expect(c.claim.tenant_id).toBe(CTX.tenantId);
    expect(c.claim.branch_id).toBe(CTX.branchId);
    expect(c.claim.provider_id).toBe(CTX.providerId);
    expect(c.claim.payer_id).toBe(CTX.payerId);
    expect(c.claim.patient_id).toBe(CTX.patientId);
    expect(c.claim.nphies_claim_id).toBe("NPH-1");
    expect(c.claim.status).toBe("active");
    expect(c.claim.submitted_at).toBe("2026-01-05");
    expect(c.claim.total_amount).toBe("1234.56");
    expect(c.claim.currency).toBe("SAR");
    expect(c.claim.data_origin).toBe("synthetic");
    // EXECUTE B5 scrubber columns: CSV carries no signal -> null (unevaluable),
    // never a fabricated boolean.
    expect(c.claim.preauth_present).toBeNull();
    expect(c.claim.eligibility_verified).toBeNull();
    expect(c.claim.is_duplicate).toBeNull();
    expect(c.claim.has_documentation).toBeNull();

    expect(c.lines).toHaveLength(1);
    const line = c.lines[0]!;
    expect(line.claim_id).toBe(c.claim.id);
    expect(line.line_number).toBe(1);
    expect(line.sbs_code).toBe("SBS-99");
    expect(line.icd10am_code).toBe("A00.1");
    expect(line.qty).toBe(1);
    expect(line.unit_price).toBe("1234.56");
    expect(line.line_amount).toBe("1234.56");

    expect(c.response.claim_id).toBe(c.claim.id);
    expect(c.response.outcome).toBe("complete");
    expect(c.response.adjudicated_amount).toBe("1234.56");
    expect(c.response.received_at).toBeNull();
    expect(c.response.nphies_response_id).toBeNull();

    expect(c.denials).toEqual([]);
  });

  it("carries a valid denial pair into a DenialRow and a partial response outcome", () => {
    const rows = [
      row({
        "Claim ID": "CLM-2",
        "Total Amount": "500.00",
        "Denied Amount": "120.00",
        "Reason Code": "CO-45",
        "Reason Text": "Charge exceeds fee schedule",
      }),
    ];

    const { claims, quarantined } = csvRowsToClaims(rows, mapping(), CTX);

    expect(quarantined).toEqual([]);
    expect(claims).toHaveLength(1);
    const c = claims[0]!;

    expect(c.response.outcome).toBe("partial");
    expect(c.response.adjudicated_amount).toBe("380.00");

    expect(c.denials).toHaveLength(1);
    const d = c.denials[0]!;
    expect(d.claim_line_id).toBe(c.lines[0]!.id);
    expect(d.reason_code).toBe("CO-45");
    expect(d.reason_text).toBe("Charge exceeds fee schedule");
    expect(d.category).toBeNull();
    expect(d.denied_amount).toBe("120.00");
  });

  it("leaves nphiesClaimId and serviceDate null when their columns are unmapped", () => {
    const rows = [row({ "Claim ID": "CLM-3", "Total Amount": "10" })];
    const m = mapping({ nphiesClaimId: null, serviceDate: null });

    const { claims } = csvRowsToClaims(rows, m, CTX);

    expect(claims[0]!.claim.nphies_claim_id).toBeNull();
    expect(claims[0]!.claim.submitted_at).toBeNull();
  });
});

describe("csvRowsToClaims — quarantine ref resolution", () => {
  it("uses the mapped claimId column value as the quarantine ref when present", () => {
    const rows = [row({ "Claim ID": "CLM-BAD", "Total Amount": "" })];
    const { quarantined } = csvRowsToClaims(rows, mapping(), CTX);
    expect(quarantined).toEqual([
      { ref: "CLM-BAD", reason: "total amount is missing or not a valid number" },
    ]);
  });

  it("falls back to a positional ref when the claimId column is missing or empty", () => {
    const rows = [
      row({ "Claim ID": "", "Total Amount": "" }),
      row({ "Claim ID": "   ", "Total Amount": "" }),
    ];
    const { quarantined } = csvRowsToClaims(rows, mapping(), CTX);
    expect(quarantined.map((q) => q.ref)).toEqual(["row-1", "row-2"]);
  });
});

describe("csvRowsToClaims — required totalAmount", () => {
  it.each([
    ["empty string", ""],
    ["whitespace only", "   "],
    ["not a number", "abc"],
    ["negative", "-5.00"],
    ["NaN-producing garbage", "12.34.56"],
  ])("quarantines when totalAmount is %s", (_label, value) => {
    const rows = [row({ "Claim ID": "CLM-X", "Total Amount": value })];
    const { claims, quarantined } = csvRowsToClaims(rows, mapping(), CTX);
    expect(claims).toEqual([]);
    expect(quarantined).toEqual([
      { ref: "CLM-X", reason: "total amount is missing or not a valid number" },
    ]);
  });

  it("strips surrounding whitespace before parsing", () => {
    const rows = [row({ "Claim ID": "CLM-Y", "Total Amount": "  2500.00  " })];
    const { claims, quarantined } = csvRowsToClaims(rows, mapping(), CTX);
    expect(quarantined).toEqual([]);
    expect(claims[0]!.claim.total_amount).toBe("2500.00");
  });

  // Regression: a comma is genuinely ambiguous (US thousands separator vs
  // European/Arabic decimal separator, e.g. "500,00" meaning 500.00). Rather
  // than guess and risk a silent ~100x-off amount, any comma-containing value
  // is rejected and the row quarantined. Number()-specific footguns (hex,
  // scientific notation) are rejected the same way.
  it.each([
    ["US-style thousands separator", "2,500.00"],
    ["European/Arabic decimal-comma (would silently 100x-inflate if stripped)", "500,00"],
    ["hex literal", "0x10"],
    ["scientific notation", "1e5"],
  ])("quarantines totalAmount %s: %s", (_label, value) => {
    const rows = [row({ "Claim ID": "CLM-Z", "Total Amount": value })];
    const { claims, quarantined } = csvRowsToClaims(rows, mapping(), CTX);
    expect(claims).toEqual([]);
    expect(quarantined).toEqual([
      { ref: "CLM-Z", reason: "total amount is missing or not a valid number" },
    ]);
  });
});

describe("csvRowsToClaims — deniedAmount / reasonCode pairing", () => {
  it("quarantines when reasonCode is present but deniedAmount is missing", () => {
    const rows = [
      row({ "Claim ID": "CLM-A", "Total Amount": "100", "Reason Code": "CO-1" }),
    ];
    const { claims, quarantined } = csvRowsToClaims(rows, mapping(), CTX);
    expect(claims).toEqual([]);
    expect(quarantined).toEqual([
      {
        ref: "CLM-A",
        reason: "denial reason present but denied amount is missing/invalid",
      },
    ]);
  });

  it("quarantines when reasonCode is present but deniedAmount is not a valid number", () => {
    const rows = [
      row({
        "Claim ID": "CLM-B",
        "Total Amount": "100",
        "Reason Code": "CO-1",
        "Denied Amount": "not-a-number",
      }),
    ];
    const { quarantined } = csvRowsToClaims(rows, mapping(), CTX);
    expect(quarantined).toEqual([
      {
        ref: "CLM-B",
        reason: "denial reason present but denied amount is missing/invalid",
      },
    ]);
  });

  it("quarantines when deniedAmount exceeds totalAmount", () => {
    const rows = [
      row({
        "Claim ID": "CLM-C",
        "Total Amount": "100",
        "Reason Code": "CO-1",
        "Denied Amount": "150",
      }),
    ];
    const { quarantined } = csvRowsToClaims(rows, mapping(), CTX);
    expect(quarantined).toEqual([
      { ref: "CLM-C", reason: "denied amount exceeds total amount" },
    ]);
  });

  it("quarantines when deniedAmount is present but reasonCode is empty (never silently drop the signal)", () => {
    const rows = [
      row({ "Claim ID": "CLM-D", "Total Amount": "100", "Denied Amount": "20" }),
    ];
    const { claims, quarantined } = csvRowsToClaims(rows, mapping(), CTX);
    expect(claims).toEqual([]);
    expect(quarantined).toEqual([
      { ref: "CLM-D", reason: "denied amount present without a denial reason" },
    ]);
  });

  it("accepts deniedAmount exactly equal to totalAmount, labeled outcome 'error' (fully denied, not partial)", () => {
    const rows = [
      row({
        "Claim ID": "CLM-E",
        "Total Amount": "100",
        "Reason Code": "CO-1",
        "Denied Amount": "100",
      }),
    ];
    const { claims, quarantined } = csvRowsToClaims(rows, mapping(), CTX);
    expect(quarantined).toEqual([]);
    expect(claims[0]!.response.adjudicated_amount).toBe("0.00");
    expect(claims[0]!.response.outcome).toBe("error");
  });

  // Regression: a reasonCode with deniedAmount that parses to exactly 0 must
  // quarantine, not silently produce a 0.00 denial row that inflates
  // denied-claim counts with no corresponding at-risk SAR.
  it("quarantines when reasonCode is present but deniedAmount is exactly 0", () => {
    const rows = [
      row({
        "Claim ID": "CLM-F",
        "Total Amount": "100",
        "Reason Code": "CO-1",
        "Denied Amount": "0",
      }),
    ];
    const { claims, quarantined } = csvRowsToClaims(rows, mapping(), CTX);
    expect(claims).toEqual([]);
    expect(quarantined).toEqual([
      { ref: "CLM-F", reason: "denied amount is 0 with a denial reason present" },
    ]);
  });
});

// Extra adversarial pass on the money-path specifically (parseMoney + the
// toFixed(2) formatting it feeds): money-path defects get more scrutiny than
// an average finding, per this repo's own instinct policy. These are edge
// cases a normal review pass would miss because MONEY_RE / parseMoney LOOK
// correct in isolation but hide float and magnitude footguns once fed through
// JS's binary-float Number type.
describe("csvRowsToClaims — money precision & magnitude guards", () => {
  // Real, demonstrable defect: JS float64 cannot represent 1.005 exactly (it's
  // stored as ~1.00499999999999989...), so (1.005).toFixed(2) === "1.00", NOT
  // "1.01" — a silent one-halala-down rounding error. Before this guard,
  // MONEY_RE's `\.\d+` accepted any number of decimal digits, so a CSV cell
  // with 3+ decimals (which isn't even valid SAR/halala precision — SAR has
  // exactly 2 decimal places) would silently mis-round instead of quarantine.
  it.each([
    ["3 decimal places (binary-float rounds 1.005 down to 1.00, not up to 1.01)", "1.005"],
    ["3 decimal places on a larger amount", "2500.999"],
    ["many decimal places", "10.123456789"],
  ])("quarantines totalAmount with more precision than SAR supports: %s (%s)", (_label, value) => {
    const rows = [row({ "Claim ID": "CLM-PRECISION", "Total Amount": value })];
    const { claims, quarantined } = csvRowsToClaims(rows, mapping(), CTX);
    expect(claims).toEqual([]);
    expect(quarantined).toEqual([
      { ref: "CLM-PRECISION", reason: "total amount is missing or not a valid number" },
    ]);
  });

  it("quarantines a deniedAmount with more precision than SAR supports, via the reasonCode pair check", () => {
    const rows = [
      row({
        "Claim ID": "CLM-PRECISION-DENIED",
        "Total Amount": "100.00",
        "Reason Code": "CO-1",
        "Denied Amount": "10.005",
      }),
    ];
    const { claims, quarantined } = csvRowsToClaims(rows, mapping(), CTX);
    expect(claims).toEqual([]);
    expect(quarantined).toEqual([
      {
        ref: "CLM-PRECISION-DENIED",
        reason: "denial reason present but denied amount is missing/invalid",
      },
    ]);
  });

  it("accepts exactly 2 decimal places (the valid SAR/halala precision)", () => {
    const rows = [row({ "Claim ID": "CLM-2DP", "Total Amount": "10.05" })];
    const { claims, quarantined } = csvRowsToClaims(rows, mapping(), CTX);
    expect(quarantined).toEqual([]);
    expect(claims[0]!.claim.total_amount).toBe("10.05");
  });

  // Real, demonstrable defect: Number.prototype.toFixed switches to
  // exponential notation ("1e+21") for magnitudes >= 1e21, and
  // Number.isFinite(1e21) is true, so an implausibly large digit string
  // (accidental extra zeros, a unit mismatch, or a hostile CSV) sailed
  // through parseMoney's finite/non-negative check and would have written a
  // non-decimal literal string into a money column instead of being caught as
  // an obviously-implausible claim amount.
  it("quarantines a totalAmount so large it would format in exponential notation", () => {
    const rows = [
      row({ "Claim ID": "CLM-HUGE", "Total Amount": "9999999999999999999999" }),
    ];
    const { claims, quarantined } = csvRowsToClaims(rows, mapping(), CTX);
    expect(claims).toEqual([]);
    expect(quarantined).toEqual([
      { ref: "CLM-HUGE", reason: "total amount is missing or not a valid number" },
    ]);
  });

  it("quarantines a totalAmount above the documented plausible-claim ceiling even when it still formats as plain decimal", () => {
    // One order of magnitude above MAX_MONEY_VALUE (999,999,999.99): still far
    // short of exponential-notation territory (1e21), so this exercises the
    // explicit ceiling check on its own, independent of the toFixed footgun above.
    const rows = [row({ "Claim ID": "CLM-OVER-CEILING", "Total Amount": "9999999999.99" })];
    const { claims, quarantined } = csvRowsToClaims(rows, mapping(), CTX);
    expect(claims).toEqual([]);
    expect(quarantined).toEqual([
      { ref: "CLM-OVER-CEILING", reason: "total amount is missing or not a valid number" },
    ]);
  });

  it("accepts a totalAmount right at the documented plausible-claim ceiling", () => {
    const rows = [row({ "Claim ID": "CLM-AT-CEILING", "Total Amount": "999999999.99" })];
    const { claims, quarantined } = csvRowsToClaims(rows, mapping(), CTX);
    expect(quarantined).toEqual([]);
    expect(claims[0]!.claim.total_amount).toBe("999999999.99");
  });

  // Design-law conformance (design-brief §4.3): Western Latin numerals are the
  // ONLY valid digit form for money/table/code content in BOTH locales, even
  // AR — Arabic-Indic digits are a narrative-prose-only preference. A money
  // column using Arabic-Indic digits must quarantine, not be "smart-parsed"
  // (which would also require trusting an un-vetted digit-mapping table on a
  // PHI-adjacent financial intake surface).
  it("quarantines totalAmount written in Arabic-Indic digits rather than silently reinterpreting them", () => {
    const rows = [row({ "Claim ID": "CLM-ARABIC-DIGITS", "Total Amount": "١٢٣.٥٠" })];
    const { claims, quarantined } = csvRowsToClaims(rows, mapping(), CTX);
    expect(claims).toEqual([]);
    expect(quarantined).toEqual([
      { ref: "CLM-ARABIC-DIGITS", reason: "total amount is missing or not a valid number" },
    ]);
  });

  // Not a bug — locking in intentional parity with the FHIR path. ingestBundle's
  // requiredAmountIssue (apps/web/lib/actions/ingest.ts) only rejects a NULL/
  // missing total; it does not reject an explicit total of exactly 0. This CSV
  // path intentionally matches that: a $0.00 claim is unusual data but not
  // inherently invalid the way a missing amount is.
  it("accepts totalAmount of exactly 0.00 (parity with the FHIR path's null-only check, not a data-quality bug)", () => {
    const rows = [row({ "Claim ID": "CLM-ZERO", "Total Amount": "0.00" })];
    const { claims, quarantined } = csvRowsToClaims(rows, mapping(), CTX);
    expect(quarantined).toEqual([]);
    expect(claims[0]!.claim.total_amount).toBe("0.00");
  });

  // Not a bug — -0 is numerically equal to 0 in JS (`-0 < 0` is false) and
  // (-0).toFixed(2) normalizes to "0.00" (no literal minus sign leaks into the
  // stored string), so this is harmless. Locked in explicitly so a future
  // change can't silently start rejecting it or, worse, storing "-0.00".
  it("normalizes a signed-zero totalAmount to a plain '0.00', never a literal negative-zero string", () => {
    const rows = [row({ "Claim ID": "CLM-NEG-ZERO", "Total Amount": "-0" })];
    const { claims, quarantined } = csvRowsToClaims(rows, mapping(), CTX);
    expect(quarantined).toEqual([]);
    expect(claims[0]!.claim.total_amount).toBe("0.00");
  });
});

describe("csvRowsToClaims — batch behavior", () => {
  it("quarantines a bad row without dropping the good rows around it", () => {
    const rows = [
      row({ "Claim ID": "CLM-GOOD-1", "Total Amount": "10" }),
      row({ "Claim ID": "CLM-BAD", "Total Amount": "" }),
      row({ "Claim ID": "CLM-GOOD-2", "Total Amount": "20" }),
    ];
    const { claims, quarantined } = csvRowsToClaims(rows, mapping(), CTX);
    expect(claims).toHaveLength(2);
    expect(claims.map((c) => c.claim.nphies_claim_id)).toEqual([null, null]);
    expect(quarantined).toEqual([
      { ref: "CLM-BAD", reason: "total amount is missing or not a valid number" },
    ]);
  });

  it("generates distinct ids for every claim/line/response/denial across rows", () => {
    const rows = [
      row({ "Claim ID": "CLM-1", "Total Amount": "10" }),
      row({ "Claim ID": "CLM-2", "Total Amount": "20" }),
    ];
    const { claims } = csvRowsToClaims(rows, mapping(), CTX);
    const ids = [
      claims[0]!.claim.id,
      claims[1]!.claim.id,
      claims[0]!.lines[0]!.id,
      claims[1]!.lines[0]!.id,
      claims[0]!.response.id,
      claims[1]!.response.id,
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });
});
