// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { EobReviewRow } from "@/lib/eob-review-data";
import enMessages from "@/messages/en.json";

// Criterion 4: a 'processing' row (extraction still running in `after()`) must
// render a distinct, recognizable state in the review queue — not a blank row
// and not the "Unreadable" failure badge (it isn't unreadable, just not ready).

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

vi.mock("@/lib/actions/eob-review", () => ({
  approveEobExtractionAction: vi.fn(),
  rejectEobExtractionAction: vi.fn(),
}));

import { EobReviewQueue } from "@/components/modules/eob-review-queue";

// This suite's setup has no auto-cleanup between tests, so each render
// accumulates in the same jsdom document — unmount between tests so the
// second test's role/name query doesn't hit duplicate elements.
afterEach(() => {
  cleanup();
});

function makeRow(overrides: Partial<EobReviewRow> = {}): EobReviewRow {
  return {
    id: "row-1",
    sourceFilename: "eob.pdf",
    status: "pending_review",
    extraction: null,
    validatorReport: null,
    model: "sonnet",
    escalated: false,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function renderQueue(rows: EobReviewRow[]) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ reviewQueue: enMessages.reviewQueue }}>
      <EobReviewQueue rows={rows} />
    </NextIntlClientProvider>,
  );
}

describe("EobReviewQueue — processing state", () => {
  it("renders a distinct 'Processing' badge for a processing row", () => {
    renderQueue([makeRow({ status: "processing" })]);

    expect(
      screen.getByText(enMessages.reviewQueue.processing),
    ).toBeInTheDocument();
    // Not the failure badge — a processing row is not "unreadable".
    expect(
      screen.queryByText(enMessages.reviewQueue.unreadable),
    ).not.toBeInTheDocument();
  });

  it("disables the Review button while a row is still processing", () => {
    renderQueue([makeRow({ status: "processing" })]);

    const reviewButton = screen.getByRole("button", {
      name: enMessages.reviewQueue.review,
    });
    expect(reviewButton).toBeDisabled();
  });
});
