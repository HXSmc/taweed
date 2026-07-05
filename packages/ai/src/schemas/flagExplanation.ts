import * as z from "zod/v4";

// AI-1 output schema (plan 04 §9 step 7). Flat, four strings — one model call
// returns BOTH locales, so a rule is explained once and cached by (rule,
// version). Authored with zod/v4 to match the SDK's zodOutputFormat helper.
// No string length constraints: structured outputs strip them from the wire
// schema (claude-api), so they wouldn't be enforced anyway.
export const FlagExplanationSchema = z.object({
  explanation_en: z.string(),
  explanation_ar: z.string(),
  suggested_fix_en: z.string(),
  suggested_fix_ar: z.string(),
});

export type FlagExplanation = z.infer<typeof FlagExplanationSchema>;
