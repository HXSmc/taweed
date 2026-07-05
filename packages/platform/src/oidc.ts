// EXECUTE C — KSA-resident OIDC config as a typed swap (build-plan §4, NEXT_STEP
// §C, blocker BLK-7). The dev Credentials provider in apps/web/lib/auth.ts stays
// for local only; production swaps in a KSA-resident managed OIDC provider. Only
// the provider config changes — the session shape, callbacks, and every
// withSession call stay identical.
//
// TODO(ksa-oidc)/DEPLOY: no KSA-resident PDPL-compliant IdP is chosen yet (BLK-7).
// When one is, supply issuer/clientId/clientSecret from the secrets manager and
// map its claims to { tenantId, role } below.

export interface KsaOidcConfig {
  /** OIDC issuer / discovery URL of the KSA-resident IdP. */
  issuer: string;
  clientId: string;
  clientSecret: string;
  /** Allowed redirect URIs registered with the IdP. */
  redirectUris: string[];
}

/** The claim -> app mapping the OIDC callback must produce. tenant_id STILL derives
 *  server-side from the verified token, never client input. */
export interface OidcClaimMapping {
  tenantIdClaim: string; // e.g. "https://taweed.sa/tenant_id"
  roleClaim: string; // e.g. "https://taweed.sa/role"
  localeClaim?: string;
}

/**
 * Build the KSA OIDC config from environment. Throws if wired on in production
 * without the required secrets, so a half-configured provider fails closed rather
 * than silently degrading to dev auth. Returns null when not configured (dev).
 */
export function ksaOidcConfigFromEnv(
  env: Record<string, string | undefined>,
): KsaOidcConfig | null {
  const issuer = env.TAWEED_OIDC_ISSUER;
  if (!issuer) return null;
  const clientId = env.TAWEED_OIDC_CLIENT_ID;
  const clientSecret = env.TAWEED_OIDC_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "TAWEED_OIDC_ISSUER set but client id/secret missing — refusing partial OIDC config.",
    );
  }
  const redirectUris = (env.TAWEED_OIDC_REDIRECT_URIS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { issuer, clientId, clientSecret, redirectUris };
}
