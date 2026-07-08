import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSession } from "../lib/session";
import type { AppealResult } from "../lib/appeals-data";

// loadAppealDraft's only entitlement/audit-tolerance guarantees come from
// authz.ts (real RBAC gate) + rbac.ts (real MATRIX) — both run for real here.
// Only the session lookup, the DB-backed draft fetch, and the audit write are
// mocked, so this test drives the actual admin/appeals capability boundary
// instead of asserting against a stubbed authorizeAction.
vi.mock("../lib/session", () => ({
  getSession: vi.fn(),
}));
vi.mock("../lib/appeals-data", () => ({
  getAppealDraft: vi.fn(),
}));
vi.mock("../lib/audit", () => ({
  recordPhiAccess: vi.fn(),
}));

import { getSession } from "../lib/session";
import { getAppealDraft } from "../lib/appeals-data";
import { recordPhiAccess } from "../lib/audit";
import { loadAppealDraft } from "../lib/actions/appeals";

const mockedGetSession = vi.mocked(getSession);
const mockedGetAppealDraft = vi.mocked(getAppealDraft);
const mockedRecordPhiAccess = vi.mocked(recordPhiAccess);

function makeSession(overrides: Partial<AppSession> = {}): AppSession {
  return {
    userId: "u1",
    tenantId: "11111111-1111-4111-8111-111111111111",
    tenantName: "Test Tenant",
    role: "owner",
    email: "owner@example.com",
    ...overrides,
  };
}

const DRAFT: AppealResult = {
  context: {
    claimId: "CLM-1",
    nphiesClaimId: null,
    sbsCode: null,
    denialCode: "TWD-D01",
    denialCategory: "Service not covered by plan",
    payerName: "Tawuniya",
    providerName: "Test Provider",
    memberId: "M-1",
    atRiskSar: "1500.00",
    serviceDate: "2026-01-01",
  },
  draft: {
    subject_en: "Appeal",
    body_en: "Body",
    subject_ar: "استئناف",
    body_ar: "نص",
    docChecklist: [],
    payerSpecific: false,
  },
  pdfEn: { locale: "en", title: "Appeal", blocks: [] },
  pdfAr: { locale: "ar", title: "استئناف", blocks: [] },
  reasonLabel: "Service not covered by plan",
  deniedSar: "1500.00",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loadAppealDraft — admin cannot read the PHI appeal letter", () => {
  it("returns null and never fetches the draft when the session role is admin", async () => {
    // Arrange: admin's appeals capability is "read" per rbac.ts MATRIX, which
    // must NOT be enough to load the full bilingual PHI letter (pdfEn/pdfAr).
    mockedGetSession.mockResolvedValue(makeSession({ role: "admin" }));

    // Act
    const result = await loadAppealDraft("denial-1");

    // Assert: fails closed before ever touching PHI, and never records a read
    // (there is nothing to audit — the fetch must not happen at all).
    expect(result).toBeNull();
    expect(mockedGetAppealDraft).not.toHaveBeenCalled();
    expect(mockedRecordPhiAccess).not.toHaveBeenCalled();
  });

  it("returns the draft for an appeal-capable role (owner)", async () => {
    // Arrange
    mockedGetSession.mockResolvedValue(makeSession({ role: "owner" }));
    mockedGetAppealDraft.mockResolvedValue(DRAFT);

    // Act
    const result = await loadAppealDraft("denial-1");

    // Assert
    expect(result).toEqual(DRAFT);
    expect(mockedGetAppealDraft).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      "denial-1",
    );
  });
});

describe("loadAppealDraft — an audit-write failure must not discard a successful fetch", () => {
  it("still returns the draft when recordPhiAccess rejects", async () => {
    // Arrange: the draft fetch succeeds; the audit write is the thing that fails
    // (e.g. a transient DB error writing the audit_logs row).
    mockedGetSession.mockResolvedValue(makeSession({ role: "owner" }));
    mockedGetAppealDraft.mockResolvedValue(DRAFT);
    mockedRecordPhiAccess.mockRejectedValue(new Error("transient audit db error"));

    // Act
    const result = await loadAppealDraft("denial-1");

    // Assert: the entitled fetch is not discarded just because the audit
    // write hiccupped.
    expect(result).toEqual(DRAFT);
  });

  it("still returns null when the draft fetch itself fails", async () => {
    // Arrange: this is the case the surrounding try/catch IS meant to guard —
    // a genuine fetch failure, not an audit hiccup.
    mockedGetSession.mockResolvedValue(makeSession({ role: "owner" }));
    mockedGetAppealDraft.mockRejectedValue(new Error("db unavailable"));

    // Act
    const result = await loadAppealDraft("denial-1");

    // Assert
    expect(result).toBeNull();
    expect(mockedRecordPhiAccess).not.toHaveBeenCalled();
  });
});
