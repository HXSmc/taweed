import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression coverage for the finding: ingestBundle (FHIR bundle upload -> JSON
// parse -> per-claim DB insert loop) had ZERO rate limiting, unlike every other
// action in this directory (explain-flag.ts, author-rule.ts, eob-extract.ts all
// call allowRequest with a per-tenant+actor cap). Without a ceiling, one
// authorized actor could loop this endpoint to drive unbounded CPU/DB load —
// each call does an unbounded JSON.parse plus a DB insert per claim, all before
// any throttle. This test proves the throttle fires BEFORE any of that
// expensive work runs.

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

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { ingestBundle } from "../lib/actions/ingest";

const SESSION = {
  tenantId: "tenant-1",
  userId: "user-1",
  email: "rcm@example.com",
  role: "rcm",
};

function bundleFormData(): FormData {
  const fd = new FormData();
  fd.set(
    "file",
    new File([JSON.stringify({ resourceType: "Bundle", entry: [] })], "bundle.json", {
      type: "application/json",
    }),
  );
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedAuthorizeAction.mockResolvedValue(SESSION);
});

describe("ingestBundle — server-side rate limiting", () => {
  it("returns rate_limited and never touches the DB when allowRequest denies the request", async () => {
    // Arrange: an actor over the per-tenant+actor cap for this window.
    mockedAllowRequest.mockReturnValue(false);

    // Act
    const result = await ingestBundle(bundleFormData());

    // Assert: the call is rejected before any parse/tenant-dimension/insert
    // work — the DoS-shaped cost (JSON.parse + per-claim transactions) never
    // runs once the caller is over budget.
    expect(result.ok).toBe(false);
    expect(result.error).toBe("rate_limited");
    expect(mockedWithSession).not.toHaveBeenCalled();
  });

  it("keys the throttle per tenant+actor, mirroring the same-directory AI actions", async () => {
    // Arrange
    mockedAllowRequest.mockReturnValue(true);
    mockedWithSession.mockResolvedValue({
      branch: undefined,
      provider: undefined,
      payer: undefined,
      patient: undefined,
    });

    // Act
    await ingestBundle(bundleFormData());

    // Assert
    expect(mockedAllowRequest).toHaveBeenCalledWith(
      `ingest:${SESSION.tenantId}:${SESSION.userId}`,
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("still runs the ingest path when under the rate limit", async () => {
    // Arrange: allowed through, but bail out at the next real boundary
    // (missing seeded tenant dimensions) so this test stays a pure unit test
    // with no live DB.
    mockedAllowRequest.mockReturnValue(true);
    mockedWithSession.mockResolvedValue({
      branch: undefined,
      provider: undefined,
      payer: undefined,
      patient: undefined,
    });

    // Act
    const result = await ingestBundle(bundleFormData());

    // Assert: reaches past the throttle into the normal control flow.
    expect(result.error).toBe("tenant has no dimensions seeded");
  });
});
