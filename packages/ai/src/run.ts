// Internal audited runner (plan 04 §5). NOT exported from index.ts — feature
// functions are the only public surface, and they all route through here, so an
// LLM call can never skip the audit row or a kill switch. Three-layer switch:
// global env + per-feature env (config.ts) + per-tenant DB flag (below).
//
// CRITICAL: the provider (network) call happens OUTSIDE any DB transaction. Each
// DB step (tenant check, audit write) opens its own SHORT withTenant transaction
// and releases the pooled connection immediately — a slow/hung LLM call never
// holds a Postgres connection, so it cannot exhaust the shared pool and block
// other tenants (security review, availability).
import { withTenant, schema, type Pool, type Database } from "@taweed/db";
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
 * fail-closed gate; this table exists to turn a single tenant OFF. MUST run
 * inside a withTenant transaction (the caller supplies `db`).
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
  pool: Pool;
  tenantId: string;
  provider: LlmProvider;
  req: StructuredRequest<T>;
  /** compact kill-switch snapshot recorded on the audit row. */
  flagsState?: string;
  env?: NodeJS.ProcessEnv;
}

/**
 * Run one structured call through every kill switch and the audit trail. Writes
 * an llm_calls row for EVERY attempt that leaves the trust boundary — a normal
 * response, a schema-parse failure, AND a provider exception (network/timeout/
 * auth) — so the compliance trail captures exactly the failures an audit exists
 * to catch. Returns the parsed output; throws AiDisabledError when a switch is
 * off (callers fall back to deterministic) and rethrows a provider error after
 * auditing it.
 */
export async function runStructured<T>(ctx: RunContext<T>): Promise<T> {
  if (!isFeatureEnabled(ctx.feature, ctx.env)) {
    throw new AiDisabledError(`feature '${ctx.feature}' is disabled`);
  }
  const tenantOk = await withTenant(ctx.pool, ctx.tenantId, (db) =>
    isTenantAiEnabled(db),
  );
  if (!tenantOk) throw new AiDisabledError("tenant AI flag is off");

  const promptSha256 = sha256Hex(`${ctx.req.system}\n${ctx.req.user}`);
  const purpose = PURPOSE_BY_FEATURE[ctx.feature];

  let result;
  try {
    // No DB transaction is held across this network call.
    result = await ctx.provider.client.parseStructured(ctx.req);
  } catch (err) {
    // Audit the attempt even when the provider throws — the request already
    // crossed the boundary. Never let an audit failure mask the provider error.
    await withTenant(ctx.pool, ctx.tenantId, (db) =>
      writeLlmCall(db, {
        actorId: ctx.actor,
        purpose,
        model: ctx.provider.mapModelId(ctx.req.model),
        provider: ctx.provider.name,
        promptSha256,
        outputSha256: sha256Hex(""),
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        flagsState: ctx.flagsState ?? `${ctx.feature}=error`,
      }),
    ).catch(() => {});
    throw err;
  }

  await withTenant(ctx.pool, ctx.tenantId, (db) =>
    writeLlmCall(db, {
      actorId: ctx.actor,
      purpose,
      model: result.model,
      provider: ctx.provider.name,
      promptSha256,
      outputSha256: sha256Hex(result.rawOutput),
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      cacheReadTokens: result.usage.cacheReadTokens,
      requestId: result.requestId,
      latencyMs: result.latencyMs,
      flagsState: ctx.flagsState ?? `${ctx.feature}=enabled`,
    }),
  );

  if (result.parsed === null) {
    throw new Error(
      `AI response failed schema validation for ${ctx.req.schemaName}`,
    );
  }
  return result.parsed;
}
