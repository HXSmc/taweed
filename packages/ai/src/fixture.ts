import { sha256Hex } from "./sha256.js";
import { mapTaweedModel, type TaweedModel } from "./models.js";
import type {
  LlmClient,
  LlmProvider,
  StructuredRequest,
  StructuredResult,
} from "./provider.js";

// Record/replay provider so CI NEVER calls the live API (plan 04 §4.4, §6):
// no ANTHROPIC_API_KEY in CI. A fixture is keyed by the request shape and stores
// the model's structured output plus usage; parseStructured re-validates the
// recorded output through the request's zod schema, so a schema change surfaces
// as a parse failure rather than silently passing stale data.

export interface FixtureRecord {
  output: unknown;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
  };
  model?: string;
  requestId?: string;
}

export type FixtureMap = Record<string, FixtureRecord>;

/** Deterministic key over the parts of a request that change the model's answer. */
export function fixtureKey(req: {
  model: TaweedModel;
  system: string;
  user: string;
  schemaName: string;
}): string {
  return sha256Hex(
    JSON.stringify([req.model, req.system, req.user, req.schemaName]),
  );
}

export function createFixtureProvider(fixtures: FixtureMap): LlmProvider {
  const client: LlmClient = {
    async parseStructured<T>(
      req: StructuredRequest<T>,
    ): Promise<StructuredResult<T>> {
      const key = fixtureKey(req);
      const record = fixtures[key];
      if (!record) {
        throw new Error(
          `No AI fixture for key ${key} (model=${req.model}, schema=${req.schemaName}). ` +
            `Record it — CI must never call the live API.`,
        );
      }
      const result = req.schema.safeParse(record.output);
      const parsed = result.success ? (result.data as T) : null;
      const rawOutput = parsed === null ? "" : JSON.stringify(parsed);
      return {
        parsed,
        model: record.model ?? mapTaweedModel(req.model),
        requestId: record.requestId ?? `fixture-${key.slice(0, 12)}`,
        usage: {
          inputTokens: record.usage?.inputTokens ?? 0,
          outputTokens: record.usage?.outputTokens ?? 0,
          cacheReadTokens: record.usage?.cacheReadTokens ?? 0,
        },
        latencyMs: 0,
        rawOutput,
      };
    },
  };
  return {
    name: "fixture",
    client,
    mapModelId: mapTaweedModel,
  };
}
