import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression coverage for the finding: markAppealOutcome had ZERO rate
// limiting, unlike every sibling mutating action in lib/actions/ (appeals.ts,
// eob-review.ts, assist-appeal.ts, author-rule.ts, eob-extract.ts, ingest.ts
// all call allowRequest). Without a ceiling, an already-authorized actor could
// loop this read + UPDATE + logAudit write with no limit. These tests prove
// the throttle fires BEFORE that work runs, and is keyed per tenant+actor
// like every other action in this directory.

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

vi.mock("@taweed/db", () => ({
  schema: { appeals: {} },
}));

// recovery.ts also imports the shared SAR_MONEY_REGEX (unrelated to this
// rate-limit fix; a concurrent change in this file) — mock it so the module
// under test loads without pulling in the real @/lib/money module.
vi.mock("@/lib/money", () => ({ SAR_MONEY_REGEX: /^\d+(\.\d{1,2})?$/ }));

vi.mock("@taweed/analytics", () => ({
  resolveRecovery: vi.fn(() => ({ recoveredSar: "100.00", corrected: false })),
}));

vi.mock("@taweed/audit", () => ({
  logAudit: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { markAppealOutcome } from "../lib/actions/recovery";

const SESSION = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  userId: "user-1",
  email: "rcm@example.com",
  role: "rcm",
};

const APPEAL_ID = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  mockedAuthorizeAction.mockResolvedValue(SESSION);
});

describe("markAppealOutcome — server-side rate limiting", () => {
  it("returns not-ok and never opens a session when allowRequest denies the request", async () => {
    // Arrange: an actor over the per-tenant+actor cap for this window.
    mockedAllowRequest.mockResolvedValue(false);

    // Act
    const result = await markAppealOutcome(APPEAL_ID, "won");

    // Assert: rejected before the read + UPDATE + audit-write transaction
    // ever runs.
    expect(result).toEqual({ ok: false });
    expect(mockedWithSession).not.toHaveBeenCalled();
  });

  it("keys the throttle per tenant+actor, mirroring the same-directory actions", async () => {
    // Arrange
    mockedAllowRequest.mockResolvedValue(true);
    mockedWithSession.mockResolvedValue(null);

    // Act
    await markAppealOutcome(APPEAL_ID, "won");

    // Assert
    expect(mockedAllowRequest).toHaveBeenCalledWith(
      `recovery:${SESSION.tenantId}:${SESSION.userId}`,
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("still runs the outcome transaction when under the rate limit", async () => {
    // Arrange
    mockedAllowRequest.mockResolvedValue(true);
    mockedWithSession.mockResolvedValue({
      recoveredSar: "100.00",
      corrected: false,
    });

    // Act
    const result = await markAppealOutcome(APPEAL_ID, "won");

    // Assert: reaches past the throttle into the normal control flow.
    expect(mockedWithSession).toHaveBeenCalledWith(
      SESSION.tenantId,
      expect.any(Function),
    );
    expect(result.ok).toBe(true);
  });
});
