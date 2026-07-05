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
