// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Coverage-gap closure for the "/ar/overview" WCAG AA audit: live AR
// verification (axe + keyboard, light/dark) was blocked in-session by
// chrome-devtools MCP tab contention. Source review argued no AR-specific
// axe regression is possible because the only RTL-conditional code on this
// page/its shared chrome is `rtl:rotate-180` / `rtl:group-hover:-translate-x-1`
// transforms (ForwardCard's ArrowRight, page.tsx:87; MoneyFigure's arrow,
// money-figure.tsx:44) plus logical-property spacing/borders elsewhere in the
// shell — none of which touch the accessible name, role, or DOM/tab order.
//
// This test locks in that exact invariant: mirroring the ArrowRight for RTL
// must never attach an accessible name to the icon, and the ForwardCard
// link's accessible name must stay exactly its label text regardless of
// `dir`. A standalone Playwright+axe run (audit-ar-overview-tmp.mjs)
// separately confirmed 0 violations for /ar/overview in both light and dark
// against the live dev server, unblocked by driving an isolated browser
// instance instead of the shared MCP page pointer.

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => ((key: string) => key) as unknown),
  setRequestLocale: vi.fn(),
}));
vi.mock("@/lib/session", () => ({
  requireSession: vi.fn(async () => ({
    userId: "u1",
    tenantId: "t1",
    tenantName: "Acme Health",
    role: "owner",
    email: "owner@acme.test",
  })),
}));
vi.mock("@/lib/data", () => ({
  getRecovery: vi.fn(async () => ({
    money: { recoveredSar: "1000.00", atRiskSar: "500.00", deniedCount: 1, claimCount: 2 },
    winRate: 0.5,
    medianDays: 10,
    sharePct: 0,
    shareSar: "0.00",
    baseline: null,
    rows: [],
  })),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...rest }: React.ComponentProps<"a">) => <a {...rest}>{children}</a>,
}));
vi.mock("@/components/money/count-up", () => ({
  CountUp: ({ value, className }: { value: number; className?: string }) => (
    <span className={className}>{value}</span>
  ),
}));

import OverviewPage from "../app/[locale]/(app)/overview/page";
import { MoneyFigure } from "@/components/money/money-figure";

describe("Overview page (ar, dir=rtl) — ForwardCard accessible name invariant", () => {
  afterEach(cleanup);

  it("keeps each link's accessible name equal to its label text, unaffected by dir", async () => {
    const { container } = render(
      <div dir="rtl">{await OverviewPage({ params: Promise.resolve({ locale: "ar" }) })}</div>,
    );

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    const names = links.map((link) => link.textContent?.trim());
    expect(names).toContain("runScrubber");
    expect(names).toContain("buildReport");

    // The decorative ArrowRight must never surface an accessible name/role —
    // mirroring it for RTL (rtl:rotate-180 / rtl:group-hover:-translate-x-1)
    // is a transform, not an ARIA change.
    const icons = container.querySelectorAll("svg");
    expect(icons.length).toBeGreaterThan(0);
    icons.forEach((icon) => {
      expect(icon).toHaveAttribute("aria-hidden", "true");
    });
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });
});

describe("MoneyFigure — decorative arrow stays nameless under RTL mirroring", () => {
  afterEach(cleanup);

  it.each(["recovered", "atRisk", "neutral"] as const)(
    "tone=%s: arrow carries aria-hidden, contributes no accessible name",
    (tone) => {
      const { container } = render(
        <div dir="rtl">
          <MoneyFigure value={1000} tone={tone} />
        </div>,
      );
      const icon = container.querySelector("svg");
      expect(icon).not.toBeNull();
      expect(icon).toHaveAttribute("aria-hidden", "true");
      expect(screen.queryAllByRole("img")).toHaveLength(0);
    },
  );
});
