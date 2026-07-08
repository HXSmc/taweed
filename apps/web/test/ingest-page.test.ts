import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSession } from "../lib/session";

// Regression test (audit finding): IngestPage used to gate the read path with
// only requireSession() — any authenticated tenant user, of any role — then
// unconditionally fetch and render listPendingEobExtractions (the PHI-adjacent
// EOB extraction queue). Per rbac.ts's MATRIX, "ingest" is "hidden" for owner
// and clinician; the nav rail hides the link, but a direct navigation to
// /[locale]/ingest reached the page anyway because nothing re-checked rbac.ts
// server-side. This test drives the real rbac.ts MATRIX (only session lookup
// and the data fetch are mocked) so it fails if the read-side gate regresses.

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
vi.mock("@/lib/eob-review-data", () => ({
  listPendingEobExtractions: vi.fn(),
}));
// The page's own JSX tree is irrelevant to the RBAC gate under test — stub the
// child components so this test exercises real rbac.ts + control flow only,
// not React rendering (no DOM needed).
vi.mock("@/components/shell/page-header", () => ({ PageHeader: () => null }));
vi.mock("@/components/modules/ingest-panel", () => ({ IngestPanel: () => null }));
vi.mock("@/components/modules/eob-review-queue", () => ({ EobReviewQueue: () => null }));
vi.mock("@/components/ui/tabs", () => ({
  Tabs: (props: { children?: unknown }) => props.children,
  TabsList: (props: { children?: unknown }) => props.children,
  TabsTrigger: (props: { children?: unknown }) => props.children,
  TabsContent: (props: { children?: unknown }) => props.children,
}));

import { requireSession } from "../lib/session";
import { listPendingEobExtractions } from "../lib/eob-review-data";
import IngestPage from "../app/[locale]/(app)/ingest/page";

const mockedRequireSession = vi.mocked(requireSession);
const mockedListPendingEobExtractions = vi.mocked(listPendingEobExtractions);

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

describe("IngestPage — server-enforced RBAC gate on the read path", () => {
  it.each(["owner", "clinician"] as const)(
    "notFound()s and never fetches the EOB queue for role=%s (ingest is hidden per rbac.ts MATRIX)",
    async (role) => {
      // Arrange
      mockedRequireSession.mockResolvedValue(makeSession({ role }));

      // Act + Assert: a direct navigation to /[locale]/ingest must fail closed,
      // exactly like an unknown route, not silently render the queue.
      await expect(
        IngestPage({ params: Promise.resolve({ locale: "en" }) }),
      ).rejects.toThrow("NEXT_NOT_FOUND");
      expect(mockedListPendingEobExtractions).not.toHaveBeenCalled();
    },
  );

  it.each(["finance", "rcm", "admin"] as const)(
    "renders and fetches the EOB queue for role=%s (ingest is not hidden per rbac.ts MATRIX)",
    async (role) => {
      // Arrange
      mockedRequireSession.mockResolvedValue(makeSession({ role }));
      mockedListPendingEobExtractions.mockResolvedValue([]);

      // Act
      await expect(
        IngestPage({ params: Promise.resolve({ locale: "en" }) }),
      ).resolves.toBeTruthy();

      // Assert
      expect(mockedListPendingEobExtractions).toHaveBeenCalledWith(
        "11111111-1111-4111-8111-111111111111",
      );
    },
  );
});
