import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { DataOrigin } from "@taweed/shared";

// Canonical relational model (build-plan §7). Property names are snake_case to
// match the *_Row types in @taweed/shared, so normalizer output inserts
// directly. `tenant_id` is on every tenant-scoped table; RLS is applied in the
// hand-written migration drizzle/0001_rls.sql (ENABLE + FORCE + policy).
//
// Money is numeric(14,2) (returned as string by drizzle). Date-ish FHIR values
// (submitted_at, received_at) are kept as text to preserve the source string
// exactly this pass; analytics can cast later.

const money = (name: string) => numeric(name, { precision: 14, scale: 2 });

/** Root of tenant isolation — has no tenant_id itself. */
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
});

export const branches = pgTable("branches", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  name: text("name").notNull(),
  city: text("city"),
  license: text("license"),
});

export const providers = pgTable("providers", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  name: text("name").notNull(),
  specialty: text("specialty"),
  nphies_practitioner_id: text("nphies_practitioner_id"),
});

export const payers = pgTable("payers", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  name: text("name").notNull(),
  nphies_payer_id: text("nphies_payer_id"),
  type: text("type"),
});

/** PHI — minimized; encryption + access audit handled in later phases. */
export const patients = pgTable("patients", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  pseudonym: text("pseudonym").notNull(),
  birth_year: integer("birth_year"),
  gender: text("gender"),
});

export const claims = pgTable("claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  branch_id: uuid("branch_id")
    .notNull()
    .references(() => branches.id),
  provider_id: uuid("provider_id")
    .notNull()
    .references(() => providers.id),
  payer_id: uuid("payer_id")
    .notNull()
    .references(() => payers.id),
  patient_id: uuid("patient_id")
    .notNull()
    .references(() => patients.id),
  nphies_claim_id: text("nphies_claim_id"),
  status: text("status").notNull(),
  submitted_at: text("submitted_at"),
  total_amount: money("total_amount").notNull(),
  currency: text("currency").notNull(),
  // EXECUTE B5 — origin tag (gates the synthetic scrubber projection) + real
  // scrubber-signal columns. Signals are nullable: null = the source carries no
  // such signal, so the rule that reads it goes "unevaluable" (design-brief §8.3).
  // Default 'production' fails CLOSED: only an explicit 'synthetic' tag uses the
  // fabricating projection; untagged data is treated as real, never fabricated.
  data_origin: text("data_origin")
    .notNull()
    .default("production")
    .$type<DataOrigin>(),
  preauth_present: boolean("preauth_present"),
  eligibility_verified: boolean("eligibility_verified"),
  is_duplicate: boolean("is_duplicate"),
  has_documentation: boolean("has_documentation"),
});

export const claimLines = pgTable("claim_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  claim_id: uuid("claim_id")
    .notNull()
    .references(() => claims.id),
  line_number: integer("line_number").notNull(),
  sbs_code: text("sbs_code"),
  icd10am_code: text("icd10am_code"),
  qty: integer("qty").notNull(),
  unit_price: money("unit_price").notNull(),
  line_amount: money("line_amount").notNull(),
});

export const claimResponses = pgTable("claim_responses", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  claim_id: uuid("claim_id")
    .notNull()
    .references(() => claims.id),
  nphies_response_id: text("nphies_response_id"),
  outcome: text("outcome").notNull(),
  adjudicated_amount: money("adjudicated_amount"),
  received_at: text("received_at"),
});

/** Exploded analytics row: one per denied line × reason. */
export const denials = pgTable("denials", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  claim_line_id: uuid("claim_line_id")
    .notNull()
    .references(() => claimLines.id),
  reason_code: text("reason_code").notNull(),
  reason_text: text("reason_text"),
  category: text("category"),
  denied_amount: money("denied_amount").notNull(),
});

// --- Tables-only for later phases (no logic this pass) ---

/**
 * Pre-submission rule library (build-plan §7). EXTENDED by AI-3 (migration 0007)
 * with authoring metadata so an LLM-authored ScrubRule persists DISABLED, is gated
 * by the deterministic authoring gate, and is human-approved before it executes.
 * `rule_key` is the logical ScrubRule id; `status` drives draft -> approved|rejected
 * (a rule executes only when approved). `authored_by`/`prompt_sha256`/`model` are
 * the LLM provenance for the audit trail.
 */
export const rules = pgTable("rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  scope: text("scope").notNull(),
  condition: jsonb("condition"),
  severity: text("severity"),
  message_en: text("message_en"),
  message_ar: text("message_ar"),
  version: integer("version").notNull().default(1),
  active: boolean("active").notNull().default(true),
  // AI-3 authoring columns (0007).
  rule_key: text("rule_key"),
  name: text("name"),
  field: text("field"),
  weight: integer("weight").notNull().default(0),
  payer_id: text("payer_id"),
  authored_by: text("authored_by").notNull().default("human"),
  prompt_sha256: text("prompt_sha256"),
  model: text("model"),
  status: text("status").notNull().default("draft"),
  rationale: text("rationale"),
  created_by: text("created_by"),
  created_at: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const scrubResults = pgTable("scrub_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  claim_id: uuid("claim_id")
    .notNull()
    .references(() => claims.id),
  rule_id: uuid("rule_id")
    .notNull()
    .references(() => rules.id),
  risk_score: numeric("risk_score", { precision: 5, scale: 2 }),
  flagged_at: timestamp("flagged_at", { withTimezone: true }).defaultNow(),
});

