import "server-only";
import Anthropic, { AnthropicError, APIError } from "@anthropic-ai/sdk";
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
//     cannot be "set on the request". It is configured on the Anthropic account.
//     Batches is not ZDR-eligible, so no PHI-adjacent call may route through it;
//     a future Batches-based feature MUST add an explicit ZDR gate before doing
//     so.
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

/**
 * `anthropic.messages.parse()` (the SDK's own zodOutputFormat helper) throws a
 * bare `AnthropicError` — not `mapParseResponse`'s normal return path — when
 * the model's raw completion fails the SDK's internal JSON.parse or zod
 * validation (e.g. a truncated response cut off mid-string by max_tokens).
 * Found live 2026-07-24: this broke the null-on-parse-failure contract every
 * OTHER provider (gemini-1p.ts, glm-1p.ts, fixture.ts) already follows —
 * `assistAppeal.eval.ts`'s Opus-tier generate call hit exactly this on a real
 * run ("Failed to parse structured output: ...Unterminated string..."),
 * crashing the whole eval instead of surfacing as a scoreable parse miss.
 * `APIError` (network/HTTP failures — auth, rate limit, timeout, 5xx) is a
 * SEPARATE subclass of `AnthropicError`, not this bare base-class throw, so
 * checking `instanceof AnthropicError && !(instanceof APIError)` catches only
 * the parse-failure case and lets every real infrastructure error keep
 * propagating exactly as before.
 */
export function isSdkParseFailure(err: unknown): boolean {
  return err instanceof AnthropicError && !(err instanceof APIError);
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
      let res: unknown;
      try {
        res = await anthropic.messages.parse({
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
      } catch (err) {
        if (!isSdkParseFailure(err)) throw err;
        // See isSdkParseFailure's doc comment — this is a real model-output
        // miss (truncated/malformed JSON), not an infrastructure failure.
        // Matches every other provider's null-on-parse-failure contract.
        //
        // requestId: the SDK throws BEFORE returning any response object, so
        // there is no real request id to report. audit.ts's writeLlmCall
        // requires a non-empty string when requestId is provided at all (an
        // empty string — found live 2026-07-24 — fails that check, which
        // then fails run.ts's audit-write CLOSED and discards this
        // already-correctly-null result with an unrelated-looking DB error).
        // A clear sentinel (matching fixture.ts's `fixture-${key}` precedent
        // for "no real id available") satisfies both StructuredResult's
        // `requestId: string` contract and the audit table's non-empty check
        // while staying honest that it isn't a genuine Anthropic request id.
        return {
          parsed: null,
          model,
          requestId: "anthropic-sdk-parse-failure",
          usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 },
          latencyMs: Date.now() - started,
          rawOutput: "",
        };
      }
      return mapParseResponse<T>(
        res as ParseResponseLike<T>,
        Date.now() - started,
      );
    },
  };

  return {
    name: "anthropic-1p",
    client,
    mapModelId: mapTaweedModel,
  };
}
