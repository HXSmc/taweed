/**
 * Thrown by the audited runner when any kill switch is off (global env,
 * per-feature env, or per-tenant DB flag). Callers MUST catch this and fall
 * back to the deterministic path that always exists (plan 04 §5) — the LLM
 * layer is additive, never load-bearing.
 */
export class AiDisabledError extends Error {
  readonly code = "AI_DISABLED" as const;
  constructor(reason: string) {
    super(`AI disabled: ${reason}`);
    this.name = "AiDisabledError";
  }
}

export function isAiDisabledError(err: unknown): err is AiDisabledError {
  return err instanceof AiDisabledError;
}

/**
 * Thrown when a feature is ENABLED (global + per-feature switch on) but the
 * provider is not configured — e.g. TAWEED_AI_ENABLED=true with no
 * ANTHROPIC_API_KEY. This is a MISCONFIGURATION, deliberately DISTINCT from
 * AiDisabledError (a deliberate off-state): callers must be able to tell
 * "operator turned AI off" apart from "operator meant AI on but it's broken",
 * so a misconfig fails LOUD (logged/alerted) instead of silently degrading to
 * the same "unavailable" as off. Still non-load-bearing: the caller falls back
 * to the deterministic path, but it MUST surface this distinctly.
 */
export class AiConfigError extends Error {
  readonly code = "AI_MISCONFIGURED" as const;
  constructor(reason: string) {
    super(`AI misconfigured: ${reason}`);
    this.name = "AiConfigError";
  }
}

export function isAiConfigError(err: unknown): err is AiConfigError {
  return err instanceof AiConfigError;
}
