// EXECUTE C — per-tenant KMS envelope encryption as a typed swap (build-plan §6,
// NEXT_STEP §C). Each tenant's PHI is encrypted under its own data key, wrapped by
// a tenant-scoped KMS master key. The interface is what callers depend on; the
// implementation swaps to a real KSA-region KMS at DEPLOY.
//
// The dev implementation is a REVERSIBLE TRANSFORM, not real cryptography — it
// exists only to exercise the envelope interface and the per-tenant key binding.
// TODO(ksa-kms)/DEPLOY: replace DevPassthroughKms with a real KMS client.

export interface EnvelopeCiphertext {
  /** Tenant whose key wrapped this ciphertext — checked on decrypt. */
  tenantId: string;
  /** Key id / version used, for rotation + audit. */
  keyId: string;
  /** Wrapped bytes. */
  ciphertext: Uint8Array;
}

export interface TenantKms {
  encrypt(tenantId: string, plaintext: Uint8Array): Promise<EnvelopeCiphertext>;
  decrypt(tenantId: string, envelope: EnvelopeCiphertext): Promise<Uint8Array>;
}

/**
 * Dev/test KMS stub. XORs bytes with a per-tenant-derived pad (reversible, NOT
 * secure) so the round-trip and the tenant-key binding are testable. Rejects a
 * cross-tenant decrypt, mirroring a real KMS refusing another tenant's key.
 */
export class DevPassthroughKms implements TenantKms {
  private pad(tenantId: string): number {
    let h = 0;
    for (let i = 0; i < tenantId.length; i++) h = (h * 31 + tenantId.charCodeAt(i)) & 0xff;
    return h || 0x5a;
  }

  async encrypt(tenantId: string, plaintext: Uint8Array): Promise<EnvelopeCiphertext> {
    const p = this.pad(tenantId);
    const ciphertext = Uint8Array.from(plaintext, (b) => b ^ p);
    return { tenantId, keyId: `dev-${tenantId}-v1`, ciphertext };
  }

  async decrypt(tenantId: string, envelope: EnvelopeCiphertext): Promise<Uint8Array> {
    if (envelope.tenantId !== tenantId) {
      throw new Error(
        `KMS: ciphertext belongs to tenant ${envelope.tenantId}, not ${tenantId}`,
      );
    }
    const p = this.pad(tenantId);
    return Uint8Array.from(envelope.ciphertext, (b) => b ^ p);
  }
}
