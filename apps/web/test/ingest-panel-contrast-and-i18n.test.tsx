// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import arMessages from "@/messages/ar.json";
import type { UploadState } from "@/lib/ingest-submit";

// Regression tests for CONFIRMED WCAG AA findings on the /ingest page's
// "upload" tab (IngestPanel):
//
// 1. [axe:color-contrast] The dropzone hint ("FHIR JSON, XLSX, CSV, PDF-EOB")
//    used `text-faint` (3.42:1 light / 3.67:1 dark), below the 4.5:1 normal-
//    text AA minimum. Fixed by switching to `text-muted` (>=6.5:1 in both
//    themes) — the same token swap already applied to landing.tsx's
//    disclaimer caption for the identical finding type.
// 2. [manual-visual] The quarantine table's first column header was a
//    hardcoded English "Ref" string instead of routing through t(), unlike
//    its sibling header (t("quarantineReason")). Fixed by adding a
//    "quarantineRef" message key (en: "Ref", ar: "المرجع") and rendering
//    t("quarantineRef") so the Arabic-locale table is fully localized.
// 3. [manual-visual:WCAG 4.1.3 Status Messages] The JSON/FHIR-bundle result
//    path (counters + success sentence + error message) rendered with no
//    aria-live/status region, unlike the sibling PDF-upload result path 25
//    lines below it in the same file (which already wraps its success text
//    in role="status" aria-live="polite" and its failure text in
//    role="alert" aria-live="assertive"). Fixed by giving the counters grid
//    and the success paragraph role="status" aria-live="polite", and the
//    error paragraph role="alert" aria-live="assertive" — matching the PDF
//    branch's convention exactly.

const quarantinedState: UploadState = {
  kind: "json",
  result: {
    ok: true,
    fileName: "remit.json",
    claims: 2,
    denials: 1,
    atRiskSar: "120.00",
    quarantined: [{ ref: "CLM-9", reason: "missing patient reference" }],
  },
};

const failedState: UploadState = {
  kind: "json",
  result: {
    ok: false,
    fileName: "remit.json",
    claims: 0,
    denials: 0,
    atRiskSar: "0",
    quarantined: [],
    error: "upload failed — check your connection and try again",
  },
};

vi.mock("@/lib/ingest-submit", () => ({
  resolveUploadState: vi.fn(async () => quarantinedState),
}));

// CountUp reads IntersectionObserver/matchMedia, neither available in jsdom
// and neither relevant to these two findings — stub it to its settled value,
// the same pattern the landing-page contrast test uses to stub MoneyFigure.
vi.mock("@/components/money/count-up", () => ({
  CountUp: ({ value, className }: { value: number; className?: string }) => (
    <span className={className}>{value}</span>
  ),
}));

import { IngestPanel } from "@/components/modules/ingest-panel";
import { resolveUploadState } from "@/lib/ingest-submit";

function renderPanel(locale: "en" | "ar") {
  const messages = locale === "en" ? enMessages : arMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={{ ingest: messages.ingest }}>
      <IngestPanel />
    </NextIntlClientProvider>,
  );
}

describe("IngestPanel — dropzone hint contrast and quarantine header i18n", () => {
  // This suite's setup does not register RTL's afterEach auto-cleanup (see
  // landing-hero-h1-and-caption-contrast.test.tsx's note on the same
  // convention), so each test's DOM must be torn down explicitly or the next
  // render()'s queries see the previous test's leftover markup too.
  afterEach(cleanup);

  it("renders the dropzone hint with an AA-contrast token, never text-faint", () => {
    renderPanel("en");

    const hint = screen.getByText(enMessages.ingest.dropzoneHint);
    expect(hint).toHaveClass("text-muted");
    expect(hint).not.toHaveClass("text-faint");
  });

  it("renders the quarantine table's ref column via t(), matching the active locale", async () => {
    renderPanel("en");

    const file = new File(["{}"], "remit.json", { type: "application/json" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    // Wait for the quarantine table to mount after resolveUploadState resolves.
    const refHeader = await screen.findByText(enMessages.ingest.quarantineRef);
    expect(refHeader.tagName).toBe("TH");
    // Regression guard: the header must never be the hardcoded English
    // literal outside of an actual `en` render — assert it came from t().
    expect(screen.queryByText("Ref")).toBe(refHeader);
    expect(screen.getByText(enMessages.ingest.quarantineReason)).toBeInTheDocument();
  });

  it("localizes the quarantine ref header to Arabic, unlike the old hardcoded 'Ref'", async () => {
    renderPanel("ar");

    const file = new File(["{}"], "remit.json", { type: "application/json" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    const refHeader = await screen.findByText(arMessages.ingest.quarantineRef);
    expect(refHeader.tagName).toBe("TH");
    // The pre-fix bug rendered the literal English word here regardless of
    // locale — assert that string is gone from an Arabic-locale render.
    expect(screen.queryByText("Ref")).toBeNull();
  });
});

describe("IngestPanel — JSON/FHIR-bundle result path announces via a live region", () => {
  afterEach(cleanup);

  it("wraps the counters + success sentence in a polite status region, matching the sibling PDF branch", async () => {
    renderPanel("en");

    const file = new File(["{}"], "remit.json", { type: "application/json" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    const successText = await screen.findByText(
      enMessages.ingest.resultLead
        .replace("{claims}", "2")
        .replace("{denials}", "1")
        .replace("{atRisk}", "120"),
    );

    // The success sentence itself is a polite status region...
    expect(successText.closest('[role="status"]')).not.toBeNull();
    expect(successText).toHaveAttribute("aria-live", "polite");

    // ...and so is the counters grid feeding it (claims/denials/quarantined).
    const claimsLabel = screen.getByText(enMessages.ingest.claimsCreated);
    const countersRegion = claimsLabel.closest('[role="status"][aria-live="polite"]');
    expect(countersRegion).not.toBeNull();
  });

  it("wraps the error message in an assertive alert region, matching the sibling PDF branch", async () => {
    vi.mocked(resolveUploadState).mockResolvedValueOnce(failedState);
    renderPanel("en");

    const file = new File(["{}"], "remit.json", { type: "application/json" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    const errorText = await screen.findByText(failedState.result.error as string);
    expect(errorText).toHaveAttribute("role", "alert");
    expect(errorText).toHaveAttribute("aria-live", "assertive");
  });
});
