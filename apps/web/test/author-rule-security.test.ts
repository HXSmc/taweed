import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression coverage for two audit findings in author-rule.ts:
//
// 1. approveRuleAction / rejectRuleAction had ZERO rate limiting, unlike their
//    sibling draftRuleAction in the same file (which throttles via
//    allowRequest at AUTHOR_RATE_LIMIT/AUTHOR_WINDOW_MS). Without a ceiling, an
//    authoring-capable actor could script rapid repeated calls, generating
//    unbounded audit-log writes and DB churn. This test proves the throttle
//    fires BEFORE any DB read/write for both actions.
//
// 2. draftRuleAction accepted payerId verbatim from the client for
//    scope="payer" without checking it against the tenant's real payers
//    (getTenantPayers), so a crafted request could persist a rule scoped to a
//    nonexistent/wrong payer. This test proves an unknown payerId is rejected
//    before the (paid) AI generation call ever runs, and that a known payerId
//    still passes through.

const mockedAuthorizeAction = vi.fn();
vi.mock("@/lib/authz", () => ({
  authorizeAction: (...args: unknown[]) => mockedAuthorizeAction(...args),
}));

const mockedAllowRequest = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  allowRequest: (...args: unknown[]) => mockedAllowRequest(...args),
}));

const mockedGetAuthoredRule = vi.fn();
const mockedGetTenantPayers = vi.fn();
const mockedLoadApprovedAuthoredRules = vi.fn();
const mockedPersistDraftRule = vi.fn();
const mockedSetRuleStatus = vi.fn();
const mockedAuthoredRowToScrubRule = vi.fn();
vi.mock("@/lib/rules-data", () => ({
  getAuthoredRule: (...args: unknown[]) => mockedGetAuthoredRule(...args),
  getTenantPayers: (...args: unknown[]) => mockedGetTenantPayers(...args),
  loadApprovedAuthoredRules: (...args: unknown[]) =>
    mockedLoadApprovedAuthoredRules(...args),
  persistDraftRule: (...args: unknown[]) => mockedPersistDraftRule(...args),
  setRuleStatus: (...args: unknown[]) => mockedSetRuleStatus(...args),
  authoredRowToScrubRule: (...args: unknown[]) =>
    mockedAuthoredRowToScrubRule(...args),
}));

const mockedWithSession = vi.fn();
vi.mock("@/lib/db", () => ({
  appPool: vi.fn(),
  withSession: (...args: unknown[]) => mockedWithSession(...args),
}));

vi.mock("@taweed/audit", () => ({
  logAudit: vi.fn(),
}));

const mockedAuthorRule = vi.fn();
vi.mock("@taweed/ai", () => ({
  authorRule: (...args: unknown[]) => mockedAuthorRule(...args),
  isAiConfigError: vi.fn(() => false),
  isAiDisabledError: vi.fn(() => false),
}));

const mockedValidateAuthoredRule = vi.fn();
vi.mock("@taweed/rules-engine", () => ({
  SCRUBBER_RULES: [],
  validateAuthoredRule: (...args: unknown[]) =>
    mockedValidateAuthoredRule(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  approveRuleAction,
  rejectRuleAction,
  draftRuleAction,
} from "../lib/actions/author-rule";

const SESSION = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  userId: "user-1",
  email: "rcm@example.com",
  role: "rcm",
};

const ROW_ID = "22222222-2222-4222-8222-222222222222";
const KNOWN_PAYER_ID = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  vi.clearAllMocks();
  mockedAuthorizeAction.mockResolvedValue(SESSION);
  mockedWithSession.mockImplementation((_tenantId: string, fn: (db: unknown) => unknown) =>
    fn({}),
  );
});

