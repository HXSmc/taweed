import { describe, it, expect, vi, beforeEach } from "vitest";

// Gap 2 — the approve-revalidation invariant docs/handoff.md's AI-4 entry
// names ("approve re-runs the arithmetic validator on human-edited values")
// must keep holding once a 5th "adjustment/withholding" money bucket exists.
// Unlike eob-review-rate-limit.test.ts / eob-review-error-log-safety.test.ts,
// this file deliberately does NOT mock "@taweed/ai" — it exercises the REAL
// EobExtractionSchema + validateEobExtractionArithmetic through the REAL
// toWireExtraction reconversion (adjustmentSar -> adjustmentHalalas,
// totalAdjustmentSar -> totalAdjustmentHalalas), so a regression in either the
// reconversion or the validator's new 5-bucket sum would show up here, not
// just in eob-validators.test.ts's hand-built-halalas unit tests.

const mockedAuthorizeAction = vi.fn();
vi.mock("@/lib/authz", () => ({
  authorizeAction: (...args: unknown[]) => mockedAuthorizeAction(...args),
}));

const mockedAllowRequest = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  allowRequest: (...args: unknown[]) => mockedAllowRequest(...args),
}));

const mockedWithSession = vi.fn();
vi.mock("@/lib/db", () => ({
  withSession: (...args: unknown[]) => mockedWithSession(...args),
}));

vi.mock("@/lib/eob-review-data", () => ({
  getEobExtraction: vi.fn(),
  flipEobExtractionApprovedTx: vi.fn(),
  rejectEobExtractionRow: vi.fn(),
}));

vi.mock("@/lib/eob-to-normalized", () => ({
  buildNormalizedClaimsFromEob: vi.fn(() => []),
}));

vi.mock("@taweed/db", () => ({
  schema: {
    payers: {},
    branches: {},
    providers: {},
    patients: {},
  },
  insertNormalizedClaim: vi.fn(),
}));

vi.mock("@taweed/audit", () => ({
  logAudit: vi.fn(),
}));

vi.mock("@taweed/ingest", () => ({
  resolveDimension: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import {
  approveEobExtractionAction,
  type EditedEobExtractionInput,
} from "../lib/actions/eob-review";

const SESSION = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  userId: "user-1",
  email: "rcm@example.com",
  role: "rcm",
};

const ROW_ID = "22222222-2222-4222-8222-222222222222";

// billed 100.00 = paid 90.00 + rejected 0.00 + patientShare 0.00 +
// adjustment 10.00 (a genuine contractual write-off) — every cross-total
// identity holds, including the claim- and remittance-level totals.
const BALANCED_WITH_ADJUSTMENT: EditedEobExtractionInput = {
  payerName: "Test Payer",
  payerNphiesId: null,
  remittanceDate: null,
  remittanceTotalPaidSar: "90.00",
  overallConfidence: 1,
  claims: [
    {
      claimId: "claim-1",
      nphiesClaimId: null,
      patientRef: null,
      serviceDate: null,
      confidence: 1,
      totalBilledSar: "100.00",
      totalPaidSar: "90.00",
      totalRejectedSar: "0.00",
      totalAdjustmentSar: "10.00",
      lines: [
        {
          claimLineRef: "line-1",
          sbsCode: null,
          icd10amCode: null,
          billedSar: "100.00",
          paidSar: "90.00",
          patientShareSar: "0.00",
          rejectedSar: "0.00",
          adjustmentSar: "10.00",
          denialCode: null,
          confidence: 1,
        },
      ],
    },
  ],
};

// Same billed/paid/rejected/patientShare as BALANCED_WITH_ADJUSTMENT, but the
// line's adjustment is short by 10.00 SAR relative to what paid+rejected+
// patientShare+adjustment needs to sum to billed — a reviewer edit that
// doesn't add up, and must be rejected exactly the way a wrong billed/paid/
// rejected/patientShare edit already was before this bucket existed.
const SHORT_BY_ADJUSTMENT: EditedEobExtractionInput = {
  ...BALANCED_WITH_ADJUSTMENT,
  claims: [
    {
      ...BALANCED_WITH_ADJUSTMENT.claims[0]!,
      lines: [
        {
          ...BALANCED_WITH_ADJUSTMENT.claims[0]!.lines[0]!,
          adjustmentSar: "0.00", // paid(90)+rejected(0)+patientShare(0)+adjustment(0) = 90 != billed(100)
        },
      ],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedAuthorizeAction.mockResolvedValue(SESSION);
});

describe("approveEobExtractionAction — real 5-bucket arithmetic re-validation (Gap 2)", () => {
  it("rejects as 'inconsistent' a payload that's short by the adjustment amount, without ever reaching the rate limiter or a DB session", async () => {
    const result = await approveEobExtractionAction(ROW_ID, SHORT_BY_ADJUSTMENT);

    expect(result).toEqual({ ok: false, error: "inconsistent" });
    // The arithmetic gate (packages/ai/src/eob-validators.ts) runs BEFORE the
    // rate-limit check and the DB transaction — a human-edited amount that
    // doesn't add up must never burn a rate-limit slot or open a session.
    expect(mockedAllowRequest).not.toHaveBeenCalled();
    expect(mockedWithSession).not.toHaveBeenCalled();
  });

  it("approves a payload that only cross-totals WITH the adjustment term — proves toWireExtraction's adjustmentSar/totalAdjustmentSar reconversion survives into the real validator", async () => {
    mockedAllowRequest.mockResolvedValue(true);
    mockedWithSession.mockResolvedValue(undefined);

    const result = await approveEobExtractionAction(ROW_ID, BALANCED_WITH_ADJUSTMENT);

    // Never "inconsistent": billed == paid+rejected+patientShare+adjustment
    // only holds once the reconverted adjustmentHalalas/totalAdjustmentHalalas
    // actually reach the validator — if toWireExtraction dropped the mapping,
    // this payload would incorrectly fail as "inconsistent" (billed 100 !=
    // paid 90 with no adjustment term).
    expect(result.error).not.toBe("inconsistent");
    expect(result).toEqual({ ok: true });
    expect(mockedAllowRequest).toHaveBeenCalled();
    expect(mockedWithSession).toHaveBeenCalledWith(SESSION.tenantId, expect.any(Function));
  });
});
