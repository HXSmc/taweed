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
  return new Pool({ connectionString });
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
