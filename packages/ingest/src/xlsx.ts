import type { DelimitedTable } from "./csv.js";

// EXECUTE B6 — XLSX intake is a typed adapter stub. XLSX is a binary (zip) format
// that genuinely needs a parser; rather than pull in a supply-chain-heavy library
// speculatively, we define the seam. At DEPLOY, inject an adapter backed by a
// vetted, self-hosted parser (SheetJS/exceljs) that yields the same DelimitedTable
// shape the CSV path produces, so everything downstream (mapping, dimensions) is
// unchanged.
//
// TODO(deploy): wire a real XlsxAdapter behind this and drop the throw.

export interface XlsxAdapter {
  /** Parse the first (or named) sheet of an XLSX workbook into a table. */
  toTable(bytes: Uint8Array, sheet?: string): DelimitedTable;
}

export function parseXlsx(
  bytes: Uint8Array,
  adapter?: XlsxAdapter,
  sheet?: string,
): DelimitedTable {
  if (!adapter) {
    throw new Error(
      "XLSX ingest not wired: inject an XlsxAdapter (SheetJS/exceljs) at DEPLOY. TODO(deploy).",
    );
  }
  return adapter.toTable(bytes, sheet);
}
