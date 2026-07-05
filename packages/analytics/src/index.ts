// @taweed/analytics — rollup queries over the canonical relational model
// (build-plan §3, §6). Never aggregates raw FHIR. Every query runs inside
// `withTenant` so RLS scopes it to one tenant.
export type {
  AnalyticsFilters,
  DimRate,
  MoneyScope,
  ReasonRow,
  TrendPoint,
} from "./types.js";
export { sumMoney, toSar, cumulativePareto } from "./money.js";
export {
  denialRateBy,
  reasonPareto,
  moneyScope,
  trend,
  type DenialDimension,
} from "./queries.js";
