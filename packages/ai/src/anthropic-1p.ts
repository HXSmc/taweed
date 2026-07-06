import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { mapTaweedModel } from "./models.js";
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
//     model runs. It is set on every call below (INFERENCE_GEO). @anthropic-ai/sdk
//     ^0.110 predates it in the request TYPE, so it is threaded via a spread
//     (forwarded on the wire); bump the SDK to make it a typed field.
//   - Zero Data Retention: an ORG/account-level posture, NOT a request field — it
//     cannot be "set on the request". It is configured on the Anthropic account
//     and, because Batches is not ZDR-eligible, capabilities.batches gates Batches
//     off at the feature layer so a PHI-adjacent call never takes the Batches path.
const INFERENCE_GEO = "us";
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
// explainer's payload is tiny — 1024 max_tokens — so 30s is generous). ms.
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
      const res = await anthropic.messages.parse({
        model: mapTaweedModel(req.model),
        max_tokens: req.maxTokens,
        system: buildSystemBlocks(req.system, req.cacheSystem),
        messages: [{ role: "user", content: req.user }],
        output_config: { format: zodOutputFormat(req.schema) },
        // Data-residency pin. Spread past the SDK's request type (see header).
        ...({ inference_geo: INFERENCE_GEO } as { inference_geo: string }),
      });
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
    capabilities: { batches: true, files: true },
  };
}
