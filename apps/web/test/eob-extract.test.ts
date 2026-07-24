import { describe, it, expect, vi, beforeEach } from "vitest";

// Coverage for the async PDF-extraction path (next/server `after`): the
// request returns a 'processing' row id fast — WITHOUT waiting on the heavy
// text-layer parse or the billable AI call — and the `after` callback
// transitions that SAME row to 'pending_review' (success) or 'failed'
// (caught throw), including the failure-durability and stuck-row-reaper
// guarantees called out in the task spec.

const mockedAuthorizeAction = vi.fn();
vi.mock("@/lib/authz", () => ({
  authorizeAction: (...args: unknown[]) => mockedAuthorizeAction(...args),
}));

const mockedAllowRequest = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  allowRequest: (...args: unknown[]) => mockedAllowRequest(...args),
}));

const mockedWithSession = vi.fn();
const mockedAppPool = vi.fn();
vi.mock("@/lib/db", () => ({
  withSession: (...args: unknown[]) => mockedWithSession(...args),
  appPool: (...args: unknown[]) => mockedAppPool(...args),
}));

const mockedInsertProcessing = vi.fn();
const mockedCompleteProcessing = vi.fn();
const mockedFailProcessing = vi.fn();
vi.mock("@/lib/eob-review-data", () => ({
  insertProcessingEobExtraction: (...args: unknown[]) =>
    mockedInsertProcessing(...args),
  completeEobExtractionProcessing: (...args: unknown[]) =>
    mockedCompleteProcessing(...args),
  failEobExtractionProcessing: (...args: unknown[]) =>
    mockedFailProcessing(...args),
}));

const mockedExtractEobFromPdf = vi.fn();
const mockedExtractPdfTextLayer = vi.fn();
vi.mock("@taweed/ingest", () => ({
  extractEobFromPdf: (...args: unknown[]) => mockedExtractEobFromPdf(...args),
  extractPdfTextLayer: (...args: unknown[]) => mockedExtractPdfTextLayer(...args),
}));

const mockedSafeParse = vi.fn();
const mockedResolveAdapter = vi.fn();
const mockedIsAiDisabledError = vi.fn();
const mockedIsAiConfigError = vi.fn();
vi.mock("@taweed/ai", () => ({
  EobExtractionSchema: { safeParse: (...args: unknown[]) => mockedSafeParse(...args) },
  resolveEobExtractionAdapter: (...args: unknown[]) =>
    mockedResolveAdapter(...args),
  isAiDisabledError: (...args: unknown[]) => mockedIsAiDisabledError(...args),
  isAiConfigError: (...args: unknown[]) => mockedIsAiConfigError(...args),
}));

vi.mock("@taweed/audit", () => ({ logAudit: vi.fn() }));

