import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression coverage for the finding: ingestBundle (FHIR bundle upload) had
// no cap on the number of claim/response pairs a single bundle could carry.
// Without a ceiling, an authorized actor could upload a bundle with an
// unbounded number of pairs and drive an unbounded sequential, awaited
// per-pair DB insert loop (lib/actions/ingest.ts). Mirrors the MAX_UPLOAD_ROWS
// pattern on the CSV ingest path (apps/web/lib/actions/ingest-csv.ts): reject
// outright with a clear error before the per-pair loop runs, never silently
// truncate.

const mockedAuthorizeAction = vi.fn();
vi.mock("@/lib/authz", () => ({
  authorizeAction: (...args: unknown[]) => mockedAuthorizeAction(...args),
}));

const mockedAllowRequest = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  allowRequest: (...args: unknown[]) => mockedAllowRequest(...args),
}));

// select() is called four times in a fixed order inside resolveFirstDimensions
// (branch, provider, payer, patient) — mirrors ingest-csv.test.ts's fakeDb so
// the real insertNormalizedClaim/resolveFirstDimensions code paths run
// against a stub drizzle-shaped db instead of a live one.
let selectQueue: unknown[][] = [];
function fakeDb() {
  return {
    select: () => ({
      from: () => ({
        orderBy: () => ({
          limit: () => Promise.resolve(selectQueue.shift() ?? []),
        }),
      }),
    }),
    insert: () => ({ values: () => Promise.resolve() }),
  };
}

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

const FULL_DIMS: unknown[][] = [
  [{ id: "branch-1", name: "Riyadh" }],
  [{ id: "provider-1", name: "Dr A" }],
  [{ id: "payer-1", name: "Bupa" }],
  [{ id: "patient-1", pseudonym: "PT-1" }],
];

/** A minimal-but-valid { Claim, ClaimResponse } pair, indexed so every pair
 *  in a bundle has a distinct id and the ClaimResponse resolves to its own
 *  Claim via request.reference (mirrors packages/fhir/test/parse.test.ts's
 *  fixture shape). total.value is set so requiredAmountIssue never quarantines
 *  it — these tests are about the pair-count cap, not per-claim validation. */
function claimAndResponse(i: number): unknown[] {
  const claim = {
    resourceType: "Claim",
    id: `c${i}`,
    status: "active",
    type: { coding: [{ code: "institutional" }] },
    use: "claim",
    patient: { reference: "Patient/p1" },
    created: "2026-01-01",
    provider: { reference: "Organization/o1" },
    priority: { coding: [{ code: "normal" }] },
    insurance: [
      { sequence: 1, focal: true, coverage: { reference: "Coverage/cov1" } },
    ],
    total: { value: 100, currency: "SAR" },
  };
  const claimResponse = {
    resourceType: "ClaimResponse",
    id: `r${i}`,
    status: "active",
    type: { coding: [{ code: "institutional" }] },
    use: "claim",
    patient: { reference: "Patient/p1" },
    created: "2026-01-02",
    insurer: { reference: "Organization/payer1" },
    outcome: "complete",
    request: { reference: `Claim/c${i}` },
  };
  return [claim, claimResponse];
}

function bundleWithPairs(pairCount: number): Record<string, unknown> {
  const resources = Array.from({ length: pairCount }, (_, i) => claimAndResponse(i)).flat();
  return {
    resourceType: "Bundle",
    type: "collection",
    entry: resources.map((resource) => ({ resource })),
  };
}

function bundleFormData(bundle: unknown): FormData {
  const fd = new FormData();
  fd.set(
    "file",
    new File([JSON.stringify(bundle)], "bundle.json", { type: "application/json" }),
  );
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  selectQueue = [];
  mockedAuthorizeAction.mockResolvedValue(SESSION);
  mockedAllowRequest.mockResolvedValue(true);
  mockedWithSession.mockImplementation((_tenantId: string, cb: (db: unknown) => unknown) =>
    cb(fakeDb()),
  );
});

describe("ingestBundle — MAX_BUNDLE_PAIRS cap", () => {
  it("rejects a bundle over the cap with a clear error before the per-pair insert loop runs", async () => {
    selectQueue = [...FULL_DIMS];
    const overCap = bundleWithPairs(501);

    const result = await ingestBundle(bundleFormData(overCap));

    expect(result.ok).toBe(false);
    expect(result.error).toBe("bundle has too many claims to import");
    // No claims were processed — the cap check runs before the per-pair loop.
    expect(result.claims).toBe(0);
    expect(result.quarantined).toEqual([]);
    // withSession was only reached once, for resolveFirstDimensions — the
    // 501-iteration per-pair insert loop never started.
    expect(mockedWithSession).toHaveBeenCalledTimes(1);
  });

  it("still ingests a bundle exactly at the cap", async () => {
    selectQueue = [...FULL_DIMS];
    const atCap = bundleWithPairs(500);

    const result = await ingestBundle(bundleFormData(atCap));

    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.claims).toBe(500);
    expect(result.quarantined).toEqual([]);
  }, 20_000);
});
