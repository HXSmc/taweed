import { describe, it, expect } from "vitest";
import { parseDelimited } from "@taweed/ingest";

// EXECUTE B6 — CSV/XLSX remittance intake. A dependency-free RFC-4180 parser so a
// clinic's exported remittance (CSV or TSV) becomes rows without a supply-chain
// dependency. Handles quotes, embedded delimiters/newlines, and CRLF.

describe("parseDelimited — CSV", () => {
  it("parses a simple header + rows into objects keyed by header", () => {
    const { headers, rows } = parseDelimited("a,b,c\n1,2,3\n4,5,6");
    expect(headers).toEqual(["a", "b", "c"]);
    expect(rows).toEqual([
      { a: "1", b: "2", c: "3" },
      { a: "4", b: "5", c: "6" },
    ]);
  });

  it("honors quoted fields with embedded commas", () => {
    const { rows } = parseDelimited('name,amount\n"Bupa Arabia, KSA",1200');
    expect(rows[0]).toEqual({ name: "Bupa Arabia, KSA", amount: "1200" });
  });

  it("honors quoted fields with embedded newlines", () => {
    const { rows } = parseDelimited('note,x\n"line1\nline2",y');
    expect(rows[0]!.note).toBe("line1\nline2");
  });

  it("unescapes doubled quotes inside a quoted field", () => {
    const { rows } = parseDelimited('q\n"she said ""hi"""');
    expect(rows[0]!.q).toBe('she said "hi"');
  });

  it("tolerates CRLF line endings and a trailing newline", () => {
    const { rows } = parseDelimited("a,b\r\n1,2\r\n");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ a: "1", b: "2" });
  });

  it("parses TSV when the delimiter is a tab", () => {
    const { headers, rows } = parseDelimited("a\tb\n1\t2", "\t");
    expect(headers).toEqual(["a", "b"]);
    expect(rows[0]).toEqual({ a: "1", b: "2" });
  });

  it("returns no rows for an empty or header-only input", () => {
    expect(parseDelimited("").rows).toEqual([]);
    expect(parseDelimited("a,b,c").rows).toEqual([]);
  });

  it("pads short rows and keeps the row count honest (ragged input)", () => {
    const { rows } = parseDelimited("a,b,c\n1,2");
    expect(rows[0]).toEqual({ a: "1", b: "2", c: "" });
  });

  it("drops fully-blank lines (trailing and mid-file) instead of emitting phantom rows", () => {
    expect(parseDelimited("a,b\n1,2\n\n").rows).toEqual([{ a: "1", b: "2" }]);
    expect(parseDelimited("a,b\n1,2\n\n3,4").rows).toEqual([
      { a: "1", b: "2" },
      { a: "3", b: "4" },
    ]);
  });

  it("disambiguates duplicate headers so no column's data is silently dropped", () => {
    const { headers, rows } = parseDelimited("Amount,Amount\n1,2");
    expect(headers).toEqual(["Amount", "Amount_2"]);
    expect(rows[0]).toEqual({ Amount: "1", Amount_2: "2" });
  });
});
