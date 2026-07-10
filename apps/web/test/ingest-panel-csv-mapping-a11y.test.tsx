// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import type { CsvMappingState } from "@/lib/csv-mapping-submit";
import type { IngestResult } from "@/lib/actions/ingest";

// EXECUTE B6 code-review fixes — regression coverage for:
//
// 1. [HIGH] Stale field-mapping selections survived a second, different CSV
//    file being dropped while the mapping panel was already open (no `key`
//    on <CsvMappingPanel>, so its local `selections` state — seeded once at
//    mount — was never reset against the new file's headers).
// 2. [HIGH/MEDIUM a11y] Focus was orphaned on the Confirm and Cancel
//    transitions (the mapping panel unmounts, including its focused button,
//    with nothing moving focus to the newly-shown run ledger).
// 3. [HIGH a11y] The run ledger's live region is unmounted the entire time
//    the mapping panel is shown, so it is reinserted already-populated on
//    commit/cancel — most screen readers never announce a region's initial
//    content, only mutations to an already-mounted one.
//
// These tests avoid rendering the real @/lib/csv-mapping-submit ->
// @/lib/actions/ingest-csv -> @/lib/authz chain (pulls in next-auth, which
// this environment cannot resolve in a plain vitest/jsdom run) by mocking
// both @/lib/ingest-submit and @/lib/csv-mapping-submit at the module
// boundary, mirroring the existing ingest-panel-onboarding-callback.test.tsx
// / ingest-submit-csv.test.ts mocking pattern.

vi.mock("@/lib/ingest-submit", () => ({
  isCsvLikeFile: (file: File) => /\.(csv|tsv|xlsx)$/i.test(file.name),
  resolveUploadState: vi.fn(),
}));

const mockedResolveCsvPreview = vi.fn();
const mockedResolveCsvCommit = vi.fn();
vi.mock("@/lib/csv-mapping-submit", () => ({
  resolveCsvPreview: (...args: unknown[]) => mockedResolveCsvPreview(...args),
  resolveCsvCommit: (...args: unknown[]) => mockedResolveCsvCommit(...args),
}));

vi.mock("@/components/modules/eob-review/confidence-badge", () => ({
  ConfidenceBadge: () => null,
}));
vi.mock("@/components/money/count-up", () => ({
  CountUp: ({ value, className }: { value: number; className?: string }) => (
    <span className={className}>{value}</span>
  ),
}));

import { IngestPanel } from "@/components/modules/ingest-panel";

function renderPanel() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ ingest: enMessages.ingest }}>
      <IngestPanel />
    </NextIntlClientProvider>,
  );
}

