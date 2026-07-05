// @taweed/ai — the ONLY package that talks to an LLM (plan 04 §5). Everything
// routes through one audited, kill-switched gate; the raw provider client and
// the internal runner are NOT exported, so a call can never skip the audit
// trail. LLM surfaces are decision-support + human-in-the-loop (SFDA carve-out,
// 02 §6) and never touch the money path.
//
// Public surface: feature functions + their PHI-free types, the kill-switch
// gates + typed error (so callers can fall back to the deterministic path), and
// the pure de-identification / AR post-processing foundation.

export {
  AiConfigError,
  AiDisabledError,
  isAiConfigError,
  isAiDisabledError,
} from "./errors.js";
export {
  isAiEnabled,
  isFeatureEnabled,
  featureEnvVar,
  type AiFeature,
} from "./config.js";
export { LLM_MODEL_IDS, type TaweedModel } from "./models.js";
export type {
  LlmProvider,
  LlmClient,
  StructuredRequest,
  StructuredResult,
  LlmUsage,
} from "./provider.js";
export {
  pseudonymize,
  detokenize,
  ageBand,
  type PseudonymizeConfig,
  type Pseudonymized,
} from "./pseudonymize.js";
export {
  normalizeArabicOutput,
  normalizeArabicDigits,
  stripTashkeel,
  isolateLatinRuns,
} from "./postprocess-ar.js";

// AI-1
export { explainFlag, type ExplainableFlag } from "./features/explainFlag.js";
export { type FlagExplanation } from "./schemas/flagExplanation.js";
