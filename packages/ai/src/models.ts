// Logical model tiers, mapped to EXACT Anthropic model IDs (no date suffixes —
// claude-api skill: date-suffixed variants 404). The mix follows plan 04 §4.4:
// Haiku for explainers (cheap, deduped), Sonnet for extraction, Opus for
// appeals/rule-authoring. Kept as a swap point so a provider (Bedrock/Vertex/
// self-hosted) can remap ids without touching feature code.

export type TaweedModel = "opus" | "sonnet" | "haiku";

export const LLM_MODEL_IDS: Record<TaweedModel, string> = {
  opus: "claude-opus-4-8",
  sonnet: "claude-sonnet-5",
  haiku: "claude-haiku-4-5",
};

export function mapTaweedModel(model: TaweedModel): string {
  return LLM_MODEL_IDS[model];
}
