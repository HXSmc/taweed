import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { mapTaweedModel, LLM_MODEL_IDS } from "./models.js";
import type {
  LlmClient,
  LlmProvider,
  StructuredRequest,
  StructuredResult,
} from "./provider.js";

// Anthropic first-party provider (plan 04 §3.3). Structured output via
// messages.parse() + zodOutputFormat (claude-api skill). NO thinking / effort —
// both error on Haiku 4.5, and the explainer is a small structured extraction.
//
// Data residency is enforced at TWO levels, and they are NOT the same field:
//   - inference_geo: a top-level Messages API REQUEST param that pins where the
//     model runs. @anthropic-ai/sdk >=0.111 types it natively (no spread hack
//     needed). Only sent when the target model supports it — Haiku 4.5 rejects
//     it outright with a 400 ("does not support inference_geo"), which silently
//     broke every AI-1 (explainFlag) call in production until caught live via
//     chrome-devtools MCP (2026-07-16) — prior verification only ever ran
//     AI-1 against the fixture/cached path, never a real key.
//   - Zero Data Retention: an ORG/account-level posture, NOT a request field — it
//     cannot be "set on the request". It is configured on the Anthropic account
//     and, because Batches is not ZDR-eligible, this provider DECLARES
//     capabilities.batches=false below. That is not an enforced runtime gate —
//     no code path issues a Batches request today — it only means a future
//     Batches-based feature must check this flag (and add an explicit ZDR
//     gate) before routing a PHI-adjacent call through Batches.
const INFERENCE_GEO = "us";

/** Haiku 4.5 rejects `inference_geo` with a 400; every other tier accepts it. */
export function supportsInferenceGeo(model: string): boolean {
  return model !== LLM_MODEL_IDS.haiku;
}
//
// The response→result mapping and system-block construction are extracted as
// pure functions so they are unit-testable WITHOUT a live call; the provider is
// only the thin SDK wiring around them.

export interface AnthropicProviderOptions {
  apiKey?: string;
}

/** The subset of the SDK parse response the mapping depends on. */
export interface ParseResponseLike<T> {
  parsed_output: T | null;
  model: string;
  id: string;
  usage: {
    input_tokens: number | null;
    output_tokens: number;
    cache_read_input_tokens: number | null;
  };
}

export type SystemBlock =
  | { type: "text"; text: string }
  | { type: "text"; text: string; cache_control: { type: "ephemeral" } };

/** One system block, optionally prompt-cached (plan 04 §4.4). Pure. */
export function buildSystemBlocks(
  system: string,
  cacheSystem?: boolean,
): [SystemBlock] {
  return [
    cacheSystem
      ? { type: "text", text: system, cache_control: { type: "ephemeral" } }
      : { type: "text", text: system },
  ];
}

export type UserContentBlock =
  | {
      type: "document";
      source: { type: "base64"; media_type: "application/pdf"; data: string };
    }
  | { type: "text"; text: string };

/**
 * The user-turn content: a plain string when there are no documents (the
 * common case — explainFlag/appeal/authorRule), or a document-then-text
 * content-block array (AI-4's PDF extraction; claude-api skill's documented
 * ordering — document blocks before the text block). Pure — never cached
 * (see StructuredRequest.documents doc comment).
 */
export function buildUserContent(
  user: string,
  documents?: readonly { base64: string }[],
): string | UserContentBlock[] {
  if (documents === undefined || documents.length === 0) return user;
  return [
    ...documents.map(
      (doc): UserContentBlock => ({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: doc.base64,
        },
      }),
    ),
    { type: "text", text: user },
  ];
}

/** Map an SDK parse response into our provider-neutral StructuredResult. Pure. */
export function mapParseResponse<T>(
  res: ParseResponseLike<T>,
  latencyMs: number,
): StructuredResult<T> {
  const parsed = res.parsed_output ?? null;
  const rawOutput = parsed === null ? "" : JSON.stringify(parsed);
  return {
    parsed,
    model: res.model,
    requestId: res.id,
    usage: {
      inputTokens: res.usage.input_tokens ?? 0,
      outputTokens: res.usage.output_tokens,
      cacheReadTokens: res.usage.cache_read_input_tokens ?? 0,
    },
    latencyMs,
    rawOutput,
  };
}

// Bound the request so a hung upstream can't stall a caller indefinitely (the
// explainer's payload is tiny — 1024 max_tokens — so 30s is generous). This is
// the CLIENT default; a call with a heavier payload (e.g. AI-4's PDF
// extraction) overrides it per-request via StructuredRequest.timeoutMs
// (see above) rather than sharing a constant sized for the explainer. ms.
const REQUEST_TIMEOUT_MS = 30_000;

export function createAnthropicProvider(
  opts: AnthropicProviderOptions = {},
): LlmProvider {
  const anthropic = new Anthropic({
    ...(opts.apiKey ? { apiKey: opts.apiKey } : {}),
    timeout: REQUEST_TIMEOUT_MS,
  });

  const client: LlmClient = {
    async parseStructured<T>(
      req: StructuredRequest<T>,
    ): Promise<StructuredResult<T>> {
      const started = Date.now();
      const model = mapTaweedModel(req.model);
      const res = await anthropic.messages.parse({
        model,
        max_tokens: req.maxTokens,
        system: buildSystemBlocks(req.system, req.cacheSystem),
        messages: [
          { role: "user", content: buildUserContent(req.user, req.documents) },
        ],
        output_config: { format: zodOutputFormat(req.schema) },
        // Data-residency pin — only on models that accept it (see header).
        ...(supportsInferenceGeo(model) ? { inference_geo: INFERENCE_GEO } : {}),
      }, req.timeoutMs !== undefined ? { timeout: req.timeoutMs } : undefined);
      return mapParseResponse<T>(
        res as unknown as ParseResponseLike<T>,
        Date.now() - started,
      );
    },
  };

  return {
    name: "anthropic-1p",
    client,
    mapModelId: mapTaweedModel,
    capabilities: { batches: false, files: true },
  };
}
