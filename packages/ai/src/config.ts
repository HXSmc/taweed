// Kill switches (plan 04 §3.3, §5). Fails CLOSED like the B5 data_origin gate:
// the global switch must be the exact string "true" — anything else (unset,
// "1", "false", "TRUE", "") reads as OFF. A feature also needs its own explicit
// env opt-in, so enabling AI globally never silently enables every surface.
//
// The third layer — a per-tenant DB flag — is resolved at call time in run.ts
// (it needs a Database); this module is pure env resolution only.

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
