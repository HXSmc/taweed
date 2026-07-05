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
  recoverability,
  type DenialDimension,
} from "./queries.js";
export {
  resolveRecovery,
  recoverabilityByPayerReason,
  type AppealOutcome,
  type RecoveryResolution,
  type ResolveRecoveryInput,
  type AppealOutcomeFact,
  type RecoverabilityRow,
} from "./recovery.js";
