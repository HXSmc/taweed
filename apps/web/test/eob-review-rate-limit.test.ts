import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression coverage for the finding: approveEobExtractionAction and
// rejectEobExtractionAction had ZERO rate limiting, unlike every sibling
// mutating action in this directory (eob-extract, ingest, author-rule,
// assist-appeal, auth, explain-flag all call allowRequest). Without a
// ceiling, approveEobExtractionAction's multi-statement transaction (row
// flip, payer select/insert, branch/provider/patient selects, a per-claim
// insertNormalizedClaim loop, and an audit write) can be looped by an
// already-authorized actor to amplify DB load far beyond a single request.
// These tests prove the throttle fires BEFORE that work runs, and is keyed
// per tenant+actor like every other action in this directory.

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

const mockedGetEobExtraction = vi.fn();
const mockedFlipEobExtractionApprovedTx = vi.fn();
const mockedRejectEobExtractionRow = vi.fn();
vi.mock("@/lib/eob-review-data", () => ({
  getEobExtraction: (...args: unknown[]) => mockedGetEobExtraction(...args),
  flipEobExtractionApprovedTx: (...args: unknown[]) =>
    mockedFlipEobExtractionApprovedTx(...args),
  rejectEobExtractionRow: (...args: unknown[]) =>
    mockedRejectEobExtractionRow(...args),
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

// Bypass the model-contract/arithmetic gates (irrelevant to rate limiting)
// so the test payload only has to satisfy this file's own EditedExtraction
// zod schema, not @taweed/ai's real EobExtractionSchema/arithmetic rules.
vi.mock("@taweed/ai", () => ({
  EobExtractionSchema: { safeParse: vi.fn(() => ({ success: true, data: {} })) },
  validateEobExtractionArithmetic: vi.fn(() => ({ passed: true })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import {
  approveEobExtractionAction,
  rejectEobExtractionAction,
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

beforeEach(() => {
  vi.clearAllMocks();
  mockedAuthorizeAction.mockResolvedValue(SESSION);
});

describe("approveEobExtractionAction — server-side rate limiting", () => {
  it("returns rate_limited and never opens a session when allowRequest denies the request", async () => {
    // Arrange: an actor over the per-tenant+actor cap for this window.
    mockedAllowRequest.mockResolvedValue(false);

    // Act
    const result = await approveEobExtractionAction(ROW_ID, VALID_EDITED);

    // Assert: rejected before the DB transaction (row flip, payer
    // resolution, per-claim inserts, audit write) ever runs.
    expect(result).toEqual({ ok: false, error: "rate_limited" });
    expect(mockedWithSession).not.toHaveBeenCalled();
  });

  it("keys the throttle per tenant+actor, mirroring the same-directory AI actions", async () => {
    // Arrange
    mockedAllowRequest.mockResolvedValue(true);
    mockedWithSession.mockResolvedValue(undefined);

    // Act
    await approveEobExtractionAction(ROW_ID, VALID_EDITED);

    // Assert
    expect(mockedAllowRequest).toHaveBeenCalledWith(
      `eob-review:${SESSION.tenantId}:${SESSION.userId}`,
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("still runs the approve transaction when under the rate limit", async () => {
    // Arrange
    mockedAllowRequest.mockResolvedValue(true);
    mockedWithSession.mockResolvedValue(undefined);

    // Act
    const result = await approveEobExtractionAction(ROW_ID, VALID_EDITED);

    // Assert: reaches past the throttle into the normal control flow.
    expect(mockedWithSession).toHaveBeenCalledWith(
      SESSION.tenantId,
      expect.any(Function),
    );
    expect(result.ok).toBe(true);
  });
});

describe("rejectEobExtractionAction — server-side rate limiting", () => {
  it("returns rate_limited and never reads the row when allowRequest denies the request", async () => {
    // Arrange
    mockedAllowRequest.mockResolvedValue(false);

    // Act
    const result = await rejectEobExtractionAction(ROW_ID);

    // Assert
    expect(result).toEqual({ ok: false, error: "rate_limited" });
    expect(mockedGetEobExtraction).not.toHaveBeenCalled();
  });

  it("keys the throttle per tenant+actor", async () => {
    // Arrange
    mockedAllowRequest.mockResolvedValue(true);
    mockedGetEobExtraction.mockResolvedValue(null);

    // Act
    await rejectEobExtractionAction(ROW_ID);

    // Assert
    expect(mockedAllowRequest).toHaveBeenCalledWith(
      `eob-review:${SESSION.tenantId}:${SESSION.userId}`,
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("still runs the reject path when under the rate limit", async () => {
    // Arrange
    mockedAllowRequest.mockResolvedValue(true);
    mockedGetEobExtraction.mockResolvedValue(null);

    // Act
    const result = await rejectEobExtractionAction(ROW_ID);

    // Assert: reaches past the throttle into the normal control flow
    // (falls through to "not_pending" because the row lookup is mocked to
    // return null here — the point is it got that far).
    expect(mockedGetEobExtraction).toHaveBeenCalledWith(SESSION.tenantId, ROW_ID);
    expect(result).toEqual({ ok: false, error: "not_pending" });
  });
});
