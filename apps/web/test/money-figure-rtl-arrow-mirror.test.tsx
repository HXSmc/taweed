// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Regression test (axe:manual-visual finding, /ar/recovery RTL, both themes):
// MoneyFigure's atRisk/neutral arrow and MoneyIndicator's at-risk arrow both
// rendered a bare lucide `ArrowRight` with no `rtl:rotate-180`, unlike the
// identical icon in app/[locale]/(app)/overview/page.tsx:87 which is mirrored
// for RTL. On /ar/* pages the arrow kept pointing in the LTR "forward"
// direction, contradicting the surrounding mirrored layout. Fix: apply
// `rtl:rotate-180` to both usages, matching the overview/page.tsx pattern.
// The `recovered` tone (TrendingUp) must NOT be mirrored — rotating a
// trending-up glyph 180deg would visually invert it into trending-down.

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// CountUp reads IntersectionObserver/matchMedia, neither available in jsdom —
// stub it to its settled value, same pattern used by other money-* tests.
vi.mock("@/components/money/count-up", () => ({
  CountUp: ({ value, className }: { value: number; className?: string }) => (
    <span className={className}>{value}</span>
  ),
}));

import { MoneyFigure } from "@/components/money/money-figure";
import { MoneyIndicator } from "@/components/shell/money-indicator";

describe("MoneyFigure — RTL arrow mirroring", () => {
  afterEach(cleanup);

  it("mirrors the arrow for the atRisk tone", () => {
    const { container } = render(<MoneyFigure value={1000} tone="atRisk" />);
    const icon = container.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveClass("rtl:rotate-180");
  });

  it("mirrors the arrow for the neutral tone", () => {
    const { container } = render(<MoneyFigure value={1000} tone="neutral" />);
    const icon = container.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveClass("rtl:rotate-180");
  });

  it("does not mirror the recovered tone's TrendingUp icon", () => {
    const { container } = render(<MoneyFigure value={1000} tone="recovered" />);
    const icon = container.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).not.toHaveClass("rtl:rotate-180");
  });
});

describe("MoneyIndicator — RTL arrow mirroring", () => {
  afterEach(cleanup);

  it("mirrors the at-risk figure's ArrowRight icon", () => {
    render(<MoneyIndicator recovered={66275} atRisk={131850} scopeLabel="All branches" />);
    const atRiskValue = screen.getByText("131850");
    const icon = atRiskValue.parentElement?.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveClass("rtl:rotate-180");
  });

  it("does not mirror the recovered figure's TrendingUp icon", () => {
    render(<MoneyIndicator recovered={66275} atRisk={131850} scopeLabel="All branches" />);
    const recoveredValue = screen.getByText("66275");
    const icon = recoveredValue.parentElement?.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).not.toHaveClass("rtl:rotate-180");
  });
});