describe("approveRuleAction / rejectRuleAction — server-side rate limiting", () => {
  it("approveRuleAction returns rate_limited and never reads the row when over budget", async () => {
    mockedAllowRequest.mockResolvedValue(false);

    const result = await approveRuleAction(ROW_ID);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("rate_limited");
    expect(mockedGetAuthoredRule).not.toHaveBeenCalled();
  });

  it("approveRuleAction keys the throttle per tenant+actor", async () => {
    mockedAllowRequest.mockResolvedValue(true);
    mockedGetAuthoredRule.mockResolvedValue(null);

    await approveRuleAction(ROW_ID);

    expect(mockedAllowRequest).toHaveBeenCalledWith(
      `author-approve:${SESSION.tenantId}:${SESSION.userId}`,
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("rejectRuleAction returns rate_limited and never flips status when over budget", async () => {
    mockedAllowRequest.mockResolvedValue(false);

    const result = await rejectRuleAction(ROW_ID);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("rate_limited");
    expect(mockedSetRuleStatus).not.toHaveBeenCalled();
  });

  it("rejectRuleAction keys the throttle per tenant+actor and still runs when under budget", async () => {
    mockedAllowRequest.mockResolvedValue(true);
    mockedSetRuleStatus.mockResolvedValue(true);

    const result = await rejectRuleAction(ROW_ID);

    expect(mockedAllowRequest).toHaveBeenCalledWith(
      `author-reject:${SESSION.tenantId}:${SESSION.userId}`,
      expect.any(Number),
      expect.any(Number),
    );
    expect(result.ok).toBe(true);
    expect(mockedSetRuleStatus).toHaveBeenCalledWith(
      SESSION.tenantId,
      ROW_ID,
      "rejected",
    );
  });
});

describe("draftRuleAction — payer-scope data integrity", () => {
  beforeEach(() => {
    mockedAllowRequest.mockResolvedValue(true);
  });

  it("rejects a payer-scoped draft when payerId is not one of the tenant's payers", async () => {
    mockedGetTenantPayers.mockResolvedValue([
      { id: KNOWN_PAYER_ID, name: "Tawuniya" },
    ]);

    const result = await draftRuleAction(
      "Deny claims missing prior auth",
      "payer",
      "not-a-real-payer-id",
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe("invalid");
    // The gate must reject before the paid AI generation call ever runs.
    expect(mockedAuthorRule).not.toHaveBeenCalled();
  });

  it("proceeds to generation when payerId matches a real tenant payer", async () => {
    mockedGetTenantPayers.mockResolvedValue([
      { id: KNOWN_PAYER_ID, name: "Tawuniya" },
    ]);
    mockedAuthorRule.mockResolvedValue({
      draft: {
        name: "r",
        severity: "warn",
        field: "f",
        message_en: "en",
        message_ar: "ar",
        weight: 1,
        conditions: {},
        rationale: "because",
      },
      promptSha256: "sha",
      model: "model",
    });
    mockedLoadApprovedAuthoredRules.mockResolvedValue([]);
    mockedValidateAuthoredRule.mockResolvedValue({
      ok: false,
      stage: "shape",
      errors: ["nope"],
    });

    const result = await draftRuleAction(
      "Deny claims missing prior auth",
      "payer",
      KNOWN_PAYER_ID,
    );

    expect(mockedAuthorRule).toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(result.gate?.ok).toBe(false);
  });

  it("does not check payer membership for global-scoped drafts", async () => {
    mockedAuthorRule.mockResolvedValue({
      draft: {
        name: "r",
        severity: "warn",
        field: "f",
        message_en: "en",
        message_ar: "ar",
        weight: 1,
        conditions: {},
        rationale: "because",
      },
      promptSha256: "sha",
      model: "model",
    });
    mockedLoadApprovedAuthoredRules.mockResolvedValue([]);
    mockedValidateAuthoredRule.mockResolvedValue({
      ok: false,
      stage: "shape",
      errors: ["nope"],
    });

    const result = await draftRuleAction(
      "Deny claims missing prior auth",
      "global",
    );

    expect(mockedGetTenantPayers).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });
});
