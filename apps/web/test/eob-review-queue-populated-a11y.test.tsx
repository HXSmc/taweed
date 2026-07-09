// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { EobExtraction } from "@taweed/ai";
import type { EobReviewRow } from "@/lib/eob-review-data";
import enMessages from "@/messages/en.json";
import arMessages from "@/messages/ar.json";

// Coverage-gap closure (docs/review.md manual-visual finding on
// /en/ingest and /ar/ingest, Review-queue tab): a prior audit pass could not
// exercise the POPULATED Review-queue tab live — the audited tenant had 0
// pending eob_extractions rows (so the tab only ever rendered its empty
// state) and heavy multi-agent browser contention prevented forcing Radix's
// Tabs control into the "review" panel via synthetic clicks. That session's
// source read confirmed the fixes below were already in place but flagged
// them as NOT independently confirmed live.
//
// This suite closes that gap at the component level: EobReviewQueue's own
// row-selection state (not Radix Tabs) gates whether EobExtractionForm
// mounts, and eob-review-queue.test.tsx already proves that selection state
// is reachable via a plain fireEvent.click in jsdom with no Radix
// involvement — so rendering EobReviewQueue with real pending rows and
// clicking "Review" is a faithful stand-in for the live populated tab.
// Confirms, live in this suite rather than by source-reading alone:
//   - every per-line/per-claim input keeps its accessible name (sr-only label)
//   - heading order stays h2 (remittance/findings) -> h3 (claim), no skip
//   - confidence is signaled by icon + visible text, never color alone
//   - no hardcoded left/right utility class anywhere in the rendered tree
//   - the review form's dir attribute matches the active locale (rtl for ar)

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/actions/eob-review", () => ({
  approveEobExtractionAction: vi.fn(),
  rejectEobExtractionAction: vi.fn(),
}));

import { EobReviewQueue } from "@/components/modules/eob-review-queue";

function makeExtraction(payerName: string, confidence: number): EobExtraction {
  return {
    payerName,
    payerNphiesId: "NPHIES-1",
    remittanceDate: "2026-07-01",
    remittanceTotalPaidHalalas: 10_000,
    overallConfidence: confidence,
    claims: [
      {
        claimId: "claim-1",
        nphiesClaimId: null,
        patientRef: null,
        serviceDate: null,
        confidence,
        totalBilledHalalas: 10_000,
        totalPaidHalalas: 10_000,
        totalRejectedHalalas: 0,
        lines: [
          {
            claimLineRef: "1",
            sbsCode: null,
            icd10amCode: null,
            billedHalalas: 10_000,
            paidHalalas: 10_000,
            patientShareHalalas: 0,
            rejectedHalalas: 0,
            denialCode: null,
            confidence,
          },
          {
            claimLineRef: "2",
            sbsCode: "99213",
            icd10amCode: null,
            billedHalalas: 5_000,
            paidHalalas: 4_000,
            patientShareHalalas: 1_000,
            rejectedHalalas: 0,
            denialCode: null,
            confidence,
          },
        ],
      },
    ],
  };
}

function makeRow(
  id: string,
  filename: string,
  confidence: number,
  opts: { escalated?: boolean; validatorReport?: unknown } = {},
): EobReviewRow {
  return {
    id,
    sourceFilename: filename,
    status: "pending_review",
    extraction: makeExtraction(`Payer for ${filename}`, confidence),
    validatorReport: opts.validatorReport ?? null,
    model: "sonnet",
    escalated: opts.escalated ?? false,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: "2026-07-01T00:00:00.000Z",
  };
}

function renderQueue(rows: EobReviewRow[], locale: "en" | "ar" = "en") {
  const messages = locale === "ar" ? arMessages : enMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={{ reviewQueue: messages.reviewQueue }}>
      <EobReviewQueue rows={rows} />
    </NextIntlClientProvider>,
  );
}

// No global RTL cleanup is registered in apps/web/test/setup.ts (matches the
// established convention — see ingest-panel-contrast-and-i18n.test.tsx).
afterEach(cleanup);

describe("EobReviewQueue populated state — confidence signaling is never color-only", () => {
  it("gives every queue-row confidence badge both an icon and a distinct visible text label across all three tiers", () => {
    const rows = [
      makeRow("row-high", "high.pdf", 0.95),
      makeRow("row-med", "med.pdf", 0.7),
      makeRow("row-low", "low.pdf", 0.3),
    ];
    renderQueue(rows);

    expect(screen.getByText(enMessages.reviewQueue.confidenceHigh)).toBeInTheDocument();
    expect(screen.getByText(enMessages.reviewQueue.confidenceMed)).toBeInTheDocument();
    expect(screen.getByText(enMessages.reviewQueue.confidenceLow)).toBeInTheDocument();

    // Each badge's icon is decorative (aria-hidden) — the tier's accessible
    // name comes entirely from the adjacent visible text, never the icon or
    // the badge's color variant alone.
    const icons = document.querySelectorAll("svg[aria-hidden='true']");
    expect(icons.length).toBeGreaterThanOrEqual(3);
  });
});

