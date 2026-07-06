import "server-only";
import { checkRateLimit, type RateWindow } from "@taweed/shared";

// Per-process in-memory rate limiter for billable server actions (AI explain +
// AI-3 authoring). This is a per-INSTANCE control: each server process keeps its
// own window map, so under horizontal scale (N instances behind a load balancer)
// the effective ceiling is up to N × `limit` — it FAILS OPEN at scale, not closed.
// Adequate for the first-retrofit single-instance deploy bar; a shared-store
// limiter (Redis/KV) is a DEPLOY item and the swap point is this one module (the
// pure decision in @taweed/shared checkRateLimit is already store-agnostic).
// Storage-level dedupe of AI explanations is a SEPARATE concern (flag_explanations)
// and only bounds steady-state spend, not bursts.
const windows = new Map<string, RateWindow>();
const MAX_KEYS = 10_000;

/**
 * Record a request under `key` and report whether it is allowed. Blocks once
 * more than `limit` requests arrive within `windowMs`. Callers key per
 * tenant+actor so one tenant/user cannot exhaust another's budget.
 */
export function allowRequest(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const decision = checkRateLimit(windows.get(key), now, limit, windowMs);
  windows.set(key, decision.next);
  // Bound memory: sweep elapsed windows when the map grows large.
  if (windows.size > MAX_KEYS) {
    for (const [k, w] of windows) {
      if (now - w.windowStart >= windowMs) windows.delete(k);
    }
  }
  return decision.allowed;
}
