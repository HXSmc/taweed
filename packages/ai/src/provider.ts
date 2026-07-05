import type * as z from "zod/v4";
import type { TaweedModel } from "./models.js";

// Typed provider-swap surface (plan 04 §5), mirroring the OcrAdapter / platform
// typed-swap pattern. The provider's `client` is a NARROW interface — never the
// raw @anthropic-ai/sdk instance — so the raw client cannot be exported and an
// LLM call cannot skip the audited runner (run.ts). Bedrock / Vertex /
// self-hosted providers implement the same LlmClient later without touching
// feature code.

/** One structured-output request. `schema` is authored with zod/v4 (the SDK helper's zod). */
export interface StructuredRequest<T> {
  model: TaweedModel;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  /** Stable schema identity — part of the fixture key and the audit trail. */
  schemaName: string;
  maxTokens: number;
  /** Prompt-cache the system prompt (plan 04 §4.4). */
  cacheSystem?: boolean;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
}

export interface StructuredResult<T> {
  /** null when the model output failed schema validation — the caller guards. */
  parsed: T | null;
  /** concrete provider model id actually used. */
  model: string;
  requestId: string;
  usage: LlmUsage;
  latencyMs: number;
  /** JSON string of the parsed output, for output hashing only ("" when parsed is null). */
  rawOutput: string;
}

export interface LlmClient {
  parseStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>>;
}

export interface LlmProvider {
  /** Provider identity recorded in the audit trail (e.g. "anthropic-1p", "fixture"). */
  name: string;
  client: LlmClient;
  mapModelId(model: TaweedModel): string;
  /** Batches is NOT ZDR-eligible — gated off for PHI-adjacent calls (plan 04 §3.3). */
  capabilities: { batches: boolean; files: boolean };
}
