import { describe, it, expect, afterEach } from "vitest";
import { DevPassthroughKms } from "@taweed/platform";

// EXECUTE C — per-tenant KMS envelope encryption is a typed swap. The dev stub is
// a reversible transform (NOT real crypto) that preserves the interface + the
// per-tenant key binding, so DEPLOY can drop in a real KMS without touching callers.

describe("DevPassthroughKms", () => {
  it("round-trips plaintext through encrypt/decrypt for a tenant", async () => {
    const kms = new DevPassthroughKms();
    const plaintext = new TextEncoder().encode("phi bytes");
    const ct = await kms.encrypt("t1", plaintext);
    const back = await kms.decrypt("t1", ct);
    expect(new TextDecoder().decode(back)).toBe("phi bytes");
  });

  it("refuses to decrypt a ciphertext under a different tenant's key", async () => {
    const kms = new DevPassthroughKms();
    const ct = await kms.encrypt("t1", new TextEncoder().encode("secret"));
    await expect(kms.decrypt("t2", ct)).rejects.toThrow(/tenant/i);
  });
});

describe("DevPassthroughKms production guard", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDevKmsFlag = process.env.TAWEED_ENABLE_DEV_KMS;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalDevKmsFlag === undefined) {
      delete process.env.TAWEED_ENABLE_DEV_KMS;
    } else {
      process.env.TAWEED_ENABLE_DEV_KMS = originalDevKmsFlag;
    }
  });

  it("refuses to construct in production without the explicit override", () => {
    process.env.NODE_ENV = "production";
    delete process.env.TAWEED_ENABLE_DEV_KMS;
    expect(() => new DevPassthroughKms()).toThrow(/reversible transform|not.*real encryption/i);
  });

  it("allows construction in production when TAWEED_ENABLE_DEV_KMS=1 is set", () => {
    process.env.NODE_ENV = "production";
    process.env.TAWEED_ENABLE_DEV_KMS = "1";
    expect(() => new DevPassthroughKms()).not.toThrow();
  });

  it("allows construction outside production regardless of the override", () => {
    process.env.NODE_ENV = "test";
    delete process.env.TAWEED_ENABLE_DEV_KMS;
    expect(() => new DevPassthroughKms()).not.toThrow();
  });
});
