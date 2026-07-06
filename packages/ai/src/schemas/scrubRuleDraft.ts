import * as z from "zod/v4";
import {
  AUTHORABLE_FACT_KEYS,
  SCRUB_OPERATORS,
} from "@taweed/rules-engine";

// AI-3 output schema (plan 04 §4.3). A ScrubRule DRAFT the model proposes from an
// SME's sentence. Two hard constraints from structured outputs (claude-api):
//   1. NO RECURSION — recursive schemas are rejected. The condition tree is
//      therefore expressed as EXPLICIT bounded levels (max 3 groups deep), not a
//      self-referential type. rules-engine re-validates the depth cap.
//   2. numeric/string constraints (.max/.min) are STRIPPED from the wire schema —
//      the SDK still enforces them client-side, so a degenerate/oversized response
//      fails parse (parsed_output -> null) and the caller falls back. They are NOT
//      a server-side guarantee; author.ts re-checks value types + weight range.
//
// `fact` and `operator` are enum-constrained to the registry (single source of
// truth in @taweed/rules-engine): the model can only name a fact/operator the
// engine actually knows, so it cannot emit a rule that throws at run time.

const MAX_TEXT = 600;

// STRICT objects everywhere. Two reasons: (1) structured outputs require
// additionalProperties:false on every object; (2) leaf vs group are disambiguated
// only by their key set (a leaf has fact/operator/value, a group has all/any) — a
// non-strict group would accept a leaf-shaped object as an empty group and swallow
// an unregistered fact. Strictness forces the union to fall through to the leaf
// branch, where the fact/operator enums reject the bad value.
const LeafSchema = z.strictObject({
  fact: z.enum(AUTHORABLE_FACT_KEYS),
  operator: z.enum(SCRUB_OPERATORS),
  // A fact compared to a constant. Union of scalars — the fact/operator/value
  // type agreement (numeric fact needs a number, etc.) is re-checked in author.ts.
  value: z.union([z.string().max(MAX_TEXT), z.number(), z.boolean()]),
});

// Bounded, non-recursive nesting: innermost group holds leaves; each outer level
// may hold leaves or the level below it; the top is a group of level-2 nodes or a
// bare leaf. Max group depth = 3, matching author.ts MAX_GROUP_DEPTH.
const GroupL3Schema = z.strictObject({
  all: z.array(LeafSchema).optional(),
  any: z.array(LeafSchema).optional(),
});
const NodeL2Schema = z.union([LeafSchema, GroupL3Schema]);
const GroupL2Schema = z.strictObject({
  all: z.array(NodeL2Schema).optional(),
  any: z.array(NodeL2Schema).optional(),
});
const NodeL1Schema = z.union([LeafSchema, GroupL2Schema]);
const GroupL1Schema = z.strictObject({
  all: z.array(NodeL1Schema).optional(),
  any: z.array(NodeL1Schema).optional(),
});

const ConditionsSchema = z.union([LeafSchema, GroupL1Schema]);

export const ScrubRuleDraftSchema = z.strictObject({
  name: z.string().max(MAX_TEXT),
  severity: z.enum(["info", "warn", "high"]),
  // Which fact the flag points at — an authorable fact, not free text.
  field: z.enum(AUTHORABLE_FACT_KEYS),
  message_en: z.string().max(MAX_TEXT),
  message_ar: z.string().max(MAX_TEXT),
  // Risk points. The model proposes; author.ts clamps to [1,100] deterministically.
  weight: z.number(),
  conditions: ConditionsSchema,
  // Plain-language justification shown to the human approver. Never executed.
  rationale: z.string().max(MAX_TEXT),
});

export type ScrubRuleDraft = z.infer<typeof ScrubRuleDraftSchema>;