describe("EobReviewQueue populated state — selected row renders a fully-labeled, correctly-ordered review form", () => {
  it("keeps every per-line input and the denial-code select accessibly named once a real pending row is selected", async () => {
    renderQueue([makeRow("row-1", "remit.pdf", 0.95)]);

    fireEvent.click(screen.getByRole("button", { name: enMessages.reviewQueue.review }));

    // 2 lines seeded above -> exactly 2 labeled controls per field, reachable
    // the same way a screen reader user or `getByLabelText` caller would.
    for (const label of [
      enMessages.reviewQueue.lineRef,
      enMessages.reviewQueue.sbsCode,
      enMessages.reviewQueue.icd10amCode,
      enMessages.reviewQueue.billed,
      enMessages.reviewQueue.paid,
      enMessages.reviewQueue.patientShare,
      enMessages.reviewQueue.rejected,
      enMessages.reviewQueue.denialCode,
    ]) {
      expect(await screen.findAllByLabelText(label)).toHaveLength(2);
    }
  });

  it("renders remittanceHeading as h2 and claimHeading as h3 with no skipped level, even with validator findings present", async () => {
    renderQueue([
      makeRow("row-1", "remit.pdf", 0.4, {
        escalated: true,
        validatorReport: {
          findings: [{ check: "totals_match", passed: false, detail: "Totals disagree" }],
        },
      }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: enMessages.reviewQueue.review }));

    const findingsHeading = await screen.findByRole("heading", {
      level: 2,
      name: enMessages.reviewQueue.validatorFindingsHeading,
    });
    const remittanceHeading = screen.getByRole("heading", {
      level: 2,
      name: enMessages.reviewQueue.remittanceHeading,
    });
    const claimHeading = screen.getByRole("heading", {
      level: 3,
      name: "Claim 1",
    });
    expect(findingsHeading).toBeInTheDocument();
    expect(remittanceHeading).toBeInTheDocument();
    expect(claimHeading).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 4 })).not.toBeInTheDocument();
  });

  it("never renders a hardcoded left/right-side utility class anywhere in the populated queue + review form", async () => {
    const { container } = renderQueue([makeRow("row-1", "remit.pdf", 0.95)]);
    fireEvent.click(screen.getByRole("button", { name: enMessages.reviewQueue.review }));
    await screen.findAllByLabelText(enMessages.reviewQueue.lineRef);

    const physicalSideClass = /\b(?:p|m)[lr]-\d|(?:^|\s)(?:left|right)-\d|text-(?:left|right)\b/;
    for (const el of container.querySelectorAll("[class]")) {
      // SVG elements expose `className` as an SVGAnimatedString, not a plain
      // string — read the attribute directly so this check works uniformly
      // across HTML and SVG nodes.
      const classAttr = el.getAttribute("class") ?? "";
      expect(classAttr).not.toMatch(physicalSideClass);
    }
  });
});

describe("EobReviewQueue populated state — RTL locale wraps the review form with the matching dir attribute", () => {
  it("sets dir=\"rtl\" on the review form when rendered under the Arabic locale", async () => {
    renderQueue([makeRow("row-1", "remit.pdf", 0.95)], "ar");

    fireEvent.click(screen.getByRole("button", { name: arMessages.reviewQueue.review }));

    const remittanceHeading = await screen.findByRole("heading", {
      level: 2,
      name: arMessages.reviewQueue.remittanceHeading,
    });
    const dirWrapper = remittanceHeading.closest("[dir]");
    expect(dirWrapper).not.toBeNull();
    expect(dirWrapper).toHaveAttribute("dir", "rtl");
  });

  it("sets dir=\"ltr\" on the review form when rendered under the English locale", async () => {
    renderQueue([makeRow("row-1", "remit.pdf", 0.95)], "en");

    fireEvent.click(screen.getByRole("button", { name: enMessages.reviewQueue.review }));

    const remittanceHeading = await screen.findByRole("heading", {
      level: 2,
      name: enMessages.reviewQueue.remittanceHeading,
    });
    const dirWrapper = remittanceHeading.closest("[dir]");
    expect(dirWrapper).not.toBeNull();
    expect(dirWrapper).toHaveAttribute("dir", "ltr");
  });
});
