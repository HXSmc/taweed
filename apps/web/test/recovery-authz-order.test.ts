import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression coverage for the finding: markAppealOutcome ran Input.safeParse
// BEFORE authorizeAction, unlike every sibling action in lib/actions/ (e.g.
// eob-review.ts calls authorizeAction first, then EditedExtraction.safeParse).
// That inversion let malformed input be rejected before an unauthorized/
// unauthenticated caller was turned away, leaking a (harmless but
// inconsistent) signal about input shape ahead of the authz check. These
// tests prove authorizeAction now runs first and short-circuits before Zod
// validation ever runs.

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("markAppealOutcome — authz-before-input-validation ordering", () => {
  it("calls authorizeAction even when the input is malformed", async () => {
    // Arrange: authorizeAction denies (unauthorized caller); appealId is not
    // a UUID so Input.safeParse would also fail.
    mockedAuthorizeAction.mockResolvedValue(null);

    // Act
    const result = await markAppealOutcome("not-a-uuid", "won");

    // Assert: authorizeAction ran (it wasn't short-circuited by a prior
    // input-validation check), and the caller is turned away without ever
    // reaching allowRequest/withSession.
    expect(mockedAuthorizeAction).toHaveBeenCalledWith("recovery", ["full"]);
    expect(result).toEqual({ ok: false });
    expect(mockedAllowRequest).not.toHaveBeenCalled();
    expect(mockedWithSession).not.toHaveBeenCalled();
  });

  it("still rejects malformed input for an authorized caller, after authz runs", async () => {
    // Arrange: caller IS authorized, but the input is malformed.
    mockedAuthorizeAction.mockResolvedValue({
      tenantId: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
      email: "rcm@example.com",
      role: "rcm",
    });

    // Act
    const result = await markAppealOutcome("not-a-uuid", "won");

    // Assert: authz passed, but the throttle/transaction never runs because
    // Zod validation rejects the malformed appealId.
    expect(mockedAuthorizeAction).toHaveBeenCalledWith("recovery", ["full"]);
    expect(result).toEqual({ ok: false });
    expect(mockedAllowRequest).not.toHaveBeenCalled();
    expect(mockedWithSession).not.toHaveBeenCalled();
  });
});
