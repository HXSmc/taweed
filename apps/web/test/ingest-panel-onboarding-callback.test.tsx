// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import type { UploadState } from "@/lib/ingest-submit";

// A2 corridor step 3 reuses IngestPanel unmodified rather than duplicating the
// dropzone/run-ledger logic (DRY). The one addition it needs: a way to know
// when a JSON/FHIR-bundle upload actually SUCCEEDED, so the corridor can
// advance to step 4 (capture the baseline + hand off to Denial Analytics).
// Optional and additive — the existing /ingest page usage (no prop passed)
// must behave exactly as before.

const okState: UploadState = {
  kind: "json",
  result: {
    ok: true,
    fileName: "remit.json",
    claims: 12,
    denials: 4,
    atRiskSar: "8400.00",
    quarantined: [],
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
    error: "upload failed",
  },
};

const mockedResolveUploadState = vi.fn();
mockedResolveUploadState.mockResolvedValue(okState);
vi.mock("@/lib/ingest-submit", () => ({
  resolveUploadState: (...args: unknown[]) => mockedResolveUploadState(...args),
  isCsvLikeFile: (file: File) => /\.(csv|tsv|xlsx)$/i.test(file.name),
}));
// @/lib/csv-mapping-submit -> @/lib/actions/ingest-csv -> @/lib/authz pulls in
// next-auth, which this environment cannot resolve in a plain vitest/jsdom
// run (see ingest-panel-csv-mapping-a11y.test.tsx). Mock it at the module
// boundary; this suite never exercises the CSV-mapping path.
vi.mock("@/lib/csv-mapping-submit", () => ({
  resolveCsvPreview: vi.fn(),
  resolveCsvCommit: vi.fn(),
}));
vi.mock("@/components/money/count-up", () => ({
  CountUp: ({ value, className }: { value: number; className?: string }) => (
    <span className={className}>{value}</span>
  ),
}));

import { IngestPanel } from "@/components/modules/ingest-panel";

function renderPanel(props: React.ComponentProps<typeof IngestPanel> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ ingest: enMessages.ingest }}>
      <IngestPanel {...props} />
    </NextIntlClientProvider>,
  );
}

function dropFile() {
  const file = new File(["{}"], "remit.json", { type: "application/json" });
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

describe("IngestPanel — onIngestSuccess (A2 corridor hook)", () => {
  afterEach(cleanup);

  it("fires onIngestSuccess once a JSON upload resolves ok", async () => {
    const onIngestSuccess = vi.fn();
    renderPanel({ onIngestSuccess });

    dropFile();
    await screen.findByText(enMessages.ingest.claimsCreated);

    expect(onIngestSuccess).toHaveBeenCalledTimes(1);
    expect(onIngestSuccess).toHaveBeenCalledWith(okState.result);
  });

  it("does not fire onIngestSuccess when the upload fails", async () => {
    mockedResolveUploadState.mockResolvedValueOnce(failedState);
    const onIngestSuccess = vi.fn();
    renderPanel({ onIngestSuccess });

    dropFile();
    await screen.findByText("upload failed");

    expect(onIngestSuccess).not.toHaveBeenCalled();
  });

  it("never throws when onIngestSuccess is omitted (existing /ingest usage, unchanged)", async () => {
    renderPanel();

    dropFile();

    await screen.findByText(enMessages.ingest.claimsCreated);
  });
});
