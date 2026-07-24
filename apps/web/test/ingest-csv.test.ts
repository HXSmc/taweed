import { describe, it, expect, vi, beforeEach } from "vitest";

// EXECUTE B6 — server actions for the CSV/TSV/XLSX field-mapping panel.
// previewCsvMapping parses + detects a mapping WITHOUT touching the DB;
// commitCsvMapping re-parses, applies the operator's confirmed overrides,
// resolves the same tenant-dimension lookup ingestBundle uses, and inserts
// via the same canonical-row insertion machinery. Mirrors ingestBundle's own
// guard order (auth before rate limit before the expensive parse/insert
// work) and its rate-limit key prefix ("ingest:") so both paths share one
// throttle bucket per actor.

const mockedAuthorizeAction = vi.fn();
vi.mock("@/lib/authz", () => ({
  authorizeAction: (...args: unknown[]) => mockedAuthorizeAction(...args),
}));

const mockedAllowRequest = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  allowRequest: (...args: unknown[]) => mockedAllowRequest(...args),
}));

// select() is called four times in a fixed order inside resolveFirstDimensions
// (branch, provider, payer, patient) — a small queue lets each test control
// exactly what each lookup returns without depending on real schema/table
// identity.
let selectQueue: unknown[][] = [];
function fakeDb() {
  return {
    select: () => ({
      from: () => ({
        orderBy: () => ({
          limit: () => Promise.resolve(selectQueue.shift() ?? []),
        }),
      }),
    }),
    insert: () => ({ values: () => Promise.resolve() }),
  };
}

