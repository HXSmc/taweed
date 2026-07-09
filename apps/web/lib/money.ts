// Money formatting. Western Latin digits in BOTH locales for all money/table/code
// content (design-brief §4.3 digit law). Grouped, tabular. Values arrive as
// Postgres numeric strings; format without float drift for display only.

/**
 * Canonical SAR amount validator: a non-negative integer or decimal string with
 * at most 2 fractional digits (e.g. "120", "120.5", "120.50"). Single source of
 * truth for every Server Action that accepts a SAR amount as a string — keep any
 * precision-rule change (e.g. allowing 3 decimals) confined to this one place.
 */
export const SAR_MONEY_REGEX = /^\d+(\.\d{1,2})?$/;

/** Format a numeric string / number as grouped digits (no currency word). */
export function formatMoney(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

/** Compact form for hero figures over ~100k: 1.84M, 412.9K. */
export function formatMoneyCompact(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 1_000_000)
    return `${(n / 1_000_000).toFixed(2).replace(/\.00$/, "")}M`;
  if (Math.abs(n) >= 100_000)
    return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return formatMoney(n);
}

export function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? n : 0;
}

/** Percentage with one decimal, e.g. 31.8%. */
export function formatPct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}
