import { describe, it, expect } from "vitest";
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
