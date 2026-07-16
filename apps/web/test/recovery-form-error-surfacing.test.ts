import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression coverage for the silent-failure bug in markAppealOutcomeForm:
// every {ok:false} early-return in markAppealOutcome (unauthorized, invalid
// input, throttle, appeal-not-found) used to be discarded by the form wrapper
// (`await markAppealOutcome(...)` with the return value thrown away), so a
// failed "mark won/lost" looked identical to a successful no-op — the operator
// clicked and nothing visibly happened. These tests prove the wrapper now
// surfaces the failure (redirects to the page with ?recoveryError=1 so an
// inline error region renders) instead of swallowing it.

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

const mockedHeaders = vi.fn();
vi.mock("next/headers", () => ({
  headers: (...args: unknown[]) => mockedHeaders(...args),
}));

vi.mock("@taweed/db", () => ({ schema: { appeals: {} } }));

vi.mock("@/lib/money", () => ({ SAR_MONEY_REGEX: /^\d+(\.\d{1,2})?$/ }));

vi.mock("@taweed/analytics", () => ({
  resolveRecovery: vi.fn(() => ({ recoveredSar: "100.00", corrected: false })),
}));

vi.mock("@taweed/audit", () => ({ logAudit: vi.fn() }));

const mockedRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => mockedRevalidatePath(...a) }));

const mockedRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (...a: unknown[]) => mockedRedirect(...a),
}));

import { markAppealOutcomeForm } from "../lib/actions/recovery";

const SESSION = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  userId: "user-1",
  email: "rcm@example.com",
  role: "rcm",
};

const APPEAL_ID = "22222222-2222-4222-8222-222222222222";

function formFor(outcome: "won" | "lost" | "submitted"): FormData {
  const fd = new FormData();
  fd.set("appealId", APPEAL_ID);
  fd.set("outcome", outcome);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  // next-intl middleware sets this header; the action reads it for the locale
  // of the error redirect.
  mockedHeaders.mockResolvedValue({
    get: (k: string) => (k === "x-next-intl-locale" ? "en" : null),
  });
  mockedAllowRequest.mockResolvedValue(true);
});

describe("markAppealOutcomeForm — failure surfacing", () => {
  it("redirects with recoveryError=1 when the action is unauthorized (not swallowed)", async () => {
    // Arrange: RBAC denies (e.g. an admin/read-only or clinician/hidden role
    // clicking the button). markAppealOutcome returns {ok:false}.
    mockedAuthorizeAction.mockResolvedValue(null);

    // Act
    await markAppealOutcomeForm(formFor("won"));

    // Assert: the failure is surfaced as a redirect, not a silent void return.
    // (On the pre-fix code, mockedRedirect was never called.)
    expect(mockedRedirect).toHaveBeenCalledWith("/en/recovery?recoveryError=1");
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it("redirects with recoveryError=1 when the appeal is not found for this tenant", async () => {
    // Arrange: authorized, under the throttle, but the RLS-scoped lookup finds
    // no appeal → withSession resolves null → {ok:false}.
    mockedAuthorizeAction.mockResolvedValue(SESSION);
    mockedWithSession.mockResolvedValue(null);

    // Act
    await markAppealOutcomeForm(formFor("lost"));

    // Assert
    expect(mockedRedirect).toHaveBeenCalledWith("/en/recovery?recoveryError=1");
  });

  it("redirects with recoveryError=1 when the per-tenant throttle trips", async () => {
    // Arrange: authorized but over the rate limit → {ok:false}.
    mockedAuthorizeAction.mockResolvedValue(SESSION);
    mockedAllowRequest.mockResolvedValue(false);

    // Act
    await markAppealOutcomeForm(formFor("won"));

    // Assert
    expect(mockedRedirect).toHaveBeenCalledWith("/en/recovery?recoveryError=1");
    expect(mockedWithSession).not.toHaveBeenCalled();
  });

  it("does NOT redirect on a successful mutation (the page re-renders normally)", async () => {
    // Arrange: happy path — authorized, under the throttle, appeal resolved.
    mockedAuthorizeAction.mockResolvedValue(SESSION);
    mockedWithSession.mockResolvedValue({ recoveredSar: "309.00", corrected: false });

    // Act
    await markAppealOutcomeForm(formFor("won"));

    // Assert: success stays on-page (no error redirect); the layout is
    // revalidated so the ROI band + money indicator recompute.
    expect(mockedRedirect).not.toHaveBeenCalled();
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/[locale]/(app)", "layout");
  });

  it("preserves the operator's locale in the error redirect path", async () => {
    // Arrange: Arabic-locale request, unauthorized.
    mockedHeaders.mockResolvedValue({
      get: (k: string) => (k === "x-next-intl-locale" ? "ar" : null),
    });
    mockedAuthorizeAction.mockResolvedValue(null);

    // Act
    await markAppealOutcomeForm(formFor("won"));

    // Assert
    expect(mockedRedirect).toHaveBeenCalledWith("/ar/recovery?recoveryError=1");
  });
});
