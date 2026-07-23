// Shared per-item resilience classification + latency tracking for LIVE AI
// evals (extracted 2026-07-24 — this pattern was proven on extractEob's
// Claude/Gemini/GLM eval files first, independently duplicated 3 times before
// this module existed; now every new eval file imports it instead of
// re-deriving it). Pure/sync, no server-only/DB/network — safe to unit-test
// outside the live-gated `evals` vitest project, same posture as scoring.ts.
//
// A live provider call can fail four structurally different ways, and each
// needs a different response from the eval loop:
//   - balance exhausted (the account/API-key's own credits/billing ran out —
//     NOT a rate limit, will NOT resolve itself by waiting) -> stop the run
//     immediately, exclude it from any comparison, tell the user to recharge.
//   - rate/quota-limit shaped (will reset on its own) -> stop the run early,
//     keep what already scored (a partial-but-real result, not excluded).
//   - transient (timeout/abort/503/overload) -> skip just this one item,
//     keep going, with a circuit breaker for a genuine outage.
//   - schema-invalid output (the model responded but failed structured-output
//     validation) -> score it as a real miss for that item, keep going. This
//     is model-accuracy signal, not a harness bug — see extractEob.glm.eval.ts's
//     history for why it must never be conflated with "real-bug".
//   - anything else -> rethrow. A real bug fails loud, never silently
//     swallowed by an overly-broad catch.
//
// BALANCE_EXHAUSTED_RE is checked BEFORE RATE_LIMIT_RE deliberately — verified
// live via web search 2026-07-24, not assumed: GLM's real balance-exhausted
// error is ITSELF HTTP 429 ("Insufficient balance or no resource package.
// Please recharge.", error code 1113, api.z.ai/api/paas/v4/chat/completions),
// i.e. structurally indistinguishable from a rate limit on status code alone
// — the message text is the ONLY signal, and it must be checked before the
// generic 429/RESOURCE_EXHAUSTED rate-limit pattern or every GLM balance
// exhaustion would be silently misfiled as "wait and retry" instead of
// "recharge and rerun". Anthropic ("credit balance is too low... Plans &
// Billing") and OpenAI/GLM-shared wording ("exceeded your current quota...
// billing") also confirmed live — Gemini's billing-exhaustion wording
// overlaps enough with its own rate-limit wording (also "exceeded your
// current quota") that it isn't reliably distinguishable by message alone;
// Gemini falls through to RATE_LIMIT_RE (stops the run, keeps partial data)
// as the safe default rather than a guessed pattern that could misfire.
export const BALANCE_EXHAUSTED_RE =
  /credit balance is too low|insufficient_quota|insufficient balance|no resource package|error code[":= ]*1113|insufficient credit|please recharge|billing.*(?:required|not enabled|permission)|please (?:enable billing|add a payment method)/i;

export const RATE_LIMIT_RE = /RESOURCE_EXHAUSTED|429|rate.?limit/i;

export const TRANSIENT_RE =
  /abort|timeout|timed out|UNAVAILABLE|503|high demand|overloaded/i;

export const SCHEMA_INVALID_RE = /failed schema validation/i;

export const TRANSIENT_CIRCUIT_BREAKER = 8;

export type EvalErrorClass =
  | "balance"
  | "rate-limit"
  | "schema-invalid"
  | "transient"
  | "real-bug";

/** Classify a live-eval error message into the resilience bucket it belongs in. */
export function classifyEvalError(message: string): EvalErrorClass {
  if (BALANCE_EXHAUSTED_RE.test(message)) return "balance";
  if (RATE_LIMIT_RE.test(message)) return "rate-limit";
  if (SCHEMA_INVALID_RE.test(message)) return "schema-invalid";
  if (TRANSIENT_RE.test(message)) return "transient";
  return "real-bug";
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

export interface LatencyStats {
  minMs: number;
  maxMs: number;
  avgMs: number;
  totalMs: number;
  sampleCount: number;
}

export function computeLatencyStats(latencies: number[]): LatencyStats {
  if (latencies.length === 0) {
    return { minMs: 0, maxMs: 0, avgMs: 0, totalMs: 0, sampleCount: 0 };
  }
  const totalMs = latencies.reduce((a, b) => a + b, 0);
  const minMs = latencies.reduce((a, b) => Math.min(a, b), latencies[0]!);
  const maxMs = latencies.reduce((a, b) => Math.max(a, b), latencies[0]!);
  return {
    minMs,
    maxMs,
    avgMs: Math.round(totalMs / latencies.length),
    totalMs,
    sampleCount: latencies.length,
  };
}

export type EvalStopReason =
  | "completed"
  | "rate-limit"
  | "circuit-breaker"
  | "balance-exhausted";

/**
 * Shared shape every (feature, provider) eval report carries, on top of its
 * own feature-specific score fields. `excluded: true` (only set on
 * balance-exhausted stops) means the run's partial data must NEVER be folded
 * into a cross-provider comparison — a recharge-and-rerun is needed for a
 * real number, not a degraded one.
 */
export interface EvalRunMeta {
  provider: string;
  model: string;
  fullCorpusSize: number;
  scoredCount: number;
  skippedDocIds: string[];
  stopReason: EvalStopReason;
  excluded: boolean;
  excludedReason?: string;
  latencyStats: LatencyStats;
}

export interface EvalLoopResult<TCheck> {
  checks: TCheck[];
  latencies: number[];
  skipped: string[];
  stopReason: EvalStopReason;
}

/**
 * The shared per-item live-eval loop: try the provider call, classify any
 * error, and react per the resilience contract documented at the top of this
 * file. Extracted 2026-07-24 (hub-verification review found this loop
 * independently copy-pasted across explainFlag/assistAppeal/authorRule's
 * eval files — see PR history) — this is now the ONE place that
 * balance/rate-limit/transient/schema-invalid handling lives, so a future
 * policy change (new error class, circuit-breaker tweak) applies everywhere
 * at once instead of needing identical hand-edits in N files.
 *
 * `call` and `score` are DELIBERATELY separate parameters, not one combined
 * step (found live 2026-07-24: authorRule's scoring runs a real async
 * json-rules-engine dry-run + golden-corpus regression, which is local
 * compute unrelated to the provider's response speed — folding it into the
 * timed span would inflate that feature's latency numbers relative to
 * explainFlag/assistAppeal, whose scoring is synchronous, and skew the whole
 * point of this suite's cross-provider speed comparison). Only `call` is
 * timed; `score` runs after the clock stops, on both the success and
 * schema-invalid paths, so latency always measures the same thing: the
 * provider round-trip alone.
 *
 * `onSchemaInvalid` is mandatory, not optional: the whole point of
 * classifying "schema-invalid" separately from "real-bug" is that it gets
 * SCORED as a miss, not silently dropped or rethrown — a caller that can't
 * produce a miss-shaped TCheck for its feature has a design gap, not a
 * reason to skip this parameter.
 */
export async function runEvalLoop<TItem, TResult, TCheck>(
  corpus: readonly TItem[],
  itemId: (item: TItem) => string,
  call: (item: TItem) => Promise<TResult>,
  score: (result: TResult, item: TItem) => TCheck | Promise<TCheck>,
  onSchemaInvalid: (item: TItem) => TCheck,
  logPrefix: string,
): Promise<EvalLoopResult<TCheck>> {
  const checks: TCheck[] = [];
  const latencies: number[] = [];
  const skipped: string[] = [];
  let consecutiveTransient = 0;
  let stopReason: EvalStopReason = "completed";

  for (const item of corpus) {
    const id = itemId(item);
    const started = Date.now();
    try {
      const result = await call(item);
      const latencyMs = Date.now() - started;
      const check = await score(result, item);
      latencies.push(latencyMs);
      checks.push(check);
      consecutiveTransient = 0;
    } catch (err) {
      const msg = errorMessage(err);
      const cls = classifyEvalError(msg);

      if (cls === "balance") {
        stopReason = "balance-exhausted";
        console.error(`${logPrefix} stopping: balance-exhausted on ${id}: ${msg}`);
        break;
      }
      if (cls === "rate-limit") {
        stopReason = "rate-limit";
        console.error(`${logPrefix} stopping early: rate-limit on ${id}: ${msg}`);
        break;
      }
      if (cls === "schema-invalid") {
        // Model responded but failed structured-output validation — a real
        // accuracy miss for this item, not a harness failure. Score it and
        // keep going (see this module's header for why this must never be
        // conflated with a genuine bug).
        latencies.push(Date.now() - started);
        checks.push(onSchemaInvalid(item));
        console.warn(`${logPrefix} schema-invalid output, scored as a miss on ${id}: ${msg}`);
        consecutiveTransient = 0;
        continue;
      }
      if (cls === "transient") {
        consecutiveTransient += 1;
        skipped.push(id);
        console.warn(`${logPrefix} transient error, skipping ${id}: ${msg}`);
        if (consecutiveTransient >= TRANSIENT_CIRCUIT_BREAKER) {
          stopReason = "circuit-breaker";
          console.error(`${logPrefix} circuit breaker tripped`);
          break;
        }
        continue;
      }
      // real-bug: fails loud, never silently swallowed.
      throw err;
    }
  }

  return { checks, latencies, skipped, stopReason };
}

export function buildRunMeta(args: {
  provider: string;
  model: string;
  fullCorpusSize: number;
  scoredCount: number;
  skippedDocIds: string[];
  stopReason: EvalStopReason;
  latencies: number[];
}): EvalRunMeta {
  const excluded = args.stopReason === "balance-exhausted";
  return {
    provider: args.provider,
    model: args.model,
    fullCorpusSize: args.fullCorpusSize,
    scoredCount: args.scoredCount,
    skippedDocIds: args.skippedDocIds,
    stopReason: args.stopReason,
    excluded,
    excludedReason: excluded
      ? `insufficient balance on ${args.provider}'s eval API key/billing — recharge and rerun for a real comparison number`
      : undefined,
    latencyStats: computeLatencyStats(args.latencies),
  };
}
