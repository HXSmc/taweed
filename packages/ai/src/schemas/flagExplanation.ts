import * as z from "zod/v4";

// AI-1 output schema (plan 04 §9 step 7). Flat, four strings — one model call
// returns BOTH locales, so a rule is explained once and cached by (rule,
// version). Authored with zod/v4 to match the SDK's zodOutputFormat helper.
// The .max() is stripped from the wire schema by structured outputs but the SDK
// STILL enforces it client-side (claude-api) — a degenerate/verbose response
// fails parse (parsed_output -> null) and the caller falls back to deterministic,
// so nothing unbounded is ever persisted. 2000 chars >> the 2-3 sentences asked.
const MAX_FIELD = 2000;
export const FlagExplanationSchema = z.object({
  explanation_en: z.string().max(MAX_FIELD),
  explanation_ar: z.string().max(MAX_FIELD),
  suggested_fix_en: z.string().max(MAX_FIELD),
  suggested_fix_ar: z.string().max(MAX_FIELD),
});

export type FlagExplanation = z.infer<typeof FlagExplanationSchema>;
