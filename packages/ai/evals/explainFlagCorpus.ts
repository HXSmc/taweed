// AI-1 explainFlag eval corpus — reuses the REAL shipped scrub rules
// (@taweed/rules-engine SCRUBBER_RULES) as ExplainableFlag fixtures, rather
// than inventing synthetic ones. These are the actual rules a biller would
// see explained in production, spanning every severity and several distinct
// fields — real, representative, and free (no new fixture-authoring debt to
// keep in sync with the rule set as it evolves).

import { SCRUBBER_RULES } from "@taweed/rules-engine";
import type { ExplainableFlag } from "../src/features/explainFlag.js";

export const EXPLAIN_FLAG_CORPUS: ExplainableFlag[] = SCRUBBER_RULES.map(
  (rule) => ({
    ruleId: rule.id,
    ruleVersion: rule.version,
    ruleName: rule.name,
    field: rule.field,
    severity: rule.severity,
    message_en: rule.message_en,
    message_ar: rule.message_ar,
  }),
);
