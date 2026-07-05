// EXECUTE B6 — dependency-free RFC-4180 delimited parser (CSV/TSV). No external
// library, so a clinic's remittance export becomes rows without adding a
// supply-chain dependency (security rules). Handles quoted fields with embedded
// delimiters/newlines, doubled-quote escaping, and CRLF.

export interface DelimitedTable {
  headers: string[];
  /** One object per data row, keyed by header. Short rows are padded with "". */
  rows: Record<string, string>[];
}

/** Split delimited text into a matrix of string cells (RFC-4180 aware). */
function toMatrix(text: string, delimiter: string): string[][] {
  const matrix: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  const endField = (): void => {
    row.push(field);
    field = "";
  };
  const endRow = (): void => {
    endField();
    matrix.push(row);
    row = [];
  };

  while (i < n) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // escaped quote
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      endField();
      i += 1;
      continue;
    }
    if (ch === "\r") {
      // Swallow CRLF as a single row break.
      if (text[i + 1] === "\n") i += 1;
      endRow();
      i += 1;
      continue;
    }
    if (ch === "\n") {
      endRow();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  // Flush the final field/row unless the input ended exactly on a row break.
  if (field.length > 0 || row.length > 0) endRow();
  return matrix;
}

/**
 * Parse delimited text into a header + row-objects table. `delimiter` defaults to
 * a comma; pass "\t" for TSV. Rows shorter than the header are padded with "".
 */
export function parseDelimited(text: string, delimiter = ","): DelimitedTable {
  const matrix = toMatrix(text, delimiter);
  if (matrix.length === 0) return { headers: [], rows: [] };
  const headers = matrix[0]!.map((h) => h.trim());
  const rows = matrix.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      record[h] = cells[idx] ?? "";
    });
    return record;
  });
  return { headers, rows };
}
