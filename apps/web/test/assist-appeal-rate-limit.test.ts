import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression coverage for the finding: recordSuggestionEditAction (the
// edit-distance/outcome tracker for AI-2 appeal-draft suggestions) had ZERO
// rate limiting, unlike its sibling assistAppealAction in the same file,
// which throttles via allowRequest at 8 req/60s. Without a ceiling, an
// authenticated, appeals-authorized actor could loop this write in a tight
// loop and spam the rate_limit_windows-backed appPool with transactions.
// This test proves the throttle fires BEFORE the DB update runs, and that
// it is keyed per tenant+actor like every other action in this directory.

const mockedAuthorizeAction = vi.fn();
vi.mock("@/lib/authz", () => ({
  authorizeAction: (...args: unknown[]) => mockedAuthorizeAction(...args),
}));

const mockedAllowRequest = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  allowRequest: (...args: unknown[]) => mockedAllowRequest(...args),
}));

const mockedUpdateSuggestionOutcome = vi.fn();
vi.mock("@/lib/appeals-data", () => ({
  getAppealDraft: vi.fn(),
  recordSuggestion: vi.fn(),
  recordSuppressedSuggestion: vi.fn(),
  updateSuggestionOutcome: (...args: unknown[]) =>
    mockedUpdateSuggestionOutcome(...args),
}));

vi.mock("@/lib/db", () => ({
  appPool: vi.fn(),
}));

vi.mock("@taweed/ai", () => ({
  assistAppeal: vi.fn(),
  isAiConfigError: vi.fn(() => false),
  isAiDisabledError: vi.fn(() => false),
}));

import { recordSuggestionEditAction } from "../lib/actions/assist-appeal";

const SESSION = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  userId: "user-1",
  email: "rcm@example.com",
  role: "rcm",
};

const SUGGESTION_ID = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  mockedAuthorizeAction.mockResolvedValue(SESSION);
});

describe("recordSuggestionEditAction — server-side rate limiting", () => {
  it("returns not-ok and never touches the DB when allowRequest denies the request", async () => {
    // Arrange: an actor over the per-tenant+actor cap for this window.
    mockedAllowRequest.mockResolvedValue(false);

    // Act
    const result = await recordSuggestionEditAction(
      SUGGESTION_ID,
      "inserted",
    );

    // Assert: rejected before the outcome UPDATE ever runs.
    expect(result.ok).toBe(false);
    expect(mockedUpdateSuggestionOutcome).not.toHaveBeenCalled();
  });

  it("keys the throttle per tenant+actor, mirroring assistAppealAction in this file", async () => {
    // Arrange
    mockedAllowRequest.mockResolvedValue(true);
    mockedUpdateSuggestionOutcome.mockResolvedValue(true);

    // Act
    await recordSuggestionEditAction(SUGGESTION_ID, "edited", 12, 340);

    // Assert
    expect(mockedAllowRequest).toHaveBeenCalledWith(
      `assist-edit:${SESSION.tenantId}:${SESSION.userId}`,
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("still runs the update when under the rate limit", async () => {
    // Arrange
    mockedAllowRequest.mockResolvedValue(true);
    mockedUpdateSuggestionOutcome.mockResolvedValue(true);

    // Act
    const result = await recordSuggestionEditAction(
      SUGGESTION_ID,
      "discarded",
    );

    // Assert: reaches past the throttle into the normal control flow.
    expect(result.ok).toBe(true);
    expect(mockedUpdateSuggestionOutcome).toHaveBeenCalledWith(
      SESSION.tenantId,
      SUGGESTION_ID,
      { outcome: "discarded", editDistance: undefined, finalChars: undefined },
    );
  });
});
