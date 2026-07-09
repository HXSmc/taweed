// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Regression test (manual-visual finding, /en/overview, both themes): the two
// "forward loop" CTA links at the bottom of Overview (ForwardCard, page.tsx)
// used a hand-rolled focus ring (`focus-visible:outline-none
// focus-visible:ring-2 focus-visible:ring-accent`) instead of the shared
// `.focus-ring` utility (app/globals.css) that every other link/button on the
// page uses. Same defect class as the login demo-account button and shell
// controls fixes. Fixed by swapping the inline classes for the shared
// `focus-ring` utility class.

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
// CountUp reads IntersectionObserver/matchMedia, neither available in jsdom —
// stub it to its settled value, same pattern used by other money-* tests.
vi.mock("@/components/money/count-up", () => ({
  CountUp: ({ value, className }: { value: number; className?: string }) => (
    <span className={className}>{value}</span>
  ),
}));

import OverviewPage from "../app/[locale]/(app)/overview/page";

describe("Overview page — ForwardCard focus ring", () => {
  it("uses the shared .focus-ring utility instead of an inline ring-accent focus style", async () => {
    // Arrange + Act: server component — render its resolved element tree.
    render(await OverviewPage({ params: Promise.resolve({ locale: "en" }) }));

    // Assert: both forward-loop CTA links carry the shared utility, not the
    // hand-rolled focus-visible classes.
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveClass("focus-ring");
      expect(link.className).not.toMatch(/focus-visible:ring-2/);
      expect(link.className).not.toMatch(/focus-visible:ring-accent/);
      expect(link.className).not.toMatch(/focus-visible:outline-none/);
    }
  });
});
