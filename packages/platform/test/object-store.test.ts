import { describe, it, expect } from "vitest";
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
