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
import "server-only";
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

/** Cap on the redacted audit-write-failure message logged to ops. */
const AUDIT_LOG_ERROR_MAX_LEN = 300;

/**
 * Redact an audit-write-failure error before it reaches server logs. The raw
 * caught value (a Postgres driver error or an Anthropic SDK error) can carry
 * more than a message — stack traces, `.cause` chains, and (for SDK errors)
 * response headers/body — any of which may echo request/response detail that
 * does not belong in a hashes-only audit trail's operational logs. Only the
 * error's own `name: message` is kept, and only up to a bounded length, so
 * ops still sees enough to diagnose "the audit DB is failing" without the
 * full object (and everything nested inside it) being dumped verbatim.
 */
export function redactAuditError(err: unknown): string {
  const summary = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return summary.length > AUDIT_LOG_ERROR_MAX_LEN
    ? `${summary.slice(0, AUDIT_LOG_ERROR_MAX_LEN)}…[truncated]`
    : summary;
}

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
    ).catch((auditErr: unknown) => {
      // Never let an audit-write failure MASK the provider error (rethrown
      // below). But do not swallow it silently either — a failed audit write is
      // a compliance-trail gap ops must be able to see.
      console.error(
        `[llm-audit] write FAILED on the provider-error path (feature=${ctx.feature}); the provider error is preserved but this attempt is UNAUDITED`,
        redactAuditError(auditErr),
      );
    });
    throw err;
  }

  try {
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
  } catch (auditErr) {
    // A successful, billable model call that cannot be audited must NOT be served
    // silently — the audit trail is the compliance control, so fail CLOSED. But
    // fail LOUDLY (distinct log) so ops can tell "audit DB failing" apart from
    // "AI intentionally off". The generated answer is intentionally discarded.
    console.error(
      `[llm-audit] write FAILED after a SUCCESSFUL call (feature=${ctx.feature}); failing closed — the generated answer is discarded because it cannot be audited`,
      redactAuditError(auditErr),
    );
    throw auditErr;
  }

  if (result.parsed === null) {
    throw new Error(
      `AI response failed schema validation for ${ctx.req.schemaName}`,
    );
  }
  return result.parsed;
}
