// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { ReasonRow } from "@taweed/analytics";

// Regression coverage for a CONFIRMED WCAG 1.1.1 (Non-text Content) finding on
// the /en/analytics "Top denial reasons" (Pareto) chart: it rendered a bare
// recharts SVG with no role, aria-label/aria-labelledby, or figcaption text
// alternative — unlike the sibling TrendLine chart on the same page, which
// correctly implements role=img + aria-labelledby + sr-only figcaption.
// Fixed by applying the identical pattern to Pareto.

vi.mock("recharts", () => ({
  ComposedChart: (props: { children?: React.ReactNode }) => (
    <div>{props.children}</div>
  ),
  ResponsiveContainer: (props: { children?: React.ReactNode }) => (
    <div>{props.children}</div>
  ),
  Bar: () => null,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));

import { Pareto } from "@/components/charts/pareto";

const rows: ReasonRow[] = [
  { code: "TWD-001", label: "Missing pre-auth", count: 40, sar: "120000", cumulativePct: 60 },
  { code: "TWD-002", label: "Eligibility lapsed", count: 20, sar: "40000", cumulativePct: 80 },
];

function renderPareto() {
  return render(
    <div>
      <h3 id="pareto-chart-title">Top denial reasons</h3>
      <Pareto
        rows={rows}
        titleId="pareto-chart-title"
        summary="Bar and cumulative-percentage chart of denial reasons by SAR value, showing a few reasons drive most of the loss. Top reasons: TWD-001 (Missing pre-auth): SAR 120,000, 60% cumulative, TWD-002 (Eligibility lapsed): SAR 40,000, 80% cumulative."
      />
    </div>,
  );
}

describe("Pareto — accessible name and text alternative", () => {
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
    renderPareto();

    // Assert: an AT user reaching this chart gets "img, Top denial reasons"
    // instead of a nameless SVG (previously nothing was announced at all).
    expect(
      screen.getByRole("img", { name: "Top denial reasons" }),
    ).toBeInTheDocument();
  });

  it("renders a visually-hidden text summary carrying the SAR amount and cumulative % per reason", () => {
    // Arrange + Act
    renderPareto();

    // Assert: the text alternative exposes the data the visible adjacent list
    // omits (SAR value + cumulative %), and is reachable by accessible query.
    expect(
      screen.getByText(/SAR 120,000, 60% cumulative/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/SAR 40,000, 80% cumulative/),
    ).toBeInTheDocument();
  });

  it("hides the raw chart markup from assistive tech so stray tick text isn't exposed twice", () => {
    // Arrange + Act
    const { container } = renderPareto();

    // Assert
    const hiddenChart = container.querySelector('[role="img"] [aria-hidden="true"]');
    expect(hiddenChart).not.toBeNull();
  });
});
