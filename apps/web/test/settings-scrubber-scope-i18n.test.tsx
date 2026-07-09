// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import enMessages from "@/messages/en.json";
import arMessages from "@/messages/ar.json";
import type { AppSession } from "@/lib/session";

// Regression test (CONFIRMED WCAG AA finding, manual-visual): the "Scrubber
// rules" tab's table header row rendered `<TH>Scope</TH>` as a hardcoded
// English literal while every sibling header (`ts("ruleLabel")`,
// `ts("severity")`, `ts("version")`) routed through next-intl. In the /ar
// locale this left an untranslated, unlabeled English word inside an
// otherwise fully-Arabic header row (WCAG 3.1.2 Language of Parts — no
// lang="en" span, so a screen reader in Arabic mode would mispronounce it).
// Fixed by adding a "scope" key to the "scrubber" message namespace (en:
// "Scope", ar: "النطاق") and rendering `ts("scope")` like its siblings.
//
// This test drives the real message catalogs (en.json / ar.json) through a
// locale-aware getTranslations stub, so it fails if the header regresses to
// a hardcoded literal or the "scope" key goes missing/untranslated again.

let currentLocale: "en" | "ar" = "en";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));
vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn((locale: string) => {
    currentLocale = locale === "ar" ? "ar" : "en";
  }),
  getTranslations: vi.fn(async (namespace: string) => {
    const messages = currentLocale === "ar" ? arMessages : enMessages;
    const dict = (messages as Record<string, Record<string, string>>)[namespace] ?? {};
    return (key: string) => dict[key] ?? key;
  }),
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
vi.mock("@/components/shell/page-header", () => ({ PageHeader: () => null }));
vi.mock("@/components/modules/rule-authoring", () => ({ RuleAuthoring: () => null }));
// Tabs is a "use client" Radix wrapper that reads useLocale() from a
// NextIntlClientProvider context this test doesn't set up; only the
// "rules" table (rendered by default) is under test, so stub Tabs down to
// plain pass-through markup and keep the real ui/table.tsx (TH renders an
// actual <th>, which is what this finding is about).
vi.mock("@/components/ui/tabs", () => ({
  Tabs: (props: { children?: React.ReactNode }) => <div>{props.children}</div>,
  TabsList: (props: { children?: React.ReactNode }) => <div>{props.children}</div>,
  TabsTrigger: (props: { children?: React.ReactNode }) => <button type="button">{props.children}</button>,
  TabsContent: (props: { value: string; children?: React.ReactNode }) => (
    <div data-tab={props.value}>{props.children}</div>
  ),
}));

import { requireSession } from "@/lib/session";
import { getRules, getAuditLog } from "@/lib/data";
import { getTenantPayers, listAuthoredRules } from "@/lib/rules-data";
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
    role: "owner",
    email: "user@example.com",
    ...overrides,
  };
}

async function renderSettingsRulesTab(locale: "en" | "ar") {
  mockedRequireSession.mockResolvedValue(makeSession());
  mockedGetRules.mockResolvedValue([
    {
      id: "r1",
      message_en: "Missing SBS code",
      message_ar: "رمز SBS مفقود",
      severity: "high",
      scope: "global",
      version: 3,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ] as any);
  mockedGetAuditLog.mockResolvedValue([]);
  mockedGetTenantPayers.mockResolvedValue([]);
  mockedListAuthoredRules.mockResolvedValue([]);

  const element = await SettingsPage({ params: Promise.resolve({ locale }) });
  return render(element);
}

describe("SettingsPage — Scrubber rules table header i18n (Scope column)", () => {
  afterEach(cleanup);

  it("renders the Scope header via t() in English, matching its translated siblings", async () => {
    await renderSettingsRulesTab("en");

    const headerRow = screen.getAllByRole("row")[0];
    const headers = within(headerRow).getAllByRole("columnheader").map((h) => h.textContent);

    expect(headers).toEqual([
      enMessages.scrubber.ruleLabel,
      enMessages.scrubber.severity,
      enMessages.scrubber.scope,
      enMessages.scrubber.version,
    ]);
  });

  it("localizes the Scope header to Arabic, never leaving the hardcoded English literal", async () => {
    await renderSettingsRulesTab("ar");

    const headerRow = screen.getAllByRole("row")[0];
    const headers = within(headerRow).getAllByRole("columnheader").map((h) => h.textContent);

    expect(headers).toEqual([
      arMessages.scrubber.ruleLabel,
      arMessages.scrubber.severity,
      arMessages.scrubber.scope,
      arMessages.scrubber.version,
    ]);
    // Regression guard: the pre-fix bug rendered the literal English word
    // "Scope" here regardless of locale.
    expect(screen.queryByText("Scope")).toBeNull();
  });
});