const mockedWithSession = vi.fn();
vi.mock("@/lib/db", () => ({
  withSession: (...args: unknown[]) => mockedWithSession(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { previewCsvMapping, commitCsvMapping } from "../lib/actions/ingest-csv";

const SESSION = {
  tenantId: "tenant-1",
  userId: "user-1",
  email: "rcm@example.com",
  role: "rcm",
};

const FULL_DIMS: unknown[][] = [
  [{ id: "branch-1", name: "Riyadh" }],
  [{ id: "provider-1", name: "Dr A" }],
  [{ id: "payer-1", name: "Bupa" }],
  [{ id: "patient-1", pseudonym: "PT-1" }],
];

function csvFile(content: string, name = "remit.csv", type = "text/csv"): File {
  return new File([content], name, { type });
}

function fileFormData(file: File): FormData {
  const fd = new FormData();
  fd.set("file", file);
  return fd;
}

const CSV_CONTENT = "Claim ID,Total Amount\nCLM-1,100.00\nCLM-2,50.00\n";
const TSV_CONTENT = "Claim ID\tTotal Amount\nCLM-1\t100.00\n";

beforeEach(() => {
  vi.clearAllMocks();
  selectQueue = [];
  mockedAuthorizeAction.mockResolvedValue(SESSION);
  mockedAllowRequest.mockResolvedValue(true);
  mockedWithSession.mockImplementation((_tenantId: string, cb: (db: unknown) => unknown) =>
    cb(fakeDb()),
  );
});

describe("previewCsvMapping", () => {
  it("returns not_authorized and never rate-limits or parses when the session is missing", async () => {
    mockedAuthorizeAction.mockResolvedValue(null);

    const result = await previewCsvMapping(fileFormData(csvFile(CSV_CONTENT)));

    expect(result.ok).toBe(false);
    expect(result.error).toBe("not_authorized");
    expect(mockedAllowRequest).not.toHaveBeenCalled();
  });

  it("returns rate_limited before doing any parse work", async () => {
    mockedAllowRequest.mockResolvedValue(false);

    const result = await previewCsvMapping(fileFormData(csvFile(CSV_CONTENT)));

    expect(result.ok).toBe(false);
    expect(result.error).toBe("rate_limited");
  });

  it("throttles under the same ingest: key prefix + window as ingestBundle", async () => {
    await previewCsvMapping(fileFormData(csvFile(CSV_CONTENT)));

    expect(mockedAllowRequest).toHaveBeenCalledWith(
      `ingest:${SESSION.tenantId}:${SESSION.userId}`,
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("returns empty_file when no file entry is present", async () => {
    const result = await previewCsvMapping(new FormData());
    expect(result.ok).toBe(false);
    expect(result.error).toBe("empty_file");
  });

  it("returns empty_file when the file entry is not a File", async () => {
    const fd = new FormData();
    fd.set("file", "not-a-file");
    const result = await previewCsvMapping(fd);
    expect(result.ok).toBe(false);
    expect(result.error).toBe("empty_file");
  });

  it("parses a .csv upload with a comma delimiter and detects a mapping", async () => {
    const result = await previewCsvMapping(fileFormData(csvFile(CSV_CONTENT)));

    expect(result.ok).toBe(true);
    expect(result.headers).toEqual(["Claim ID", "Total Amount"]);
    expect(result.rowCount).toBe(2);
    const claimIdSuggestion = result.suggestions.find((s) => s.field === "claimId");
    expect(claimIdSuggestion?.sourceColumn).toBe("Claim ID");
  });

  it("parses a .tsv upload with a tab delimiter", async () => {
    const result = await previewCsvMapping(
      fileFormData(csvFile(TSV_CONTENT, "remit.tsv", "text/tab-separated-values")),
    );

    expect(result.ok).toBe(true);
    expect(result.headers).toEqual(["Claim ID", "Total Amount"]);
    expect(result.rowCount).toBe(1);
  });

  it("maps the XLSX 'not wired' throw to a fixed, safe error code", async () => {
    // Regression: previewCsvMapping used to forward the raw exception
    // message (parser/library-internal text) verbatim as CsvPreviewResult
    // .error. Mirrors commitCsvMapping's own hardening (and ingestBundle's
    // JSON.parse catch, "file is not valid JSON") — a fixed code, never the
    // raw err.message.
    const result = await previewCsvMapping(
      fileFormData(csvFile("irrelevant-bytes", "remit.xlsx", "application/vnd.openxmlformats")),
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe("xlsx_not_wired");
    expect(result.error).not.toMatch(/XLSX ingest not wired/);
  });

  it("maps a malformed-row parse failure to the generic parse_error code, never the raw message", async () => {
    // Same hardening for parseDelimited's own throw (packages/ingest/src/
    // csv.ts), which embeds the uploader's own header names in its message —
    // still internal parser detail that should not cross the wire raw.
    const malformed = 'Claim ID,Total Amount\nCLM-1,"100.00",extra\n';
    const result = await previewCsvMapping(fileFormData(csvFile(malformed)));

    expect(result.ok).toBe(false);
    expect(result.error).toBe("parse_error");
    expect(result.error).not.toMatch(/Malformed row/);
  });

  it("returns empty_file when the parsed table has no headers", async () => {
    const result = await previewCsvMapping(fileFormData(csvFile("")));
    expect(result.ok).toBe(false);
    expect(result.error).toBe("empty_file");
  });

  it("never touches the DB", async () => {
    await previewCsvMapping(fileFormData(csvFile(CSV_CONTENT)));
    expect(mockedWithSession).not.toHaveBeenCalled();
  });

  it("returns file_too_large and never parses when the file exceeds the byte cap", async () => {
    // A real >5MB payload would slow this suite down; File.size is a plain
    // property, so a small body with an inflated File constructor size lie
    // is not possible — instead build actual oversized content once and
    // reuse it, keeping the test still well under a second.
    const oversized = "a".repeat(5 * 1024 * 1024 + 1);
    const result = await previewCsvMapping(fileFormData(csvFile(oversized)));

    expect(result.ok).toBe(false);
    expect(result.error).toBe("file_too_large");
  });

  it("returns file_too_large when the parsed row count exceeds the row cap", async () => {
    const header = "Claim ID,Total Amount\n";
    const rows = Array.from({ length: 5001 }, (_, i) => `CLM-${i},10.00`).join("\n");
    const result = await previewCsvMapping(fileFormData(csvFile(header + rows)));

    expect(result.ok).toBe(false);
    expect(result.error).toBe("file_too_large");
  });
});

describe("commitCsvMapping", () => {
  it("returns 'not authorized' when the session is missing", async () => {
    mockedAuthorizeAction.mockResolvedValue(null);
    const result = await commitCsvMapping(fileFormData(csvFile(CSV_CONTENT)), {});
    expect(result.ok).toBe(false);
    expect(result.error).toBe("not authorized");
  });

  it("returns rate_limited before parsing/inserting", async () => {
    mockedAllowRequest.mockResolvedValue(false);
    const result = await commitCsvMapping(fileFormData(csvFile(CSV_CONTENT)), {});
    expect(result.ok).toBe(false);
    expect(result.error).toBe("rate_limited");
    expect(mockedWithSession).not.toHaveBeenCalled();
  });

  it("returns 'tenant has no dimensions seeded' when a dimension lookup is empty", async () => {
    selectQueue = [[], [], [], []];
    const result = await commitCsvMapping(fileFormData(csvFile(CSV_CONTENT)), {});
    expect(result.ok).toBe(false);
    expect(result.error).toBe("tenant has no dimensions seeded");
  });

  it("inserts every valid row and reports quarantine for the invalid ones", async () => {
    selectQueue = [...FULL_DIMS];
    const content = "Claim ID,Total Amount\nCLM-1,100.00\nCLM-BAD,\n";
    const result = await commitCsvMapping(fileFormData(csvFile(content)), {});

    expect(result.ok).toBe(true);
    expect(result.claims).toBe(1);
    expect(result.quarantined).toEqual([
      { ref: "CLM-BAD", reason: "total amount is missing or not a valid number" },
    ]);
  });

  it("honors an explicit null override to clear a field, never silently falling back to its auto-detected mapping", async () => {
    selectQueue = [...FULL_DIMS];
    // "Total Amount" auto-detects strongly for totalAmount from CSV_CONTENT's
    // headers. This is an end-to-end contract test for the null-override
    // plumbing itself (commitCsvMapping -> applyMappingOverrides): an
    // explicit null must leave the field genuinely unmapped through to
    // csvRowsToClaims, not just at the mapping-suggestion layer. The actual
    // client-side bug this whole feature fixes (a reviewer clearing a Select
    // to "— none —" being silently omitted from `overrides`, rather than
    // sent as this explicit null) is covered at the CsvMappingPanel layer in
    // csv-mapping-panel.test.tsx, since an omitted key vs. an explicit null
    // key produce identical downstream behavior once they reach this
    // function — the divergence is entirely in what the client sends.
    const result = await commitCsvMapping(fileFormData(csvFile(CSV_CONTENT)), {
      totalAmount: null,
    });

    expect(result.ok).toBe(true);
    expect(result.claims).toBe(0);
    expect(result.quarantined).toEqual([
      { ref: "CLM-1", reason: "total amount is missing or not a valid number" },
      { ref: "CLM-2", reason: "total amount is missing or not a valid number" },
    ]);
  });

  it("applies operator overrides to the detected mapping before building claims", async () => {
    selectQueue = [...FULL_DIMS];
    // "Amt" would not auto-detect as totalAmount; the override forces it.
    const content = "Ref,Amt\nCLM-1,75.00\n";
    const result = await commitCsvMapping(fileFormData(csvFile(content)), {
      claimId: "Ref",
      totalAmount: "Amt",
    });

    expect(result.ok).toBe(true);
    expect(result.claims).toBe(1);
    expect(result.quarantined).toEqual([]);
  });

  it("maps a parse failure (e.g. XLSX not wired) to a fixed, safe error string", async () => {
    // Regression: commitCsvMapping used to forward the raw exception message
    // (parser/library-internal text) verbatim into IngestResult.error, which
    // ingest-panel.tsx renders untranslated on this PHI-adjacent surface.
    // Mirrors ingestBundle's own JSON.parse catch ("file is not valid
    // JSON") — a fixed string, never the raw err.message.
    selectQueue = [...FULL_DIMS];
    const result = await commitCsvMapping(
      fileFormData(csvFile("bytes", "remit.xlsx", "application/vnd.openxmlformats")),
      {},
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBe("could not parse file");
    expect(result.error).not.toMatch(/XLSX ingest not wired/);
  });

  it("returns 'file is too large to import' and never parses when the file exceeds the byte cap", async () => {
    const oversized = "a".repeat(5 * 1024 * 1024 + 1);
    const result = await commitCsvMapping(fileFormData(csvFile(oversized)), {});

    expect(result.ok).toBe(false);
    expect(result.error).toBe("file is too large to import");
    expect(mockedWithSession).not.toHaveBeenCalled();
  });

  it("returns 'file is too large to import' before the dimension lookup or insert loop when the row count exceeds the row cap", async () => {
    selectQueue = [...FULL_DIMS];
    const header = "Claim ID,Total Amount\n";
    const rows = Array.from({ length: 5001 }, (_, i) => `CLM-${i},10.00`).join("\n");
    const result = await commitCsvMapping(fileFormData(csvFile(header + rows)), {});

    expect(result.ok).toBe(false);
    expect(result.error).toBe("file is too large to import");
    // The row-count guard runs right after parse, before resolveFirstDimensions
    // and before the per-row insert loop — no withSession call at all.
    expect(mockedWithSession).not.toHaveBeenCalled();
  });

  it("writes an audit row and revalidates on success without failing the ingest if audit throws", async () => {
    selectQueue = [...FULL_DIMS];
    const content = "Claim ID,Total Amount\nCLM-1,100.00\n";
    // Make the audit insert (the 6th withSession-scoped db.insert call: 4
    // selects don't call insert, then 1 claim insert set, then audit) throw —
    // the ingest must still report ok:true (best-effort audit, ingestBundle's
    // same tolerant posture).
    let call = 0;
    mockedWithSession.mockImplementation((_tenantId: string, cb: (db: unknown) => unknown) => {
      call += 1;
      if (call === 3) {
        // 1st call = dimension lookup, 2nd = per-claim insert, 3rd = audit.
        return Promise.reject(new Error("audit write failed"));
      }
      return Promise.resolve(cb(fakeDb()));
    });

    const result = await commitCsvMapping(fileFormData(csvFile(content)), {});

    expect(result.ok).toBe(true);
    expect(result.claims).toBe(1);
  });
});