function dropFile(name: string) {
  const file = new File(["irrelevant"], name, { type: "text/csv" });
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

const FILE1_PREVIEW: CsvMappingState = {
  kind: "preview",
  file: new File(["a"], "first.csv", { type: "text/csv" }),
  headers: ["Ref", "Sum"],
  suggestions: [
    { field: "claimId", sourceColumn: "Ref", confidence: 1 },
    { field: "nphiesClaimId", sourceColumn: null, confidence: 0 },
    { field: "payerName", sourceColumn: null, confidence: 0 },
    { field: "branchName", sourceColumn: null, confidence: 0 },
    { field: "providerName", sourceColumn: null, confidence: 0 },
    { field: "patientRef", sourceColumn: null, confidence: 0 },
    { field: "sbsCode", sourceColumn: null, confidence: 0 },
    { field: "icd10amCode", sourceColumn: null, confidence: 0 },
    { field: "serviceDate", sourceColumn: null, confidence: 0 },
    { field: "totalAmount", sourceColumn: "Sum", confidence: 0.9 },
    { field: "deniedAmount", sourceColumn: null, confidence: 0 },
    { field: "reasonCode", sourceColumn: null, confidence: 0 },
    { field: "reasonText", sourceColumn: null, confidence: 0 },
  ],
  rowCount: 3,
};

const FILE2_PREVIEW: CsvMappingState = {
  kind: "preview",
  file: new File(["b"], "second.csv", { type: "text/csv" }),
  headers: ["ID", "Total"],
  suggestions: [
    { field: "claimId", sourceColumn: "ID", confidence: 1 },
    { field: "nphiesClaimId", sourceColumn: null, confidence: 0 },
    { field: "payerName", sourceColumn: null, confidence: 0 },
    { field: "branchName", sourceColumn: null, confidence: 0 },
    { field: "providerName", sourceColumn: null, confidence: 0 },
    { field: "patientRef", sourceColumn: null, confidence: 0 },
    { field: "sbsCode", sourceColumn: null, confidence: 0 },
    { field: "icd10amCode", sourceColumn: null, confidence: 0 },
    { field: "serviceDate", sourceColumn: null, confidence: 0 },
    { field: "totalAmount", sourceColumn: "Total", confidence: 0.9 },
    { field: "deniedAmount", sourceColumn: null, confidence: 0 },
    { field: "reasonCode", sourceColumn: null, confidence: 0 },
    { field: "reasonText", sourceColumn: null, confidence: 0 },
  ],
  rowCount: 5,
};

const COMMITTED_OK: IngestResult = {
  ok: true,
  fileName: "first.csv",
  claims: 1,
  denials: 0,
  atRiskSar: "0.00",
  quarantined: [],
};

describe("IngestPanel — CSV mapping panel: file-switch state reset", () => {
  afterEach(cleanup);

  it("resets stale field selections when a second, different file is dropped while the panel is open", async () => {
    mockedResolveCsvPreview
      .mockResolvedValueOnce(FILE1_PREVIEW)
      .mockResolvedValueOnce(FILE2_PREVIEW);
    renderPanel();

    const claimIdLabel = enMessages.ingest.csvMapping.overrideLabel.replace(
      "{field}",
      enMessages.ingest.csvMapping.fields.claimId,
    );

    dropFile("first.csv");
    let trigger = await screen.findByRole("combobox", { name: claimIdLabel });
    await waitFor(() => expect(trigger).toHaveTextContent("Ref"));

    // Drop a second, different file while the panel from the first file is
    // still open (no Confirm/Cancel in between).
    dropFile("second.csv");

    await waitFor(() => {
      trigger = screen.getByRole("combobox", { name: claimIdLabel });
      expect(trigger).toHaveTextContent("ID");
    });
    // The regression: without a reset, the trigger would still read "Ref" —
    // a column that does not even exist in the second file's headers.
    expect(trigger).not.toHaveTextContent("Ref");
  });
});

describe("IngestPanel — CSV mapping panel: focus and live-region a11y", () => {
  afterEach(cleanup);

  it("moves focus to the run ledger heading after Cancel", async () => {
    mockedResolveCsvPreview.mockResolvedValueOnce(FILE1_PREVIEW);
    renderPanel();

    dropFile("first.csv");
    const cancelButton = await screen.findByRole("button", {
      name: enMessages.ingest.csvMapping.cancel,
    });
    fireEvent.click(cancelButton);

    const heading = await screen.findByRole("heading", { name: enMessages.ingest.runLedger });
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it("moves focus to the run ledger heading after a successful Confirm", async () => {
    mockedResolveCsvPreview.mockResolvedValueOnce(FILE1_PREVIEW);
    mockedResolveCsvCommit.mockResolvedValueOnce({ kind: "committed", result: COMMITTED_OK });
    renderPanel();

    dropFile("first.csv");
    const confirmButton = await screen.findByRole("button", {
      name: enMessages.ingest.csvMapping.confirm,
    });
    fireEvent.click(confirmButton);

    const heading = await screen.findByRole("heading", { name: enMessages.ingest.runLedger });
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it("announces the mapping panel appearing and the commit result via an always-mounted live region", async () => {
    mockedResolveCsvPreview.mockResolvedValueOnce(FILE1_PREVIEW);
    mockedResolveCsvCommit.mockResolvedValueOnce({ kind: "committed", result: COMMITTED_OK });
    renderPanel();

    // Present in the DOM from the very first render — never conditionally
    // mounted — so its text mutations are real live-region announcements,
    // not an already-populated region appearing for the first time.
    const announcer = screen.getByTestId("csv-lifecycle-announcer");
    expect(announcer).toHaveAttribute("role", "status");
    expect(announcer).toHaveAttribute("aria-live", "polite");
    expect(announcer).toHaveTextContent("");

    dropFile("first.csv");
    const rowsDetectedText = enMessages.ingest.csvMapping.rowsDetected.replace("{n}", "3");
    await waitFor(() => expect(announcer).toHaveTextContent(rowsDetectedText));

    const confirmButton = screen.getByRole("button", {
      name: enMessages.ingest.csvMapping.confirm,
    });
    fireEvent.click(confirmButton);

    const successText = enMessages.ingest.resultLead
      .replace("{claims}", "1")
      .replace("{denials}", "0")
      .replace("{atRisk}", "0");
    await waitFor(() => expect(announcer).toHaveTextContent(successText));
  });
});
