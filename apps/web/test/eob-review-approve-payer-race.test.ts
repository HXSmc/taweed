import { describe, test, expect, vi, beforeEach } from "vitest";

// GATED money/PHI bug (documented, not fixed here — see
// docs handoff / task instructions): approveEobExtractionAction's payer
// find-or-create (resolveDimension, packages/ingest/src/dimensions.ts) races.
// Two concurrent approvals for a brand-new payer name can each SELECT the
// existing payers list before either has committed its INSERT, so both get
// payerMatch.create === true and both INSERT a new payers row for the same
// name — because payers has no unique constraint on (tenant_id, name).
//
// This test reproduces the exact scenario the bug report names: two pending
// EOB extraction rows for the SAME tenant, both referencing a payer name
// never seen before (e.g. two remittance PDFs from the same new payer
// uploaded back-to-back), approved concurrently. It uses a real find-or-
// create call (resolveDimension is NOT mocked here) against a fake
// transactional db whose payer SELECT is gated behind a two-arrival barrier,
// so both concurrent calls deterministically observe the SAME pre-insert
// snapshot (empty) — exactly what read-committed isolation would show for
// two still-open, uncommitted transactions.
//
// Per policy: do NOT change source logic for a GATED bug. This file adds
// ONLY a red regression test (test.fails) that documents the failure without
// altering apps/web/lib/actions/eob-review.ts or packages/ingest.

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

const mockedFlipEobExtractionApprovedTx = vi.fn();
vi.mock("@/lib/eob-review-data", () => ({
  getEobExtraction: vi.fn(),
  flipEobExtractionApprovedTx: (...args: unknown[]) =>
    mockedFlipEobExtractionApprovedTx(...args),
  rejectEobExtractionRow: vi.fn(),
}));

vi.mock("@/lib/eob-to-normalized", () => ({
  buildNormalizedClaimsFromEob: vi.fn(() => []),
}));

// Deliberately real: no vi.mock("@taweed/ingest", ...) here — the whole point
// is to exercise the REAL resolveDimension find-or-create logic under a race,
// not a stubbed one.

vi.mock("@taweed/db", () => ({
  schema: {
    payers: { __table: "payers" },
    branches: { __table: "branches" },
    providers: { __table: "providers" },
    patients: { __table: "patients" },
  },
  insertNormalizedClaim: vi.fn(),
}));

vi.mock("@taweed/audit", () => ({
  logAudit: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { schema } from "@taweed/db";
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

const NEW_PAYER_NAME = "Brand New Payer Co";

function balancedPayload(claimId: string): EditedEobExtractionInput {
  return {
    payerName: NEW_PAYER_NAME,
    payerNphiesId: null,
    remittanceDate: null,
    remittanceTotalPaidSar: "50.00",
    overallConfidence: 1,
    claims: [
      {
        claimId,
        nphiesClaimId: null,
        patientRef: null,
        serviceDate: null,
        confidence: 1,
        totalBilledSar: "50.00",
        totalPaidSar: "50.00",
        totalRejectedSar: "0.00",
        totalAdjustmentSar: "0.00",
        lines: [
          {
            claimLineRef: "line-1",
            sbsCode: null,
            icd10amCode: null,
            billedSar: "50.00",
            paidSar: "50.00",
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
}

interface PayerRow {
  id: string;
  name: string;
}

/** Builds a fake transactional db whose payers SELECT is gated behind a
 *  two-arrival barrier: it only resolves once TWO concurrent calls have
 *  reached it, and both then resolve with the SAME snapshot taken at that
 *  moment — modeling two still-open, uncommitted transactions under
 *  read-committed isolation where neither sees the other's pending insert. */
function createRaceHarness() {
  const payersTable: PayerRow[] = [];
  let arrivals = 0;
  let releasers: Array<() => void> = [];

  function gatedSelectPayers(): Promise<PayerRow[]> {
    return new Promise((resolve) => {
      arrivals += 1;
      releasers.push(() => resolve([...payersTable]));
      if (arrivals === 2) {
        const toRelease = releasers;
        releasers = [];
        arrivals = 0;
        for (const release of toRelease) release();
      }
    });
  }

  const fakeDb = {
    select() {
      return {
        from(table: unknown) {
          if (table === schema.payers) {
            return { orderBy: () => gatedSelectPayers() };
          }
          if (table === schema.branches) {
            return { orderBy: () => ({ limit: () => Promise.resolve([{ id: "branch-1" }]) }) };
          }
          if (table === schema.providers) {
            return { orderBy: () => ({ limit: () => Promise.resolve([{ id: "provider-1" }]) }) };
          }
          if (table === schema.patients) {
            return { orderBy: () => ({ limit: () => Promise.resolve([{ id: "patient-1" }]) }) };
          }
          throw new Error("createRaceHarness: unexpected select().from() table");
        },
      };
    },
    insert(table: unknown) {
      if (table !== schema.payers) {
        throw new Error("createRaceHarness: unexpected insert() table");
      }
      return {
        values(row: { name: string }) {
          return {
            returning: () => {
              const id = `payer-${payersTable.length + 1}`;
              payersTable.push({ id, name: row.name });
              return Promise.resolve([{ id }]);
            },
          };
        },
      };
    },
  };

  return { fakeDb, payersTable };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedAuthorizeAction.mockResolvedValue(SESSION);
  mockedAllowRequest.mockResolvedValue(true);
  mockedFlipEobExtractionApprovedTx.mockResolvedValue(true);
});

describe("approveEobExtractionAction — concurrent new-payer approvals (GATED, documents a known bug)", () => {
  // Expected policy: ok=true, ok=true.
  test.fails(
    "two concurrent approvals for a brand-new payer name should create exactly one payer row, not two",
    async () => {
      const { fakeDb, payersTable } = createRaceHarness();
      mockedWithSession.mockImplementation((_tenantId: string, cb: (db: unknown) => unknown) =>
        cb(fakeDb),
      );

      const [resultA, resultB] = await Promise.all([
        approveEobExtractionAction("row-1", balancedPayload("claim-1")),
        approveEobExtractionAction("row-2", balancedPayload("claim-2")),
      ]);

      expect(resultA).toEqual({ ok: true });
      expect(resultB).toEqual({ ok: true });

      const newPayerRows = payersTable.filter((p) => p.name === NEW_PAYER_NAME);
      // BUG: today this is 2 — both concurrent calls read the payers table
      // before either committed its insert, so both create a duplicate
      // payer row for the same never-seen-before name. This assertion
      // documents the correct invariant and is expected to fail until the
      // find-or-create is made race-safe (e.g. a unique constraint on
      // (tenant_id, name) plus an upsert/ON CONFLICT insert).
      expect(newPayerRows).toHaveLength(1);
    },
  );
});
