import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSession } from "../lib/session";

// Regression test (audit finding): SettingsPage used to gate the read path
// with only requireSession() — any authenticated tenant user, of any role —
// then unconditionally fetch and render getRules() (full scrubber rule
// library) and getAuditLog() (full tenant audit log). Per rbac.ts's MATRIX,
// "settings" is "hidden" for clinician; canAuthor only ever gated the AI-3
// rule-authoring sub-panel, never the page itself, so a direct navigation to
// /[locale]/settings still reached the Rules and Audit tabs. This test
// drives the real rbac.ts MATRIX (only session lookup and data fetches are
// mocked) so it fails if the read-side gate regresses. Same bug class
// already fixed for the ingest page (see ingest-page.test.ts).

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => ((key: string) => key) as unknown),
  setRequestLocale: vi.fn(),
}));
vi.mock("@/lib/session", () => ({
  requireSession: vi.fn(),
}));
vi.mock("@/lib/data", () => ({
  getRules: vi.fn(),
  getAuditLog: vi.fn(),
}));
vi.mock("@/lib/rules-data", () => ({
  getTenantPayers: vi.fn(),
  listAuthoredRules: vi.fn(),
}));
// The page's own JSX tree is irrelevant to the RBAC gate under test — stub
// the child components so this test exercises real rbac.ts + control flow
// only, not React rendering (no DOM needed).
vi.mock("@/components/shell/page-header", () => ({ PageHeader: () => null }));
vi.mock("@/components/modules/rule-authoring", () => ({ RuleAuthoring: () => null }));
vi.mock("@/components/ui/card", () => ({
  Card: (props: { children?: unknown }) => props.children,
  CardContent: (props: { children?: unknown }) => props.children,
}));
vi.mock("@/components/ui/badge", () => ({ Badge: (props: { children?: unknown }) => props.children }));
vi.mock("@/components/ui/tabs", () => ({
  Tabs: (props: { children?: unknown }) => props.children,
  TabsList: (props: { children?: unknown }) => props.children,
  TabsTrigger: (props: { children?: unknown }) => props.children,
  TabsContent: (props: { children?: unknown }) => props.children,
}));
vi.mock("@/components/ui/table", () => ({
  TableWrap: (props: { children?: unknown }) => props.children,
  Table: (props: { children?: unknown }) => props.children,
  THead: (props: { children?: unknown }) => props.children,
  TBody: (props: { children?: unknown }) => props.children,
  TR: (props: { children?: unknown }) => props.children,
  TH: (props: { children?: unknown }) => props.children,
  TD: (props: { children?: unknown }) => props.children,
}));

import { requireSession } from "../lib/session";
import { getRules, getAuditLog } from "../lib/data";
import { getTenantPayers, listAuthoredRules } from "../lib/rules-data";
import SettingsPage from "../app/[locale]/(app)/settings/page";

const mockedRequireSession = vi.mocked(requireSession);
const mockedGetRules = vi.mocked(getRules);
const mockedGetAuditLog = vi.mocked(getAuditLog);
const mockedGetTenantPayers = vi.mocked(getTenantPayers);
const mockedListAuthoredRules = vi.mocked(listAuthoredRules);

function makeSession(overrides: Partial<AppSession> = {}): AppSession {
  return {
    userId: "u1",
    tenantId: "11111111-1111-4111-8111-111111111111",
    tenantName: "Test Tenant",
    role: "finance",
    email: "user@example.com",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SettingsPage — server-enforced RBAC gate on the read path", () => {
  it("notFound()s and never fetches rules or the audit log for role=clinician (settings is hidden per rbac.ts MATRIX)", async () => {
    // Arrange
    mockedRequireSession.mockResolvedValue(makeSession({ role: "clinician" }));

    // Act + Assert: a direct navigation to /[locale]/settings must fail
    // closed, not silently render the rule library or tenant audit log.
    await expect(
      SettingsPage({ params: Promise.resolve({ locale: "en" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockedGetRules).not.toHaveBeenCalled();
    expect(mockedGetAuditLog).not.toHaveBeenCalled();
    expect(mockedGetTenantPayers).not.toHaveBeenCalled();
    expect(mockedListAuthoredRules).not.toHaveBeenCalled();
  });

  it.each(["owner", "finance", "rcm", "admin"] as const)(
    "renders and fetches rules + audit log for role=%s (settings is not hidden per rbac.ts MATRIX)",
    async (role) => {
      // Arrange
      mockedRequireSession.mockResolvedValue(makeSession({ role }));
      mockedGetRules.mockResolvedValue([]);
      mockedGetAuditLog.mockResolvedValue([]);
      mockedGetTenantPayers.mockResolvedValue([]);
      mockedListAuthoredRules.mockResolvedValue([]);

      // Act
      await expect(
        SettingsPage({ params: Promise.resolve({ locale: "en" }) }),
      ).resolves.toBeTruthy();

      // Assert
      expect(mockedGetRules).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
      expect(mockedGetAuditLog).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
    },
  );
});
