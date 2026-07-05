// Analytics DTOs (build-plan §6, §8.2). These are read-model shapes returned by
// the rollup queries — NOT DB rows. Money stays a 2-decimal SAR string; counts
// are numbers; `rate` is a fraction in [0,1] unless otherwise noted per query.

/** One row of a "denials broken down by dimension X" table. */
export interface DimRate {
  key: string;
  label: string;
  claims: number;
  denied: number;
  rate: number;
  atRiskSar: string;
}

/** One reason-code row in a Pareto (80-20) ranking, ordered by sar descending. */
export interface ReasonRow {
  code: string;
  label: string;
  count: number;
  sar: string;
  cumulativePct: number;
}

/** Headline money KPIs for a tenant (optionally filtered). */
export interface MoneyScope {
  recoveredSar: string;
  atRiskSar: string;
  deniedCount: number;
  claimCount: number;
}

/** One month bucket of denied vs recovered money. */
export interface TrendPoint {
  period: string;
  deniedSar: string;
  recoveredSar: string;
}

/** A recovery baseline snapshot (EXECUTE B8) — the fixed at-risk starting point. */
export interface BaselineSnapshot {
  id: string;
  capturedAt: string;
  atRiskSar: string;
  deniedCount: number;
  claimCount: number;
  note: string | null;
}

/** Optional slicers shared by every query. Dates are ISO strings on claims. */
export interface AnalyticsFilters {
  branchIds?: string[];
  from?: string;
  to?: string;
}
