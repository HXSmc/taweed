import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression test for the finding: approveEobExtractionAction's catch block
// logged the caught error object VERBATIM (`console.error("...", err)`),
// unlike the sibling eob-extract.ts action on the same AI-4 data path, which
// already reduces errors to a content-free signal (describeErrorForLog)
// specifically because this feature is not PHI-free-by-construction — a
// Postgres constraint-violation message on this path can include the
// offending claimId/patientRef/money value. This test forces the approve
// transaction to fail with an error whose message embeds exactly that kind
// of sensitive value, then asserts console.error never receives it.

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

vi.mock("@taweed/ai", () => ({
  EobExtractionSchema: { safeParse: vi.fn(() => ({ success: true, data: {} })) },
  validateEobExtractionArithmetic: vi.fn(() => ({ passed: true })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
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

const VALID_EDITED: EditedEobExtractionInput = {
  payerName: "Test Payer",
  payerNphiesId: null,
  remittanceDate: null,
  remittanceTotalPaidSar: "100.00",
  overallConfidence: 1,
  claims: [
    {
      claimId: "claim-1",
      nphiesClaimId: null,
      patientRef: null,
      serviceDate: null,
      confidence: 1,
      totalBilledSar: "100.00",
      totalPaidSar: "100.00",
      totalRejectedSar: "0.00",
      totalAdjustmentSar: "0.00",
      lines: [
        {
          claimLineRef: "line-1",
          sbsCode: null,
          icd10amCode: null,
          billedSar: "100.00",
          paidSar: "100.00",
          patientShareSar: "0.00",
          rejectedSar: "0.00",
          adjustmentSar: "0.00",
          denialCode: null,
          confidence: 1,
        },
      ],
    },
  ],
};

// A realistic Postgres constraint-violation message: this is exactly the
// kind of string the finding warns can carry claimId/patientRef/money values.
const SENSITIVE_DB_ERROR = new Error(
  'duplicate key value violates unique constraint "normalized_claims_claim_id_key" (claimId=claim-1, patientRef=patient-999, amount=1234.56)',
);

beforeEach(() => {
  vi.clearAllMocks();
  mockedAuthorizeAction.mockResolvedValue(SESSION);
  mockedAllowRequest.mockResolvedValue(true);
});

describe("approveEobExtractionAction — error log minimization", () => {
  it("never logs the raw caught error when the approve transaction fails", async () => {
    // Arrange: the transaction rejects with an error carrying sensitive content.
    mockedWithSession.mockRejectedValue(SENSITIVE_DB_ERROR);
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    // Act
    const result = await approveEobExtractionAction(ROW_ID, VALID_EDITED);

    // Assert: the action still reports failure to the caller...
    expect(result).toEqual({ ok: false, error: "failed" });

    // ...but nothing logged carries the sensitive claimId/patientRef/amount
    // content, and the raw Error instance itself is never passed to
    // console.error (matching eob-extract.ts's describeErrorForLog discipline).
    expect(consoleErrorSpy).toHaveBeenCalled();
    for (const call of consoleErrorSpy.mock.calls) {
      const serialized = call.map(String).join(" ");
      expect(serialized).not.toContain("claim-1");
      expect(serialized).not.toContain("patient-999");
      expect(serialized).not.toContain("1234.56");
      expect(call).not.toContain(SENSITIVE_DB_ERROR);
    }

    consoleErrorSpy.mockRestore();
  });
});
