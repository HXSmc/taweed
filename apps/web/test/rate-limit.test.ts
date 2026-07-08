import { describe, it, expect } from "vitest";
import type { Pool } from "@taweed/db";
import { createRateLimitStore } from "../lib/rate-limit";

// Regression coverage for the finding: apps/web/lib/rate-limit.ts previously
// kept RateWindow state in a per-process `Map`, so under horizontal scale (N
// server instances behind a load balancer) each instance counted
// independently and the effective ceiling became N x `limit` -- the one
// throttle guarding the billable AI actions failed open at scale. These tests
// construct TWO independent RateLimitStore instances -- modeling two separate
// server processes -- pointed at the SAME fake Postgres pool, and prove they
// share one combined ceiling. Against the old per-process Map, each
// "instance" would have had its own independent counter and all 4 requests
// below would have been allowed; that is the exact bug this closes.

interface FakeRow {
  count: number;
  window_start: number;
}

/**
 * Minimal fake Postgres pool understanding only the statement shapes
 * createRateLimitStore issues (BEGIN / INSERT .. ON CONFLICT DO NOTHING /
 * SELECT .. FOR UPDATE / UPDATE / COMMIT / ROLLBACK), backed by one shared
 * Map -- standing in for the single `rate_limit_windows` table every real
 * server instance would share via the real Postgres pool.
 */
function createFakePool(): Pool {
  const table = new Map<string, FakeRow>();
  const pool = {
    connect: async () => ({
      query: async (sql: string, params: unknown[] = []) => {
        const text = sql.trim();
        if (
          text.startsWith("BEGIN") ||
          text.startsWith("COMMIT") ||
          text.startsWith("ROLLBACK")
        ) {
          return { rows: [], rowCount: 0 };
        }
        if (text.startsWith("INSERT")) {
          const [key, count, windowStart] = params as [string, number, number];
          if (table.has(key)) return { rows: [], rowCount: 0 };
          table.set(key, { count, window_start: windowStart });
          return { rows: [], rowCount: 1 };
        }
        if (text.startsWith("SELECT")) {
          const [key] = params as [string];
          const row = table.get(key);
          return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
        }
        if (text.startsWith("UPDATE")) {
          const [key, count, windowStart] = params as [string, number, number];
          table.set(key, { count, window_start: windowStart });
          return { rows: [], rowCount: 1 };
        }
        throw new Error(`unexpected query in fake pool: ${text}`);
      },
      release: () => {},
    }),
  };
  return pool as unknown as Pool;
}

describe("createRateLimitStore — cross-instance shared ceiling", () => {
  it("enforces one combined ceiling across two independently-constructed stores sharing one pool", async () => {
    // Arrange: two RateLimitStore instances (two "server processes") sharing
    // one underlying pool (one real Postgres in production).
    const sharedPool = createFakePool();
    const instanceA = createRateLimitStore(sharedPool);
    const instanceB = createRateLimitStore(sharedPool);
    const key = "explain:tenant-1:user-1";
    const limit = 3;
    const windowMs = 60_000;
    const now = 1_000;

    // Act: 4 requests round-robined across both instances, same window.
    const results = [
      await instanceA.claim(key, now, limit, windowMs),
      await instanceB.claim(key, now, limit, windowMs),
      await instanceA.claim(key, now, limit, windowMs),
      await instanceB.claim(key, now, limit, windowMs),
    ];

    // Assert: exactly `limit` (3) requests allowed IN TOTAL, not `limit` per
    // instance. A per-process Map would have let instanceB start its own
    // fresh count, allowing all 4.
    expect(results).toEqual([true, true, true, false]);
  });

  it("keys windows independently per tenant+actor key", async () => {
    // Arrange
    const sharedPool = createFakePool();
    const store = createRateLimitStore(sharedPool);

    // Act
    const first = await store.claim("author:tenant-1:user-1", 1_000, 1, 60_000);
    const second = await store.claim("author:tenant-1:user-2", 1_000, 1, 60_000);

    // Assert: a different actor gets its own, independent budget.
    expect(first).toBe(true);
    expect(second).toBe(true);
  });

  it("resets the shared ceiling once the window elapses, across instances", async () => {
    // Arrange
    const sharedPool = createFakePool();
    const instanceA = createRateLimitStore(sharedPool);
    const instanceB = createRateLimitStore(sharedPool);
    const key = "assist:tenant-1:user-1";
    const limit = 1;
    const windowMs = 60_000;

    // Act + Assert
    expect(await instanceA.claim(key, 1_000, limit, windowMs)).toBe(true);
    expect(await instanceB.claim(key, 1_500, limit, windowMs)).toBe(false); // still in window, shared
    expect(
      await instanceB.claim(key, 1_000 + windowMs, limit, windowMs),
    ).toBe(true); // window elapsed -> reset
  });
});
