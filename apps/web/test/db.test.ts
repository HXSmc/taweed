import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Regression coverage: listDemoAccounts() must return accounts exactly when
// DEV_AUTH_ENABLED (lib/dev-auth-flag.ts) is true, and an empty list
// otherwise — never an independently hand-rolled, stricter check. A prior
// version gated on `NODE_ENV === "development"` alone, which silently
// diverged from DEV_AUTH_ENABLED's broader allow-list (NODE_ENV ===
// "development" OR TAWEED_ENABLE_DEV_AUTH === "1") and broke CI's E2E job:
// `next start` is a production build (NODE_ENV="production"), and CI sets
// TAWEED_ENABLE_DEV_AUTH=1 specifically so the e2e webServer can sign in —
// the old NODE_ENV-only guard returned an empty list there, so no demo
// account buttons ever rendered and every E2E test that needed to sign in
// timed out waiting for one. This suite pins all three real cases.

const query = vi.fn();
const release = vi.fn();
const connect = vi.fn(async () => ({ query, release }));

vi.mock("@taweed/db", () => ({
  getPool: vi.fn(() => ({ connect })),
  withTenant: vi.fn(),
}));

describe("listDemoAccounts", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDevAuthOverride = process.env.TAWEED_ENABLE_DEV_AUTH;

  beforeEach(() => {
    vi.resetModules();
    query.mockReset();
    release.mockReset();
    connect.mockClear();
  });

  afterEach(() => {
    // NODE_ENV is readonly under the ProcessEnv type; cast to assign it back.
    (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
    process.env.TAWEED_ENABLE_DEV_AUTH = originalDevAuthOverride;
  });

  it("returns an empty list without querying the DB when dev auth is fully disabled", async () => {
    // Arrange — production, no override: DEV_AUTH_ENABLED is false.
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.TAWEED_ENABLE_DEV_AUTH;
    const { listDemoAccounts } = await import("../lib/db");

    // Act
    const accounts = await listDemoAccounts();

    // Assert — fails closed, and never reaches the admin pool at all.
    expect(accounts).toEqual([]);
    expect(connect).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it("returns the mapped identity rows in genuine local dev (NODE_ENV=development)", async () => {
    // Arrange
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    delete process.env.TAWEED_ENABLE_DEV_AUTH;
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

  it("returns accounts in a production build with TAWEED_ENABLE_DEV_AUTH=1 (the CI e2e scenario)", async () => {
    // Arrange — exactly CI's e2e job: `next start` forces NODE_ENV=production,
    // and the workflow sets TAWEED_ENABLE_DEV_AUTH=1 so the webServer can sign
    // in as a demo account. This is the case the prior NODE_ENV-only guard
    // silently broke.
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.TAWEED_ENABLE_DEV_AUTH = "1";
    query.mockResolvedValue({
      rows: [
        {
          id: "user-2",
          tenant_id: "tenant-2",
          tenant_name: "Al Salama Dental Group",
          role: "owner",
          locale: "en",
          email: "owner@al-salama-dental-gro.dev",
        },
      ],
    });
    const { listDemoAccounts } = await import("../lib/db");

    // Act
    const accounts = await listDemoAccounts();

    // Assert
    expect(accounts).toEqual([
      {
        id: "user-2",
        tenantId: "tenant-2",
        tenantName: "Al Salama Dental Group",
        role: "owner",
        locale: "en",
        email: "owner@al-salama-dental-gro.dev",
      },
    ]);
    expect(release).toHaveBeenCalledTimes(1);
  });
});
