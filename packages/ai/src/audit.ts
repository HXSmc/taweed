// @taweed/ai audit — append one llm_calls row per model call (plan 04 §3.3, §5).
// Mirrors @taweed/audit: a pure whitelist guard refuses any field outside the
// hash/meta allowlist (so raw prompt/output or a PHI-bearing field can never
// reach this immutable, exportable trail), plus a defense-in-depth check that
// the *_sha256 fields are actually 64-hex — so raw text accidentally routed
// into a hash column is rejected, not persisted. Row is scoped to the ACTIVE
// RLS tenant, never a passed-in tenant id.
import { sql } from "drizzle-orm";
import { schema, type Database } from "@taweed/db";

export interface LlmCallRow {
  actorId: string;
  purpose: string;
  model: string;
  provider: string;
  promptSha256: string;
  outputSha256: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  requestId?: string | null;
  latencyMs?: number | null;
  flagsState?: string | null;
}

// The ONLY keys an llm_calls row may carry. Anything else (prompt, output,
// patientName, claimId...) means a caller leaked raw text/PHI into the trail.
const ALLOWED_KEYS: ReadonlySet<string> = new Set([
  "actorId",
  "purpose",
  "model",
  "provider",
  "promptSha256",
  "outputSha256",
  "inputTokens",
  "outputTokens",
  "cacheReadTokens",
  "requestId",
  "latencyMs",
  "flagsState",
]);

const HEX64 = /^[0-9a-f]{64}$/;

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`llm_calls: "${field}" must be a non-empty string`);
  }
  return value;
}

function requireHash(value: unknown, field: string): string {
  const s = requireString(value, field);
  // A raw prompt/output routed into a hash column is not 64-hex — reject it.
  if (!HEX64.test(s)) {
    throw new Error(
      `llm_calls: "${field}" must be a 64-char sha256 hex (possible raw-text/PHI leak)`,
    );
  }
  return s;
}

function requireCount(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`llm_calls: "${field}" must be a non-negative integer`);
  }
  return value;
}

/**
 * Whitelist-narrow an untrusted object into an LlmCallRow. Throws if it carries
 * any key outside the allowlist (assumed PHI/raw-text leak), a missing required
 * field, or a *_sha256 that isn't a hash. Pure + unit-testable.
 */
export function sanitizeLlmCallRow(row: Record<string, unknown>): LlmCallRow {
  for (const key of Object.keys(row)) {
    if (!ALLOWED_KEYS.has(key)) {
      throw new Error(
        `llm_calls: unexpected key "${key}" (possible PHI/raw-text leak)`,
      );
    }
  }
  const safe: LlmCallRow = {
    actorId: requireString(row.actorId, "actorId"),
    purpose: requireString(row.purpose, "purpose"),
    model: requireString(row.model, "model"),
    provider: requireString(row.provider, "provider"),
    promptSha256: requireHash(row.promptSha256, "promptSha256"),
    outputSha256: requireHash(row.outputSha256, "outputSha256"),
    inputTokens: requireCount(row.inputTokens, "inputTokens"),
    outputTokens: requireCount(row.outputTokens, "outputTokens"),
    cacheReadTokens: requireCount(row.cacheReadTokens, "cacheReadTokens"),
  };
  if (row.requestId !== undefined && row.requestId !== null) {
    safe.requestId = requireString(row.requestId, "requestId");
  }
  if (row.latencyMs !== undefined && row.latencyMs !== null) {
    safe.latencyMs = requireCount(row.latencyMs, "latencyMs");
  }
  if (row.flagsState !== undefined && row.flagsState !== null) {
    safe.flagsState = requireString(row.flagsState, "flagsState");
  }
  return safe;
}

/**
 * Append exactly one llm_calls row. MUST run inside withTenant(...): tenant_id
 * is read from the active RLS GUC, never passed in. Re-sanitizes as defense in
 * depth even though callers use the typed shape.
 */
export async function writeLlmCall(
  db: Database,
  row: LlmCallRow,
): Promise<void> {
  const safe = sanitizeLlmCallRow({ ...row });
  await db.insert(schema.llmCalls).values({
    tenant_id: sql`current_setting('app.tenant_id')::uuid`,
    actor_id: safe.actorId,
    purpose: safe.purpose,
    model: safe.model,
    provider: safe.provider,
    prompt_sha256: safe.promptSha256,
    output_sha256: safe.outputSha256,
    input_tokens: safe.inputTokens,
    output_tokens: safe.outputTokens,
    cache_read_tokens: safe.cacheReadTokens,
    request_id: safe.requestId ?? null,
    latency_ms: safe.latencyMs ?? null,
    flags_state: safe.flagsState ?? null,
  });
}