export const appealTemplates = pgTable("appeal_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  denial_category: text("denial_category"),
  payer_id: uuid("payer_id").references(() => payers.id),
  body_en: text("body_en"),
  body_ar: text("body_ar"),
  required_docs: jsonb("required_docs"),
});

export const appeals = pgTable("appeals", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  denial_id: uuid("denial_id")
    .notNull()
    .references(() => denials.id),
  template_id: uuid("template_id").references(() => appealTemplates.id),
  status: text("status").notNull().default("draft"),
  recovered_amount: money("recovered_amount"),
  generated_at: timestamp("generated_at", { withTimezone: true }),
  submitted_at: timestamp("submitted_at", { withTimezone: true }),
});

/**
 * EXECUTE B8 — recovery baseline snapshot captured at onboarding (build-plan §11).
 * Fixes the at-risk denominator so recovered-SAR ROI is measured against a stable
 * starting point, not a moving target, keeping attribution conservative and honest.
 */
export const recoveryBaselines = pgTable("recovery_baselines", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  captured_at: timestamp("captured_at", { withTimezone: true }).defaultNow(),
  baseline_at_risk_sar: money("baseline_at_risk_sar").notNull(),
  baseline_denied_count: integer("baseline_denied_count").notNull(),
  baseline_claim_count: integer("baseline_claim_count").notNull(),
  note: text("note"),
});

/**
 * AI-0 — append-only LLM audit trail (plan 04 §5). HASHES ONLY; the @taweed/ai
 * audit guard refuses any raw prompt/output or PHI-bearing field. One row per
 * model call. `purpose` CHECK enum enforced in migration 0006.
 */
export const llmCalls = pgTable("llm_calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  actor_id: text("actor_id").notNull(),
  purpose: text("purpose").notNull(),
  model: text("model").notNull(),
  provider: text("provider").notNull(),
  prompt_sha256: text("prompt_sha256").notNull(),
  output_sha256: text("output_sha256").notNull(),
  input_tokens: integer("input_tokens").notNull().default(0),
  output_tokens: integer("output_tokens").notNull().default(0),
  cache_read_tokens: integer("cache_read_tokens").notNull().default(0),
  request_id: text("request_id"),
  latency_ms: integer("latency_ms"),
  flags_state: text("flags_state"),
  created_at: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * AI-1 — bilingual scrub-flag explanation cache (plan 04 §2, §4.4). Deduped by
 * (rule, version) per tenant so each rule is explained once, not per claim; both
 * locales live in one row (a single model call returns all four fields).
 */
export const flagExplanations = pgTable("flag_explanations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  rule_id: text("rule_id").notNull(),
  rule_version: integer("rule_version").notNull(),
  model: text("model").notNull(),
  prompt_sha256: text("prompt_sha256").notNull(),
  explanation_en: text("explanation_en").notNull(),
  explanation_ar: text("explanation_ar").notNull(),
  suggested_fix_en: text("suggested_fix_en").notNull(),
  suggested_fix_ar: text("suggested_fix_ar").notNull(),
  created_at: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * AI-0 — per-tenant kill switch (plan 04 §5). Absent row = enabled (the global
 * env switch is the fail-closed gate); a row can turn a single tenant OFF.
 */
export const tenantAiSettings = pgTable("tenant_ai_settings", {
  tenant_id: uuid("tenant_id")
    .primaryKey()
    .references(() => tenants.id),
  ai_enabled: boolean("ai_enabled").notNull().default(true),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * AI-2 — appeal-suggestion edit tracking (plan 04 §4.2). The ongoing quality
 * metric: how much a reviewer edited each AI suggestion. Stores METADATA ONLY —
 * lengths, the second-model verify score, the edit distance, and the outcome —
 * never the raw suggestion prose (PHI-adjacent, like the appeal letter, which the
 * app never persists). The model-call compliance record is the llm_calls row.
 */
export const appealSuggestions = pgTable("appeal_suggestions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  denial_id: uuid("denial_id").notNull(),
  actor_id: text("actor_id").notNull(),
  locale: text("locale").notNull(),
  model: text("model").notNull(),
  verify_score: integer("verify_score"),
  suggestion_chars: integer("suggestion_chars").notNull().default(0),
  edit_distance: integer("edit_distance"),
  final_chars: integer("final_chars"),
  outcome: text("outcome").notNull().default("suggested"),
  created_at: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  actor: text("actor"),
  action: text("action").notNull(),
  entity: text("entity"),
  entity_id: text("entity_id"),
  at: timestamp("at", { withTimezone: true }).defaultNow(),
  ip: text("ip"),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  role: text("role").notNull(),
  locale: text("locale").notNull().default("en"),
  email: text("email"),
});

/** Tenant-scoped tables (everything except `tenants`) — RLS applies to these. */
export const TENANT_SCOPED_TABLES = [
  "branches",
  "providers",
  "payers",
  "patients",
  "claims",
  "claim_lines",
  "claim_responses",
  "denials",
  "rules",
  "scrub_results",
  "appeal_templates",
  "appeals",
  "recovery_baselines",
  "audit_logs",
  "llm_calls",
  "flag_explanations",
  "tenant_ai_settings",
  "appeal_suggestions",
  "users",
] as const;
