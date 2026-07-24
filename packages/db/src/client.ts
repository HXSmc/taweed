import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

const { Pool } = pg;

export type Pool = pg.Pool;
export type Database = NodePgDatabase<typeof schema>;

export function getPool(connectionString = process.env.DATABASE_URL): Pool {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  // TCP keepalive: a defensive hardening measure, not a confirmed fix — see
  // docs/audit docs/audit.md's 2026-07-24 entry for the full investigation.
  // The theory (never confirmed with direct evidence): a connection sitting
  // idle mid-transaction (seed-data.ts's per-tenant loop does CPU-bound
  // bundle generation between DB round trips) could have its socket silently
  // dropped by a middlebox/proxy between here and Neon with no RST sent,
  // hanging the next query forever instead of erroring cleanly. Two live,
  // monitored (pg_stat_activity polled every 2s throughout) reproduction
  // attempts against the real prod Neon DB — WITHOUT this fix — both
  // completed successfully (one cut short by an initial too-tight test
  // timeout, one ran to full completion with exact expected row-count
  // parity). The original "hung 5/5 times" report could not be reproduced
  // under current conditions, so this fix is applied as cheap, correct,
  // zero-downside TCP hygiene for a proxied connection — not as a proven
  // root-cause fix. If the hang recurs, re-open the investigation with fresh
  // instrumentation rather than assuming this line already covers it.
  return new Pool({
    connectionString,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });
}

/**
 * Run `fn` inside a transaction with `app.tenant_id` set for the duration, so
 * Row-Level Security scopes every query to that tenant. Commits on success,
 * rolls back on error. This is the ONLY sanctioned entry point for tenant data.
 */
export async function withTenant<T>(
  pool: Pool,
  tenantId: string,
  fn: (db: Database) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // is_local=true → transaction-scoped, like SET LOCAL, but parameterized.
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [
      tenantId,
    ]);
    const db = drizzle(client, { schema });
    const result = await fn(db);
    await client.query("COMMIT");
    return result;
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
}
