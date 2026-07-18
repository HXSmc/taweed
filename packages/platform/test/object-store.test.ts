import { describe, it, expect, afterEach } from "vitest";
import { InMemoryObjectStore, tenantKey } from "@taweed/platform";

// EXECUTE C — object store is a typed swap (local dev stub now, S3-compatible
// KSA-region config at DEPLOY). The dev stub keys every object under its tenant so
// isolation holds even before the real bucket exists.

describe("InMemoryObjectStore", () => {
  it("round-trips a stored object", async () => {
    const store = new InMemoryObjectStore();
    const bytes = new TextEncoder().encode("raw bundle");
    await store.put("t1", "bundles/a.json", bytes);
    const got = await store.get("t1", "bundles/a.json");
    expect(got && new TextDecoder().decode(got)).toBe("raw bundle");
    expect(await store.exists("t1", "bundles/a.json")).toBe(true);
  });

  it("scopes objects per tenant — one tenant cannot read another's key", async () => {
    const store = new InMemoryObjectStore();
    await store.put("t1", "x", new Uint8Array([1]));
    expect(await store.get("t2", "x")).toBeNull();
    expect(await store.exists("t2", "x")).toBe(false);
  });

  it("deletes an object", async () => {
    const store = new InMemoryObjectStore();
    await store.put("t1", "x", new Uint8Array([1]));
    await store.delete("t1", "x");
    expect(await store.exists("t1", "x")).toBe(false);
  });
});

describe("tenantKey", () => {
  it("namespaces a key under its tenant", () => {
    expect(tenantKey("t1", "bundles/a.json")).toBe("t1/bundles/a.json");
  });
});

describe("InMemoryObjectStore production guard", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDevStoreFlag = process.env.TAWEED_ENABLE_DEV_OBJECT_STORE;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalDevStoreFlag === undefined) {
      delete process.env.TAWEED_ENABLE_DEV_OBJECT_STORE;
    } else {
      process.env.TAWEED_ENABLE_DEV_OBJECT_STORE = originalDevStoreFlag;
    }
  });

  it("refuses to construct in production without the explicit override", () => {
    process.env.NODE_ENV = "production";
    delete process.env.TAWEED_ENABLE_DEV_OBJECT_STORE;
    expect(() => new InMemoryObjectStore()).toThrow(/non-persistent|not.*production/i);
  });

  it("allows construction in production when TAWEED_ENABLE_DEV_OBJECT_STORE=1 is set", () => {
    process.env.NODE_ENV = "production";
    process.env.TAWEED_ENABLE_DEV_OBJECT_STORE = "1";
    expect(() => new InMemoryObjectStore()).not.toThrow();
  });

  it("allows construction outside production regardless of the override", () => {
    process.env.NODE_ENV = "test";
    delete process.env.TAWEED_ENABLE_DEV_OBJECT_STORE;
    expect(() => new InMemoryObjectStore()).not.toThrow();
  });
});
