import "server-only";
import { checkRateLimit, type RateWindow } from "@taweed/shared";
import { type Pool } from "@taweed/db";
import { appPool } from "@/lib/db";

// Shared, cross-instance rate limiter (audit finding, docs/review.md:669). The
// previous implementation kept `RateWindow` state in a per-process `Map`, so
// under horizontal scale (N server instances behind a load balancer) each
// instance counted independently and the effective ceiling became N x
// `limit` -- the one throttle guarding the billable AI actions failed open at
// scale. Windows now persist in `rate_limit_windows` (drizzle/
// 0011_rate_limit_windows.sql), a table every instance shares, so the ceiling
// stays `limit` regardless of instance count. The fixed-window DECISION is
// still the pure, unit-tested `checkRateLimit` from @taweed/shared -- only the
// storage changed.

export interface RateLimitStore {
  /**
   * Atomically decide + persist the next window for `key` at time `now`,
   * returning whether the request is allowed. Implementations MUST serialize
   * concurrent calls for the same `key` (a DB row lock, here) so this is a
   * true read-modify-write, not a race two callers can both win.
   */
  claim(
    key: string,
    now: number,
    limit: number,
    windowMs: number,
  ): Promise<boolean>;
}

/**
 * Postgres-backed RateLimitStore. Takes an explicit `Pool` (rather than
 * calling appPool() internally) so tests can point two independently
 * constructed stores at one fake pool and prove the cross-instance ceiling
 * holds — the exact scenario the old per-process Map failed. See
 * apps/web/test/rate-limit.test.ts.
 */
export function createRateLimitStore(pool: Pool): RateLimitStore {
  return {
    async claim(key, now, limit, windowMs) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // First-ever request for `key`: claim the row with a single INSERT
        // .. ON CONFLICT DO NOTHING. If two callers race this for the same
        // new key, exactly one INSERT wins (Postgres serializes on the
        // unique index) and the loser falls through to the lock-and-update
        // path below, so no window is ever lost or double-counted.
        const first = checkRateLimit(undefined, now, limit, windowMs);
        const inserted = await client.query(
          `INSERT INTO rate_limit_windows (key, count, window_start)
           VALUES ($1, $2, $3)
           ON CONFLICT (key) DO NOTHING`,
          [key, first.next.count, first.next.windowStart],
        );

        let allowed: boolean;
        if (inserted.rowCount === 1) {
          allowed = first.allowed;
        } else {
          // A window already exists: SELECT ... FOR UPDATE takes the row
          // lock that makes this a true atomic read-modify-write across
          // every instance sharing this pool.
          const { rows } = await client.query<{
            count: number;
            window_start: string | number;
          }>(
            `SELECT count, window_start FROM rate_limit_windows WHERE key = $1 FOR UPDATE`,
            [key],
          );
          const row = rows[0];
          const prev: RateWindow | undefined = row
            ? {
                count: Number(row.count),
                windowStart: Number(row.window_start),
              }
            : undefined;
          const decision = checkRateLimit(prev, now, limit, windowMs);
          await client.query(
            `UPDATE rate_limit_windows SET count = $2, window_start = $3 WHERE key = $1`,
            [key, decision.next.count, decision.next.windowStart],
          );
          allowed = decision.allowed;
        }

        await client.query("COMMIT");
        return allowed;
      } catch (error) {
        // Never let a failing ROLLBACK mask the original error that triggered it.
        try {
          await client.query("ROLLBACK");
        } catch {
          // swallow rollback failure; the original error below is the real cause
        }
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

// Lazily constructed so importing this module never opens a connection pool
// on its own — mirrors appPool()'s own lazy singleton caching.
let store: RateLimitStore | undefined;
function getStore(): RateLimitStore {
  store ??= createRateLimitStore(appPool());
  return store;
}

/**
 * Record a request under `key` and report whether it is allowed. Blocks once
 * more than `limit` requests arrive within `windowMs`. Callers key per
 * tenant+actor so one tenant/user cannot exhaust another's budget. Backed by
 * a shared store (see above), so the ceiling holds across every server
 * instance, not just the one that handled this request.
 */
export async function allowRequest(
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  return getStore().claim(key, Date.now(), limit, windowMs);
}
