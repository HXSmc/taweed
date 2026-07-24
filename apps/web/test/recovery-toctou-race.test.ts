import { describe, test, expect, vi, beforeEach } from "vitest";

// GATED money/PHI finding (not fixed here per policy): markAppealOutcome has a
// TOCTOU race. It reads the sibling-appeals "already recovered" sum and writes
// the new recovered_amount in the same READ-COMMITTED transaction with no row
// lock or advisory lock — unlike the analogous fix already applied in
// onboarding.ts (`SELECT pg_advisory_xact_lock(hashtext(tenantId))`).
//
// Scenario: a denial D (denied_amount = 1000 SAR) has two appeal rows A1 and
// A2 (e.g. an original appeal plus a resubmission). Two calls to
// markAppealOutcome(A1, "won") and markAppealOutcome(A2, "won") run
// concurrently (two staff acting at once, or a double-submit). Both
// transactions execute the appeal/denial lookup and the sibling-sum query
// before either commits, so both see alreadyRecoveredSar = 0 and both compute
// a clamped recoveredSar up to the full 1000 SAR via resolveRecovery. Both
// UPDATE and COMMIT, leaving recovered_amount ~= 1000 on EACH of A1 and A2 —
// a total of ~2000 SAR recovered against a single 1000 SAR denial, breaking
// the "recovered can never exceed appealed / no double-booking" invariant the
// code comments explicitly claim to guarantee.
//
// This test documents the bug via test.fails(): it is EXPECTED to fail until
// a row lock / advisory lock is added around the read-then-write, mirroring
// onboarding.ts. Do not "fix" this test by loosening the assertion — that
// would silently hide the race. Source logic is intentionally left unchanged
// (money/PHI-path finding gated for human review).

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

// Deliberately NOT mocked: @taweed/analytics — the real resolveRecovery must
// run so the clamp math reflects production behavior, not a stub.

vi.mock("@taweed/audit", () => ({
  logAudit: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/money", () => ({ SAR_MONEY_REGEX: /^\d+(\.\d{1,2})?$/ }));

import { markAppealOutcome } from "../lib/actions/recovery";

const SESSION = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  userId: "user-1",
  email: "rcm@example.com",
  role: "rcm",
};

const DENIAL_ID = "33333333-3333-4333-8333-333333333333";
const APPEAL_A1 = "22222222-2222-4222-8222-222222222222";
const APPEAL_A2 = "44444444-4444-4444-8444-444444444444";

// Simulates one independent READ-COMMITTED transaction: its own SELECT of the
// denial + its own SELECT of the sibling-recovered sum, both of which run
// BEFORE either transaction's UPDATE commits — so every transaction observes
// alreadyRecoveredSar = 0, regardless of what a "concurrent" sibling call is
// doing at the same time. This is exactly the race the missing lock allows.
function makeRacingFakeDb() {
  let call = 0;
  return {
    execute: vi.fn(async () => {
      call += 1;
      if (call === 1) {
        return {
          rows: [{ denied_amount: "1000.00", denial_id: DENIAL_ID }],
        };
      }
      // No commit from the sibling transaction is visible yet.
      return { rows: [{ already_recovered: "0" }] };
    }),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedAuthorizeAction.mockResolvedValue(SESSION);
  mockedAllowRequest.mockResolvedValue(true);
  // Each call gets its own fake "transaction" — mirrors two real DB
  // connections/transactions racing against the same rows.
  mockedWithSession.mockImplementation(
    async (_tenantId: string, cb: (db: unknown) => unknown) =>
      cb(makeRacingFakeDb()),
  );
});

describe("markAppealOutcome — TOCTOU race on sibling-recovered sum (GATED, unfixed)", () => {
  test.fails(
    "does not let two concurrently-won sibling appeals double-book recovery past the denied ceiling",
    async () => {
      // Act: two staff mark sibling appeals A1 and A2 (same denial) won at
      // the same time.
      const [r1, r2] = await Promise.all([
        markAppealOutcome(APPEAL_A1, "won"),
        markAppealOutcome(APPEAL_A2, "won"),
      ]);

      expect(r1.ok).toBe(true);
      expect(r2.ok).toBe(true);

      const total =
        Number.parseFloat(r1.recoveredSar ?? "0") +
        Number.parseFloat(r2.recoveredSar ?? "0");

      // The invariant the code comments claim: recovered across all sibling
      // appeals on one denial can never exceed the denied amount (1000 SAR).
      // Without a row/advisory lock this fails — both transactions see
      // alreadyRecoveredSar = 0 and each independently recovers the full
      // 1000 SAR, for a double-booked total of ~2000 SAR.
      expect(total).toBeLessThanOrEqual(1000);
    },
  );
});
