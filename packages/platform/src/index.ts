// @taweed/platform — DEPLOY-prep typed swaps (EXECUTE §C). Object store, per-tenant
// KMS envelope encryption, and KSA-resident OIDC config. Dev implementations run
// now; each is a typed seam a real KSA-region client drops into at DEPLOY without
// touching callers. No live infra here.
export {
  InMemoryObjectStore,
  tenantKey,
  type ObjectStore,
  type S3ObjectStoreConfig,
} from "./object-store.js";
export {
  DevPassthroughKms,
  type TenantKms,
  type EnvelopeCiphertext,
} from "./kms.js";
export {
  ksaOidcConfigFromEnv,
  type KsaOidcConfig,
  type OidcClaimMapping,
} from "./oidc.js";
