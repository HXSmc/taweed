import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IngestResult } from "../lib/actions/ingest";
import type { ExtractEobPdfResult } from "../lib/actions/eob-extract";

// Regression coverage for the bug where submit() awaited
// extractEobPdfAction/ingestBundle inside `start(async () => setState(...))`
// with no try/catch: a rejected server-action promise (large/malformed
// upload, transient network failure, size-limit connection reset) never
// reached setState, so the run ledger stayed stuck on "parsing" forever with
// no error surfaced. resolveUploadState is the extracted, catch-guarded
// routing logic submit() delegates to — it must always resolve to a
// displayable UploadState, never reject.
vi.mock("../lib/actions/ingest", () => ({
  ingestBundle: vi.fn(),
}));
vi.mock("../lib/actions/eob-extract", () => ({
  extractEobPdfAction: vi.fn(),
}));

import { ingestBundle } from "../lib/actions/ingest";
import { extractEobPdfAction } from "../lib/actions/eob-extract";
import { resolveUploadState } from "../lib/ingest-submit";

const mockedIngestBundle = vi.mocked(ingestBundle);
const mockedExtractEobPdfAction = vi.mocked(extractEobPdfAction);

function makeJsonFile(): File {
  return new File(["{}"], "bundle.json", { type: "application/json" });
}

function makePdfFile(): File {
  return new File(["%PDF-1.4"], "remittance.pdf", { type: "application/pdf" });
}

const OK_INGEST_RESULT: IngestResult = {
  ok: true,
  fileName: "bundle.json",
  claims: 3,
  denials: 1,
  atRiskSar: "150.00",
  quarantined: [],
};

const OK_PDF_RESULT: ExtractEobPdfResult = { ok: true, rowId: "row-1" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveUploadState — a rejected server action must still resolve", () => {
  it("returns a failed json UploadState when ingestBundle's promise rejects", async () => {
    // Arrange: e.g. the request body exceeded the server's size limit and the
    // connection was reset, so the server action's fetch promise rejects
    // instead of resolving to an IngestResult.
    mockedIngestBundle.mockRejectedValue(new Error("network reset"));
    const file = makeJsonFile();
    const fd = new FormData();
    fd.set("file", file);

    // Act
    const state = await resolveUploadState(file, fd);

    // Assert: resolves (never throws) with a surfaced error, not stuck state.
    expect(state.kind).toBe("json");
    expect(state.result.ok).toBe(false);
    expect((state.result as IngestResult).error).toBeTruthy();
  });

  it("returns a failed pdf UploadState when extractEobPdfAction's promise rejects", async () => {
    // Arrange: same class of failure on the PDF-extraction path.
    mockedExtractEobPdfAction.mockRejectedValue(new Error("transient network failure"));
    const file = makePdfFile();
    const fd = new FormData();
    fd.set("file", file);

    // Act
    const state = await resolveUploadState(file, fd);

    // Assert
    expect(state.kind).toBe("pdf");
    expect(state.result.ok).toBe(false);
    expect((state.result as ExtractEobPdfResult).error).toBe("failed");
  });

  it("passes through a successful json result unchanged", async () => {
    // Arrange
    mockedIngestBundle.mockResolvedValue(OK_INGEST_RESULT);
    const file = makeJsonFile();
    const fd = new FormData();
    fd.set("file", file);

    // Act
    const state = await resolveUploadState(file, fd);

    // Assert
    expect(state).toEqual({ kind: "json", result: OK_INGEST_RESULT });
  });

  it("passes through a successful pdf result unchanged", async () => {
    // Arrange
    mockedExtractEobPdfAction.mockResolvedValue(OK_PDF_RESULT);
    const file = makePdfFile();
    const fd = new FormData();
    fd.set("file", file);

    // Act
    const state = await resolveUploadState(file, fd);

    // Assert
    expect(state).toEqual({ kind: "pdf", result: OK_PDF_RESULT });
  });
});
