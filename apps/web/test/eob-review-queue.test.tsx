// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { EobExtraction } from "@taweed/ai";
import type { EobReviewRow } from "@/lib/eob-review-data";
import enMessages from "@/messages/en.json";

// Regression test (bug audit finding): approve()/reject() used to call
// setSelectedId(null) unconditionally on success, with no check that the row
// being approved/rejected is still the one the reviewer currently has open.
// A slow background approve for a row the reviewer has since navigated away
// from would silently close whatever row they switched to, discarding any
// in-progress edits. The fix keys the clear on `prev === rowId`.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

let resolveApprove: ((v: { ok: true }) => void) | undefined;
vi.mock("@/lib/actions/eob-review", () => ({
  approveEobExtractionAction: vi.fn(
    () => new Promise((resolve) => { resolveApprove = resolve; }),
  ),
  rejectEobExtractionAction: vi.fn(),
}));

import { EobReviewQueue } from "@/components/modules/eob-review-queue";

function makeExtraction(payerName: string): EobExtraction {
  return {
    payerName,
    payerNphiesId: "NPHIES-1",
    remittanceDate: "2026-07-01",
    remittanceTotalPaidHalalas: 10_000,
    overallConfidence: 0.9,
    claims: [
      {
        claimId: "claim-1",
        nphiesClaimId: null,
        patientRef: null,
        serviceDate: null,
        confidence: 0.9,
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
            confidence: 0.9,
          },
        ],
      },
    ],
  };
}

function makeRow(id: string, filename: string): EobReviewRow {
  return {
    id,
    sourceFilename: filename,
    status: "pending_review",
    extraction: makeExtraction(`Payer for ${filename}`),
    validatorReport: null,
    model: "sonnet",
    escalated: false,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: "2026-07-01T00:00:00.000Z",
  };
}

function renderQueue(rows: EobReviewRow[]) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ reviewQueue: enMessages.reviewQueue }}>
      <EobReviewQueue rows={rows} />
    </NextIntlClientProvider>,
  );
}

describe("EobReviewQueue — approve/reject race guard", () => {
  it("does not close the review form for a row the reviewer switched to while an earlier row's approve is still pending", async () => {
    // Arrange: two pending rows.
    const rows = [makeRow("row1", "remit-1.pdf"), makeRow("row2", "remit-2.pdf")];
    renderQueue(rows);

    const reviewButtons = screen.getAllByRole("button", { name: enMessages.reviewQueue.review });

    // Open row1 and kick off its (never-yet-resolving) approve.
    fireEvent.click(reviewButtons[0]);
    const approveButton = await screen.findByRole("button", { name: enMessages.reviewQueue.approve });
    fireEvent.click(approveButton);

    // Before row1's approve resolves, the reviewer switches to row2.
    fireEvent.click(reviewButtons[1]);
    expect(
      (await screen.findByLabelText(enMessages.reviewQueue.payerName) as HTMLInputElement).value,
    ).toBe("Payer for remit-2.pdf");

    // Act: row1's approve now resolves successfully in the background.
    expect(resolveApprove).toBeDefined();
    resolveApprove!({ ok: true });
    await Promise.resolve();
    await Promise.resolve();

    // Assert: row2's review form must still be open with row2's data — the
    // stale row1 success must not have cleared the selection out from under
    // the reviewer.
    const payerInput = screen.getByLabelText(enMessages.reviewQueue.payerName) as HTMLInputElement;
    expect(payerInput.value).toBe("Payer for remit-2.pdf");
  });
});
