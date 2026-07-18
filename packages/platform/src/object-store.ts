// EXECUTE C — object store as a typed swap (build-plan §4/§10, NEXT_STEP §C).
// Raw bundles / generated PDFs / supporting docs live here. The interface is
// stable; only the implementation swaps: InMemoryObjectStore for dev/tests today,
// an S3-compatible client pinned to the KSA region (Oracle Cloud Riyadh,
// me-riyadh-1) at DEPLOY. Every key is namespaced under its tenant so isolation
// holds at the storage layer too.

/** Prefix an object key with its tenant so keys never collide across tenants. */
export function tenantKey(tenantId: string, key: string): string {
  return `${tenantId}/${key}`;
}

export interface ObjectStore {
  put(tenantId: string, key: string, bytes: Uint8Array): Promise<void>;
  get(tenantId: string, key: string): Promise<Uint8Array | null>;
  exists(tenantId: string, key: string): Promise<boolean>;
  delete(tenantId: string, key: string): Promise<void>;
}

/** Config for the real S3-compatible store. TODO(ksa-region)/DEPLOY: inject at boot. */
export interface S3ObjectStoreConfig {
  region: string; // e.g. "me-riyadh-1"
  endpoint: string; // S3-compatible endpoint (Oracle Object Storage)
  bucket: string;
  // Credentials come from the secrets manager, NEVER the repo.
  accessKeyId: string;
  secretAccessKey: string;
  // Server-side encryption at rest (AES-256) is required (PDPL, build-plan §6).
  serverSideEncryption: "AES256" | "aws:kms";
}

/**
 * Dev/test object store — in-process, per-tenant namespaced. Not for production:
 * bytes live in plain process memory (no persistence, no encryption at rest), so
 * — mirroring how kms.ts's DevPassthroughKms fails closed in production — the
 * constructor refuses to run in production unless TAWEED_ENABLE_DEV_OBJECT_STORE=1
 * is explicitly set. This cannot ship as the live object store by accident.
 * TODO(ksa-region)/DEPLOY: swap for the real S3-compatible client; delete this stub.
 */
export class InMemoryObjectStore implements ObjectStore {
  private readonly blobs = new Map<string, Uint8Array>();

  constructor() {
    const isProd = process.env.NODE_ENV === "production";
    const devStoreEnabled = !isProd || process.env.TAWEED_ENABLE_DEV_OBJECT_STORE === "1";
    if (!devStoreEnabled) {
      throw new Error(
        "InMemoryObjectStore is a non-persistent, unencrypted dev/test stub and must not " +
          "be used in production. Set TAWEED_ENABLE_DEV_OBJECT_STORE=1 to override explicitly, " +
          "or wire a real ObjectStore implementation.",
      );
    }
  }

  async put(tenantId: string, key: string, bytes: Uint8Array): Promise<void> {
    this.blobs.set(tenantKey(tenantId, key), bytes);
  }

  async get(tenantId: string, key: string): Promise<Uint8Array | null> {
    return this.blobs.get(tenantKey(tenantId, key)) ?? null;
  }

  async exists(tenantId: string, key: string): Promise<boolean> {
    return this.blobs.has(tenantKey(tenantId, key));
  }

  async delete(tenantId: string, key: string): Promise<void> {
    this.blobs.delete(tenantKey(tenantId, key));
  }
}