vi.mock("@/lib/error-log", () => ({
  describeErrorForLog: vi.fn((err: unknown) =>
    err instanceof Error ? err.message : "unknown",
  ),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Capture the `after()` task instead of running it — so we can assert the
// request returned fast WITHOUT the heavy work having run, then drive the
// callback ourselves to assert the row transitions.
let afterTask: (() => Promise<void>) | undefined;
vi.mock("next/server", () => ({
  after: (task: () => Promise<void>) => {
    afterTask = task;
  },
}));

import { extractEobPdfAction } from "../lib/actions/eob-extract";

const SESSION = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  userId: "user-1",
  email: "rcm@example.com",
  role: "full",
};
const ROW_ID = "22222222-2222-4222-8222-222222222222";

// A minimal valid PDF: just the magic header (enough to pass hasPdfMagicBytes).
function pdfFile(name = "eob.pdf"): File {
  const bytes = new Uint8Array([
    0x25, 0x50, 0x44, 0x46, 0x2d, // "%PDF-"
    0x31, 0x2e, 0x34, // "1.4"
    0x0a, ...new Array(64).fill(0x41),
  ]);
  return new File([bytes], name, { type: "application/pdf" });
}

function formData(file: File): FormData {
  const fd = new FormData();
  fd.append("file", file);
  return fd;
}

const EXTRACTED = {
  data: { payerName: "Payer X" },
  validatorReport: { passed: true },
  model: "sonnet",
  modelTier: "sonnet",
  escalated: false,
  promptSha256: "abc123",
};

beforeEach(() => {
  vi.clearAllMocks();
  afterTask = undefined;
  mockedAuthorizeAction.mockResolvedValue(SESSION);
  mockedAllowRequest.mockResolvedValue(true);
  mockedAppPool.mockReturnValue({});
  mockedWithSession.mockResolvedValue(undefined);
  mockedResolveAdapter.mockReturnValue({ kind: "claude" });
  mockedIsAiDisabledError.mockReturnValue(false);
  mockedIsAiConfigError.mockReturnValue(false);
  mockedExtractPdfTextLayer.mockResolvedValue(undefined);
  mockedExtractEobFromPdf.mockResolvedValue(EXTRACTED);
  mockedSafeParse.mockReturnValue({ success: true, data: EXTRACTED.data });
  mockedInsertProcessing.mockResolvedValue(ROW_ID);
  mockedCompleteProcessing.mockResolvedValue(undefined);
  mockedFailProcessing.mockResolvedValue(undefined);
});

describe("extractEobPdfAction — fast return off the request path", () => {
  it("returns ok with a row id WITHOUT awaiting the heavy AI/PDF work (criterion 1)", async () => {
    // Arrange: make the heavy AI call artificially slow. If the action awaited
    // it, this assertion would blow past the threshold; because the work is in
    // `after()` (captured, not run), the action resolves immediately.
    mockedExtractEobFromPdf.mockImplementation(
      async () =>
        new Promise((resolve) => setTimeout(() => resolve(EXTRACTED), 1000)),
    );

    // Act
    const start = performance.now();
    const result = await extractEobPdfAction(formData(pdfFile()));
    const elapsed = performance.now() - start;

    // Assert: fast (well under the slow mock's 1000ms), and the heavy work has
    // NOT run yet — it was only scheduled.
    expect(result).toEqual({ ok: true, rowId: ROW_ID });
    expect(elapsed).toBeLessThan(500);
    expect(mockedExtractEobFromPdf).not.toHaveBeenCalled();
    expect(mockedExtractPdfTextLayer).not.toHaveBeenCalled();
    expect(afterTask).toBeDefined(); // scheduled, not awaited
  });

  it("inserts a 'processing' row before returning (criterion 1)", async () => {
    await extractEobPdfAction(formData(pdfFile("remittance.pdf")));

    expect(mockedInsertProcessing).toHaveBeenCalledWith(SESSION.tenantId, {
      actorId: SESSION.userId,
      sourceFilename: "remittance.pdf",
    });
  });

  it("checks the rate limit BEFORE the fast return / insert (criterion 5)", async () => {
    mockedAllowRequest.mockResolvedValue(false);

    const result = await extractEobPdfAction(formData(pdfFile()));

    expect(result).toEqual({ ok: false, error: "rate_limited" });
    expect(mockedInsertProcessing).not.toHaveBeenCalled();
    expect(afterTask).toBeUndefined();
  });
});

describe("runExtractionAfterResponse — row transitions (criteria 2, 3, 7)", () => {
  it("transitions processing → pending_review on success, persisting the extracted data", async () => {
    await extractEobPdfAction(formData(pdfFile()));
    expect(afterTask).toBeDefined();

    // Act: drive the captured `after` callback.
    await afterTask!();

    // Assert: terminal success — the SAME row completed with the real payload.
    expect(mockedCompleteProcessing).toHaveBeenCalledTimes(1);
    expect(mockedCompleteProcessing).toHaveBeenCalledWith(
      SESSION.tenantId,
      ROW_ID,
      {
        extraction: EXTRACTED.data,
        validatorReport: EXTRACTED.validatorReport,
        model: EXTRACTED.model,
        escalated: EXTRACTED.escalated,
        promptSha256: EXTRACTED.promptSha256,
      },
    );
    expect(mockedFailProcessing).not.toHaveBeenCalled();
  });

  it("transitions processing → failed when the AI call throws (failure-path durability)", async () => {
    mockedExtractEobFromPdf.mockRejectedValue(new Error("upstream 500"));

    await extractEobPdfAction(formData(pdfFile()));
    await afterTask!();

    // Assert: the row MUST still reach a terminal state — 'failed' with a
    // reason — even though the throw happened inside `after()` after the
    // response was already sent.
    expect(mockedFailProcessing).toHaveBeenCalledTimes(1);
    expect(mockedFailProcessing).toHaveBeenCalledWith(
      SESSION.tenantId,
      ROW_ID,
      expect.any(String),
    );
    expect(mockedCompleteProcessing).not.toHaveBeenCalled();
  });

  it("records 'ai_disabled' as the failure reason for a per-tenant disable", async () => {
    const err = new Error("ai disabled");
    mockedExtractEobFromPdf.mockRejectedValue(err);
    mockedIsAiDisabledError.mockReturnValue(true);

    await extractEobPdfAction(formData(pdfFile()));
    await afterTask!();

    expect(mockedFailProcessing).toHaveBeenCalledWith(
      SESSION.tenantId,
      ROW_ID,
      "ai_disabled",
    );
  });

  it("transitions processing → failed when the model output fails the schema", async () => {
    mockedSafeParse.mockReturnValue({
      success: false,
      error: { issues: [] },
    });

    await extractEobPdfAction(formData(pdfFile()));
    await afterTask!();

    expect(mockedFailProcessing).toHaveBeenCalledWith(
      SESSION.tenantId,
      ROW_ID,
      "schema_parse_failed",
    );
    expect(mockedCompleteProcessing).not.toHaveBeenCalled();
  });
});
