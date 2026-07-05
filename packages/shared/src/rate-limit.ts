// Pure fixed-window rate-limit decision. Billable endpoints (e.g. the AI flag
// explainer server action) must be throttled (common/security.md). This module
// has NO clock and NO storage — the caller supplies `now` and the prior window
// state — so it is deterministic and unit-testable. A thin per-process stateful
// wrapper lives at the call site (apps/web/lib/rate-limit.ts).

export interface RateWindow {
  /** requests counted in the current window. */
  count: number;
  /** epoch-ms when the current window opened. */
  windowStart: number;
}

export interface RateDecision {
  allowed: boolean;
  /** requests still allowed in this window (0 once blocked). */
  remaining: number;
  /** ms until the window resets. */
  resetInMs: number;
  /** the window state to persist for the next call. */
  next: RateWindow;
}

/**
 * Fixed-window limiter: allow up to `limit` requests per `windowMs`.
 * Deterministic in (prev, now) — a missing or elapsed window resets the count.
 */
export function checkRateLimit(
  prev: RateWindow | undefined,
  now: number,
  limit: number,
  windowMs: number,
): RateDecision {
  if (prev === undefined || now - prev.windowStart >= windowMs) {
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      resetInMs: windowMs,
      next: { count: 1, windowStart: now },
    };
  }
  const count = prev.count + 1;
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetInMs: windowMs - (now - prev.windowStart),
    next: { count, windowStart: prev.windowStart },
  };
}
