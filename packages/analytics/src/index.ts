// @taweed/analytics — rollup queries over the canonical relational model
// (build-plan §3, §6). Never aggregates raw FHIR. Every query runs inside
// `withTenant` so RLS scopes it to one tenant.
export type {
  AnalyticsFilters,
  BaselineSnapshot,
  DimRate,
  MoneyScope,
  ReasonRow,
  TrendPoint,
} from "./types.js";
export { sumMoney, toSar, moneyToHalalas, cumulativePareto } from "./money.js";
export {
  denialRateBy,
  reasonPareto,
  moneyScope,
  trend,
  captureBaseline,
  getLatestBaseline,
  type DenialDimension,
} from "./queries.js";
export {
  resolveRecovery,
  type AppealOutcome,
  type RecoveryResolution,
  type ResolveRecoveryInput,
} from "./recovery.js";
