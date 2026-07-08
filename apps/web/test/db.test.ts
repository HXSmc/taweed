import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Regression coverage for the audit finding: listDemoAccounts() must never
// run its unauthenticated, no-tenant-filter query outside genuine local dev.
// `DEV_AUTH_ENABLED` (lib/auth.ts) is broader than NODE_ENV === "development"
// — it also permits TAWEED_ENABLE_DEV_AUTH=1 in a deployed environment — so a
// guard keyed only on that flag would still let /login enumerate every
// tenant's user id/email/role/tenant name when that override is set. This
// test pins the fail-closed NODE_ENV check in lib/db.ts itself.

const query = vi.fn();
const release = vi.fn();
const connect = vi.fn(async () => ({ query, release }));

vi.mock("@taweed/db", () => ({
  getPool: vi.fn(() => ({ connect })),
  withTenant: vi.fn(),
}));

describe("listDemoAccounts", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.resetModules();
    query.mockReset();
    release.mockReset();
    connect.mockClear();
  });

  afterEach(() => {
    // NODE_ENV is readonly under the ProcessEnv type; cast to assign it back.
    (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
  });

  it("returns an empty list without querying the DB outside genuine local dev", async () => {
    // Arrange — the exact condition the finding warns about: dev auth reachable
    // in a deployed environment (e.g. TAWEED_ENABLE_DEV_AUTH=1 in production).
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    const { listDemoAccounts } = await import("../lib/db");

    // Act
    const accounts = await listDemoAccounts();

    // Assert — fails closed, and never reaches the admin pool at all.
    expect(accounts).toEqual([]);
    expect(connect).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it("returns the mapped identity rows in genuine local dev", async () => {
    // Arrange
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    query.mockResolvedValue({
      rows: [
        {
          id: "user-1",
          tenant_id: "tenant-1",
          tenant_name: "Demo Tenant",
          role: "owner",
          locale: "en",
          email: "owner@demo.test",
        },
      ],
    });
    const { listDemoAccounts } = await import("../lib/db");

    // Act
    const accounts = await listDemoAccounts();

    // Assert
    expect(accounts).toEqual([
      {
        id: "user-1",
        tenantId: "tenant-1",
        tenantName: "Demo Tenant",
        role: "owner",
        locale: "en",
        email: "owner@demo.test",
      },
    ]);
    expect(release).toHaveBeenCalledTimes(1);
  });
});
