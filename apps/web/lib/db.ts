import "server-only";
import {
  getPool,
  withTenant,
  type Database,
  type Pool,
} from "@taweed/db";

/**
 * Data-access seam for the app. Two connections, mirroring production:
 *  - appPool  → the NOBYPASSRLS `taweed_app` role. EVERY tenant data access goes
 *    through withSession → withTenant, so RLS binds and tenant_id is derived from
 *    the verified session (never client input).
 *  - adminPool → superuser. Used ONLY by the auth identity lookup (find which
 *    tenant an email belongs to at login, before any tenant context exists).
 *    Never used for tenant data.
 *
 * TODO(ksa-oidc)/DEPLOY: real credentials come from the secrets manager and the
 * app role connects with its own least-privilege credentials, not env defaults.
 */
const ADMIN_URL =
  process.env.DATABASE_URL ?? "postgres://taweed:taweed@localhost:5432/taweed";
const APP_ROLE = process.env.TAWEED_APP_ROLE ?? "taweed_app";
const APP_PASSWORD = process.env.TAWEED_APP_PASSWORD ?? "taweed";

function appUrl(adminUrl: string): string {
  const url = new URL(adminUrl);
  url.username = APP_ROLE;
  url.password = APP_PASSWORD;
  return url.toString();
}

// Cache pools on globalThis so Next's dev HMR does not leak connections.
const g = globalThis as unknown as { __taweedAppPool?: Pool; __taweedAdminPool?: Pool };

export function appPool(): Pool {
  g.__taweedAppPool ??= getPool(appUrl(ADMIN_URL));
  return g.__taweedAppPool;
}

export function adminPool(): Pool {
  g.__taweedAdminPool ??= getPool(ADMIN_URL);
  return g.__taweedAdminPool;
}

/** Run tenant-scoped data access with RLS bound to the session's tenant. */
export function withSession<T>(
  tenantId: string,
  fn: (db: Database) => Promise<T>,
): Promise<T> {
  return withTenant(appPool(), tenantId, fn);
}

export interface IdentityUser {
  id: string;
  tenantId: string;
  tenantName: string;
  role: string;
  locale: string;
  email: string;
}

/**
 * Auth-only cross-tenant identity lookup (admin connection). Returns the minimal
 * identity fields needed to mint a session. No PHI. Used exclusively by lib/auth.
 */
export async function findUserByEmail(email: string): Promise<IdentityUser | null> {
  const client = await adminPool().connect();
  try {
    const res = await client.query(
      `SELECT u.id, u.tenant_id, u.role, u.locale, u.email, t.name AS tenant_name
         FROM users u JOIN tenants t ON t.id = u.tenant_id
        WHERE lower(u.email) = lower($1) LIMIT 1`,
      [email],
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      tenantId: row.tenant_id,
      tenantName: row.tenant_name,
      role: row.role,
      locale: row.locale,
      email: row.email,
    };
  } finally {
    client.release();
  }
}

/** Demo accounts for the dev sign-in screen (identity store, no PHI). */
export async function listDemoAccounts(): Promise<IdentityUser[]> {
  const client = await adminPool().connect();
  try {
    const res = await client.query(
      `SELECT u.id, u.tenant_id, u.role, u.locale, u.email, t.name AS tenant_name
         FROM users u JOIN tenants t ON t.id = u.tenant_id
        ORDER BY t.name, u.role`,
    );
    return res.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      tenantName: row.tenant_name,
      role: row.role,
      locale: row.locale,
      email: row.email,
    }));
  } finally {
    client.release();
  }
}
