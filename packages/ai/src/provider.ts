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
  /**
   * Additional documents (currently PDF only) attached to the user turn — e.g.
   * AI-4's payer EOB/remittance extraction (plan 04 §4.1, §9). Provider-neutral:
   * a bare base64 payload, not an Anthropic SDK content-block type, so this
   * interface stays implementable by a future Bedrock/Vertex provider without
   * leaking SDK types here. Rendered before the `user` text block (Claude PDF
   * docs' recommended ordering). Never prompt-cached — each document is
   * unique per call, so caching it would only pay the write premium.
   * `promptSha256` (run.ts / callers) is derived from `system`+`user` only, NOT
   * these bytes — it identifies the instruction template, not the document;
   * per-call/per-document identity comes from the provider's `requestId` plus
   * whatever caller-side document id the feature function threads through.
   */
  documents?: readonly { base64: string }[];
  schema: z.ZodType<T>;
  /** Stable schema identity — part of the fixture key and the audit trail. */
  schemaName: string;
  maxTokens: number;
  /** Prompt-cache the system prompt (plan 04 §4.4). */
  cacheSystem?: boolean;
  /**
   * Per-request timeout override in ms. The provider's default
   * (REQUEST_TIMEOUT_MS in anthropic-1p.ts) is sized for small structured-
   * extraction payloads; a request carrying a `documents` attachment (AI-4's
   * PDF extraction) is a materially heavier vision workload and should set
   * this explicitly rather than share that default.
   */
  timeoutMs?: number;
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
  /**
   * Batches is NOT ZDR-eligible, so `batches` DECLARES that this provider
   * keeps it off for PHI-adjacent calls (plan 04 §3.3). This is NOT an
   * enforced runtime gate — no code path currently issues a Batches request,
   * so nothing reads this field today. Any future Batches-based feature MUST
   * check `capabilities.batches` (and add an explicit ZDR gate) before
   * routing a PHI-adjacent call through it.
   */
  capabilities: { batches: boolean; files: boolean };
}
