// Internal audited runner (plan 04 §5). NOT exported from index.ts — feature
// functions are the only public surface, and they all route through here, so an
// LLM call can never skip the audit row or a kill switch. Three-layer switch:
// global env + per-feature env (config.ts) + per-tenant DB flag (below).
import { schema, type Database } from "@taweed/db";
import { AiDisabledError } from "./errors.js";
import { isFeatureEnabled, type AiFeature } from "./config.js";
import { sha256Hex } from "./sha256.js";
import { writeLlmCall } from "./audit.js";
import type { LlmProvider, StructuredRequest } from "./provider.js";

const PURPOSE_BY_FEATURE: Record<AiFeature, string> = {
  explain: "explain",
  appeal: "appeal",
  authorRule: "author_rule",
  extractEob: "extract_eob",
};

/**
 * Per-tenant kill switch. Reads tenant_ai_settings under RLS (so it can only see
 * the active tenant's row). No row => enabled: the global env switch is the
 * fail-closed gate; this table exists to turn a single tenant OFF.
 */
export async function isTenantAiEnabled(db: Database): Promise<boolean> {
  const rows = await db
    .select({ enabled: schema.tenantAiSettings.ai_enabled })
    .from(schema.tenantAiSettings)
    .limit(1);
  const first = rows[0];
  if (first === undefined) return true;
  return first.enabled === true;
}

export interface RunContext<T> {
  actor: string;
  feature: AiFeature;
  db: Database;
  provider: LlmProvider;
  req: StructuredRequest<T>;
  /** compact kill-switch snapshot recorded on the audit row. */
  flagsState?: string;
  env?: NodeJS.ProcessEnv;
}

/**
 * Run one structured call through every kill switch and the audit trail. Writes
 * the llm_calls row on EVERY completed provider call — including a parse failure
 * (a call was made, tokens spent) — before throwing. Returns the parsed output.
 * Throws AiDisabledError when a switch is off; callers fall back to deterministic.
 */
export async function runStructured<T>(ctx: RunContext<T>): Promise<T> {
  if (!isFeatureEnabled(ctx.feature, ctx.env)) {
    throw new AiDisabledError(`feature '${ctx.feature}' is disabled`);
  }
  if (!(await isTenantAiEnabled(ctx.db))) {
    throw new AiDisabledError(`tenant AI flag is off`);
  }

  const result = await ctx.provider.client.parseStructured(ctx.req);

  await writeLlmCall(ctx.db, {
    actorId: ctx.actor,
    purpose: PURPOSE_BY_FEATURE[ctx.feature],
    model: result.model,
    provider: ctx.provider.name,
    // Hashes only — never the raw prompt or output (plan 04 §3.3).
    promptSha256: sha256Hex(`${ctx.req.system}\n${ctx.req.user}`),
    outputSha256: sha256Hex(result.rawOutput),
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    cacheReadTokens: result.usage.cacheReadTokens,
    requestId: result.requestId,
    latencyMs: result.latencyMs,
    flagsState: ctx.flagsState ?? `${ctx.feature}=enabled`,
  });

  if (result.parsed === null) {
    throw new Error(
      `AI response failed schema validation for ${ctx.req.schemaName}`,
    );
  }
  return result.parsed;
}
