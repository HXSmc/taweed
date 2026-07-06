import * as z from "zod/v4";

// AI-2 output schemas (plan 04 §4.2). Two structured calls:
//   AppealAssist  — Opus writes argumentative paragraphs (EN + MSA) that reference
//                   facts ONLY via digit-free slot tokens (appeal-guardrails.ts).
//   AppealVerify  — a Sonnet judge scores the draft for factual consistency vs the
//                   pseudonymized record, formal MSA register, and completeness
//                   before any human sees it (3C3H-style, plan §4.2).
// .max() bounds are stripped from the wire schema by structured outputs but the SDK
// still enforces them client-side — a runaway response fails parse and the caller
// falls back to the deterministic template.

const MAX_PARA = 1200;
const MAX_PARAS = 4;

export const AppealAssistSchema = z.strictObject({
  paragraphs_en: z.array(z.string().max(MAX_PARA)).max(MAX_PARAS),
  paragraphs_ar: z.array(z.string().max(MAX_PARA)).max(MAX_PARAS),
});

export type AppealAssist = z.infer<typeof AppealAssistSchema>;

// Scores are 0-100. numeric range is NOT enforced on the wire (structured outputs
// strip it) — the feature clamps + thresholds defensively.
export const AppealVerifySchema = z.strictObject({
  factual_consistency: z.number(),
  msa_register: z.number(),
  completeness: z.number(),
  overall: z.number(),
  issues: z.array(z.string().max(300)).max(6),
});

export type AppealVerify = z.infer<typeof AppealVerifySchema>;
