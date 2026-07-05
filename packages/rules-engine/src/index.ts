// @taweed/rules-engine — pre-submission scrubber (build-plan §3 rules-as-data, §7).
export * from "./types.js";
export { SCRUBBER_RULES } from "./rules.js";
export { scrub } from "./scrub.js";
export {
  projectClaimFacts,
  claimToFactsReal,
  claimToFactsSynthetic,
  type DataOrigin,
  type ProjectionClaim,
  type ProjectionLine,
  type ProjectionPatient,
} from "./project.js";
