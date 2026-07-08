// Kill switches (plan 04 §3.3, §5). Fails CLOSED like the B5 data_origin gate:
// the global switch must be the exact string "true" — anything else (unset,
// "1", "false", "TRUE", "") reads as OFF. A feature also needs its own explicit
// env opt-in, so enabling AI globally never silently enables every surface.
//
// The third layer — a per-tenant DB flag — is resolved at call time in run.ts
// (it needs a Database); this module is pure env resolution only.
//
// `import "server-only"` matches every other secret-adjacent file in this
// package (run.ts, anthropic-1p.ts, audit.ts): this module reads
// ANTHROPIC_API_KEY (missingProviderConfig) and drives the AI kill switches,
// so it must fail a client bundle build the same way they do rather than
// compiling silently into client code via a stray non-type-only barrel import.
import "server-only";

export type AiFeature = "explain" | "appeal" | "authorRule" | "extractEob";

const FEATURE_ENV: Record<AiFeature, string> = {
  explain: "TAWEED_AI_EXPLAIN_ENABLED",
  appeal: "TAWEED_AI_APPEAL_ENABLED",
  authorRule: "TAWEED_AI_AUTHOR_RULE_ENABLED",
  extractEob: "TAWEED_AI_EXTRACT_EOB_ENABLED",
};

/** Global switch. Only the exact string "true" enables AI — fails closed. */
export function isAiEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.TAWEED_AI_ENABLED === "true";
}

/**
 * A feature is enabled only when BOTH the global switch AND that feature's own
 * env flag are exactly "true". Defense in depth: turning AI on globally does not
 * turn on any individual surface.
 */
export function isFeatureEnabled(
  feature: AiFeature,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!isAiEnabled(env)) return false;
  return env[FEATURE_ENV[feature]] === "true";
}

/** The env var name backing a feature flag (exposed for docs/ops + tests). */
export function featureEnvVar(feature: AiFeature): string {
  return FEATURE_ENV[feature];
}

/**
 * On the LIVE path (no test/dev provider injected), the Anthropic client reads
 * ANTHROPIC_API_KEY from the environment. If a feature is enabled but the key is
 * absent, that is a MISCONFIGURATION, not an off-state — return the reason so the
 * caller can throw AiConfigError and fail LOUD (distinct from AiDisabledError),
 * rather than letting the SDK throw an auth error at request time that collapses
 * into the same silent "unavailable" as a deliberate off. Returns null when the
 * live provider can be constructed. Only call this when no provider is injected.
 */
export function missingProviderConfig(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const key = env.ANTHROPIC_API_KEY;
  if (key === undefined || key.trim() === "") {
    return "ANTHROPIC_API_KEY is not set (feature enabled but provider unconfigured)";
  }
  return null;
}
