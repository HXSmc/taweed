// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";

// Regression test (axe:color-contrast finding, derived from the shared
// Badge — accent variant fix): the review-queue "High confidence" chip
// (ConfidenceBadge, confidence-badge.tsx) renders its "high" tier via
// `Badge variant="accent"`. That variant paired `bg-accent-subtle` with
// `text-accent`, which drops to ~2.6:1 in dark theme because `--accent-subtle`
// is retuned darker for `.dark` while `--accent` itself is not (app/globals.css).
// badge.tsx now carries a `dark:bg-accent dark:text-accent-fg` override for
// the accent variant (~5.9:1 AA), and this asserts the review queue's own
// "High" badge inherits it — not just the Badge component in isolation.

import { ConfidenceBadge } from "@/components/modules/eob-review/confidence-badge";

function renderBadge(value: number) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ reviewQueue: enMessages.reviewQueue }}>
      <ConfidenceBadge value={value} />
    </NextIntlClientProvider>,
  );
}

describe("ConfidenceBadge — dark-theme contrast", () => {
  it("high tier carries the dark: solid-fill accent override", () => {
    renderBadge(0.9);
    const el = screen.getByText(enMessages.reviewQueue.confidenceHigh);

    // Light theme pairing stays present.
    expect(el).toHaveClass("bg-accent-subtle");
    expect(el).toHaveClass("text-accent");

    // Dark-theme override swaps to the solid accent fill so the "High
    // confidence" chip stays AA once `.dark` is active.
    expect(el).toHaveClass("dark:bg-accent");
    expect(el).toHaveClass("dark:text-accent-fg");
  });

  it("medium and low tiers do not use the accent variant (unaffected by the finding)", () => {
    renderBadge(0.7);
    const med = screen.getByText(enMessages.reviewQueue.confidenceMed);
    expect(med).not.toHaveClass("bg-accent-subtle");

    renderBadge(0.3);
    const low = screen.getByText(enMessages.reviewQueue.confidenceLow);
    expect(low).not.toHaveClass("bg-accent-subtle");
  });
});
