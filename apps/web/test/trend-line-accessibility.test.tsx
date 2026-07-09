// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { TrendPoint } from "@taweed/analytics";

// Regression coverage for two CONFIRMED WCAG findings on the /en/analytics
// "Denial trend" chart:
//
// 1. (1.1.1 Non-text Content) TrendLine rendered a bare recharts SVG with no
//    role="img", aria-label, or adjacent text alternative — screen readers
//    got disconnected axis-tick numbers with no indication it was a chart.
//    Fixed by wrapping the chart in role="img" aria-labelledby={the card's
//    own visible title} plus a visually-hidden <figcaption> summary.
// 2. TrendLine animated on mount/update unconditionally, unlike CountUp,
//    which correctly gates on prefers-reduced-motion. Fixed by piping the
//    shared useReducedMotion() hook into `isAnimationActive` on Area/Line.
//
// recharts is mocked here: ResponsiveContainer never renders real children in
// jsdom (it measures 0x0 and needs ResizeObserver), so a real render can't
// observe whether isAnimationActive was actually wired through. Stubbing
// Area/Line to reflect their received props onto the DOM lets the test
// assert the wiring directly instead of trusting recharts' internals.

let matchMediaMatches = false;

vi.mock("recharts", () => ({
  ComposedChart: (props: { children?: React.ReactNode }) => (
    <div>{props.children}</div>
  ),
  ResponsiveContainer: (props: { children?: React.ReactNode }) => (
    <div>{props.children}</div>
  ),
  Area: (props: { isAnimationActive?: boolean }) => (
    <div data-testid="area" data-animation-active={String(props.isAnimationActive)} />
  ),
  Line: (props: { isAnimationActive?: boolean }) => (
    <div data-testid="line" data-animation-active={String(props.isAnimationActive)} />
  ),
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));

import { TrendLine } from "@/components/charts/trend-line";

const points: TrendPoint[] = [
  { period: "2026-02", deniedSar: "50000", recoveredSar: "10000" },
  { period: "2026-07", deniedSar: "42000", recoveredSar: "18000" },
];

function renderTrendLine() {
  return render(
    <div>
      <h3 id="trend-chart-title">Denial trend</h3>
      <TrendLine
        points={points}
        titleId="trend-chart-title"
        summary="Line chart of denied and recovered claims by month, from 2026-02 to 2026-07. Denied: SAR 50,000 in 2026-02, SAR 42,000 in 2026-07. Recovered: SAR 10,000 in 2026-02, SAR 18,000 in 2026-07."
      />
    </div>,
  );
}

describe("TrendLine — accessible name and text alternative", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    // jsdom has no real matchMedia implementation; these tests only care
    // about the static a11y markup, so any stable stub is fine here.
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  it("exposes an accessible name via role=img + aria-labelledby to the visible card title", () => {
    // Arrange + Act
    renderTrendLine();

    // Assert: an AT user reaching this chart gets "img, Denial trend" instead
    // of a nameless SVG.
    expect(screen.getByRole("img", { name: "Denial trend" })).toBeInTheDocument();
  });

  it("renders a visually-hidden text summary describing what the chart shows", () => {
    // Arrange + Act
    renderTrendLine();

    // Assert: the text alternative is reachable by an accessible query (not
    // hidden from the accessibility tree), unlike the old bare SVG.
    expect(
      screen.getByText(/Denied: SAR 50,000 in 2026-02, SAR 42,000 in 2026-07/),
    ).toBeInTheDocument();
  });

  it("hides the raw chart markup from assistive tech so stray tick text isn't exposed twice", () => {
    // Arrange + Act
    const { container } = renderTrendLine();

    // Assert
    const hiddenChart = container.querySelector('[role="img"] [aria-hidden="true"]');
    expect(hiddenChart).not.toBeNull();
  });
});

describe("TrendLine — reduced-motion gating", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    cleanup();
    window.matchMedia = originalMatchMedia;
    matchMediaMatches = false;
  });

  function stubMatchMedia(matches: boolean) {
    matchMediaMatches = matches;
    window.matchMedia = vi.fn().mockReturnValue({
      matches: matchMediaMatches,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  }

  it("disables recharts animation when prefers-reduced-motion: reduce is active", () => {
    // Arrange
    stubMatchMedia(true);

    // Act
    renderTrendLine();

    // Assert: matches CountUp's convention of snapping to the final state.
    expect(screen.getByTestId("area")).toHaveAttribute("data-animation-active", "false");
    expect(screen.getByTestId("line")).toHaveAttribute("data-animation-active", "false");
  });

  it("leaves recharts animation on when the user has no reduced-motion preference", () => {
    // Arrange
    stubMatchMedia(false);

    // Act
    renderTrendLine();

    // Assert
    expect(screen.getByTestId("area")).toHaveAttribute("data-animation-active", "true");
    expect(screen.getByTestId("line")).toHaveAttribute("data-animation-active", "true");
  });
});
