import { describe, it, expect, vi } from "vitest";

// EXECUTE B6 — routes .csv/.tsv/.xlsx drops to the field-mapping panel
// instead of the FHIR-bundle JSON path. Parallel to the existing isPdfFile
// guard: extension-first (client-set File.type/name are not fully trusted,
// same posture as eob-extract.ts's own comment on that), MIME as a fallback
// signal only.
//
// ingest-submit.ts also imports the ingestBundle/extractEobPdfAction server
// actions at module scope, which transitively pull in @/lib/authz -> next-auth
// — mock both (same as ingest-submit.test.ts) so this pure-function test
// stays isolated from that chain.
vi.mock("../lib/actions/ingest", () => ({ ingestBundle: vi.fn() }));
vi.mock("../lib/actions/eob-extract", () => ({ extractEobPdfAction: vi.fn() }));

import { isCsvLikeFile } from "../lib/ingest-submit";

function file(name: string, type = ""): File {
  return new File(["irrelevant"], name, { type });
}

describe("isCsvLikeFile", () => {
  it.each([
    "remit.csv",
    "REMIT.CSV",
    "remit.tsv",
    "remit.xlsx",
    "remit.XLSX",
  ])("returns true for %s by extension", (name) => {
    expect(isCsvLikeFile(file(name))).toBe(true);
  });

  it("returns true for a recognized MIME type even with no matching extension", () => {
    expect(isCsvLikeFile(file("remit", "text/csv"))).toBe(true);
    expect(
      isCsvLikeFile(
        file("remit", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
      ),
    ).toBe(true);
  });

  it.each(["remit.json", "remit.pdf", "remit.txt"])(
    "returns false for %s",
    (name) => {
      expect(isCsvLikeFile(file(name))).toBe(false);
    },
  );
});
