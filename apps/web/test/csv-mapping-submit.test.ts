import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IngestResult } from "../lib/actions/ingest";
import type { CsvPreviewResult } from "../lib/actions/ingest-csv";

// EXECUTE B6 — extracted preview/commit call-and-state-transition logic for
// the CSV mapping flow, mirroring ingest-submit.ts's resolveUploadState shape
// (a rejected server-action promise must still resolve to a displayable
// state, never reject and strand the caller mid-transition).

vi.mock("../lib/actions/ingest-csv", () => ({
  previewCsvMapping: vi.fn(),
  commitCsvMapping: vi.fn(),
}));

import { previewCsvMapping, commitCsvMapping } from "../lib/actions/ingest-csv";
import { resolveCsvPreview, resolveCsvCommit } from "../lib/csv-mapping-submit";

const mockedPreview = vi.mocked(previewCsvMapping);
const mockedCommit = vi.mocked(commitCsvMapping);

function makeFile(): File {
  return new File(["Claim ID,Total Amount\nCLM-1,10\n"], "remit.csv", { type: "text/csv" });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveCsvPreview", () => {
  it("returns a preview state carrying headers/suggestions on success", async () => {
    const ok: CsvPreviewResult = {
      ok: true,
      headers: ["Claim ID", "Total Amount"],
      suggestions: [{ field: "claimId", sourceColumn: "Claim ID", confidence: 1 }],
      rowCount: 1,
    };
    mockedPreview.mockResolvedValue(ok);
    const file = makeFile();
    const fd = new FormData();
    fd.set("file", file);

    const state = await resolveCsvPreview(file, fd);

    expect(state.kind).toBe("preview");
    if (state.kind === "preview") {
      expect(state.file).toBe(file);
      expect(state.headers).toEqual(ok.headers);
      expect(state.suggestions).toEqual(ok.suggestions);
      expect(state.rowCount).toBe(ok.rowCount);
    }
  });

  it("returns a previewFailed state carrying the error code/message on failure", async () => {
    mockedPreview.mockResolvedValue({
      ok: false,
      headers: [],
      suggestions: [],
      rowCount: 0,
      error: "rate_limited",
    });
    const file = makeFile();

    const state = await resolveCsvPreview(file, new FormData());

    expect(state).toEqual({ kind: "previewFailed", error: "rate_limited" });
  });

  it("resolves to a previewFailed state, never rejects, when the server action's promise rejects", async () => {
    mockedPreview.mockRejectedValue(new Error("network reset"));
    const file = makeFile();

    const state = await resolveCsvPreview(file, new FormData());

    expect(state.kind).toBe("previewFailed");
  });
});

describe("resolveCsvCommit", () => {
  const OK_RESULT: IngestResult = {
    ok: true,
    fileName: "remit.csv",
    claims: 1,
    denials: 0,
    atRiskSar: "0.00",
    quarantined: [],
  };

  it("returns a committed state carrying the IngestResult on success", async () => {
    mockedCommit.mockResolvedValue(OK_RESULT);
    const file = makeFile();

    const state = await resolveCsvCommit(file, { claimId: "Claim ID" });

    expect(state).toEqual({ kind: "committed", result: OK_RESULT });
    expect(mockedCommit).toHaveBeenCalledWith(expect.any(FormData), { claimId: "Claim ID" });
  });

  it("forwards an explicit null override through to commitCsvMapping unchanged", async () => {
    mockedCommit.mockResolvedValue(OK_RESULT);
    const file = makeFile();

    await resolveCsvCommit(file, { claimId: "Claim ID", totalAmount: null });

    expect(mockedCommit).toHaveBeenCalledWith(expect.any(FormData), {
      claimId: "Claim ID",
      totalAmount: null,
    });
  });

  it("resolves to a failed committed state, never rejects, when the server action's promise rejects", async () => {
    mockedCommit.mockRejectedValue(new Error("network reset"));
    const file = makeFile();

    const state = await resolveCsvCommit(file, {});

    expect(state.kind).toBe("committed");
    if (state.kind === "committed") {
      expect(state.result.ok).toBe(false);
      expect(state.result.error).toBeTruthy();
    }
  });
});
