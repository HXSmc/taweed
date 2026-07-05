// Pure, deterministic money math. Money is a Postgres numeric carried as a
// string; we NEVER do float arithmetic on it (0.1 + 0.2 !== 0.3 in IEEE-754).
// Everything is converted to integer halalas (1 SAR = 100 halalas), summed as
// integers, then formatted back. This mirrors the numeric(14,2) columns and
// keeps analytics totals bit-exact with the DB.

const HALALAS_PER_SAR = 100;

/**
 * Parse a money string ("123.45", "100", "-5.5") into signed integer halalas.
 * Accepts 0-2 fractional digits; a 3rd+ digit is truncated (numeric(14,2) never
 * produces one). Kept private — callers work in SAR strings, not halalas.
 */
function parseHalalas(value: string): number {
  const trimmed = value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid money string: ${JSON.stringify(value)}`);
  }
  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const dot = unsigned.indexOf(".");
  const intPart = dot === -1 ? unsigned : unsigned.slice(0, dot);
  const fracRaw = dot === -1 ? "" : unsigned.slice(dot + 1);
  // Pad to 2 digits then take exactly 2 so "1.5" -> 50 and "1.234" -> 23.
  const frac2 = (fracRaw + "00").slice(0, 2);
  const total = Number(intPart) * HALALAS_PER_SAR + Number(frac2);
  return negative ? -total : total;
}

/** Parse a money string into signed integer halalas (exact, no float). */
export function moneyToHalalas(value: string): number {
  return parseHalalas(value);
}

/** Format signed integer halalas back to a 2-decimal SAR string. */
export function toSar(halalas: number): string {
  const rounded = Math.round(halalas);
  const negative = rounded < 0;
  const abs = Math.abs(rounded);
  const sar = Math.floor(abs / HALALAS_PER_SAR);
  const rem = abs % HALALAS_PER_SAR;
  return `${negative ? "-" : ""}${sar}.${rem.toString().padStart(2, "0")}`;
}

/** Exact sum of money strings, returned as a 2-decimal SAR string. */
export function sumMoney(values: string[]): string {
  const total = values.reduce((acc, v) => acc + parseHalalas(v), 0);
  return toSar(total);
}

/**
 * Descending cumulative share (%) of `sar` across rows, for a Pareto/80-20
 * view. Rows are sorted by sar descending (stable) first; the returned array is
 * aligned to that sorted order and the final element is exactly 100 when the
 * total is positive. Returns zeros (not NaN) when every row is zero. `count` is
 * accepted for call-site convenience but does not affect the percentages.
 */
export function cumulativePareto(rows: { sar: string; count: number }[]): number[] {
  if (rows.length === 0) return [];
  const halalas = rows.map((r) => parseHalalas(r.sar));
  const order = halalas
    .map((h, i) => ({ h, i }))
    .sort((a, b) => b.h - a.h); // stable in V8 → ties keep input order
  const total = halalas.reduce((acc, h) => acc + h, 0);
  if (total === 0) return order.map(() => 0);
  let running = 0;
  return order.map(({ h }) => {
    running += h;
    return Math.round(((running / total) * 100 + Number.EPSILON) * 100) / 100;
  });
}
