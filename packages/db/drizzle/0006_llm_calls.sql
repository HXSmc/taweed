-- AI-0 — the LLM audit + dedupe surface (plan 04 §5). Three tenant-scoped
-- tables, each with the same RLS treatment (ENABLE + FORCE + tenant_isolation
-- policy) as every other tenant table (drizzle/0001_rls.sql). The app-role GRANT
-- in migrate.ts runs after all migrations ON ALL TABLES, so these are covered.
--
--   llm_calls          append-only compliance record. HASHES ONLY — never the
--                      raw prompt/output, never PHI (enforced in @taweed/ai audit
--                      guard). One row per model call, in dev and prod.
--   flag_explanations  AI-1 dedupe cache — each (rule, version) explained once
--                      per tenant, not per claim. Stores both locales in one row.
--   tenant_ai_settings per-tenant kill switch. Absent row = enabled (the global
--                      env switch is the fail-closed gate); a row can turn a
--                      single tenant OFF.

CREATE TABLE "llm_calls" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "actor_id" text NOT NULL,
  "purpose" text NOT NULL CHECK (purpose IN ('explain','appeal','author_rule','extract_eob')),
  "model" text NOT NULL,
  "provider" text NOT NULL,
  "prompt_sha256" text NOT NULL,
  "output_sha256" text NOT NULL,
  "input_tokens" integer NOT NULL DEFAULT 0,
  "output_tokens" integer NOT NULL DEFAULT 0,
  "cache_read_tokens" integer NOT NULL DEFAULT 0,
  "request_id" text,
  "latency_ms" integer,
  "flags_state" text,
  "created_at" timestamptz DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "llm_calls" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "llm_calls" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_llm_calls" ON "llm_calls"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
CREATE INDEX "llm_calls_tenant_created_idx"
  ON "llm_calls" ("tenant_id", "created_at" DESC);
--> statement-breakpoint

CREATE TABLE "flag_explanations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "rule_id" text NOT NULL,
  "rule_version" integer NOT NULL,
  "model" text NOT NULL,
  "prompt_sha256" text NOT NULL,
  "explanation_en" text NOT NULL,
  "explanation_ar" text NOT NULL,
  "suggested_fix_en" text NOT NULL,
  "suggested_fix_ar" text NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  UNIQUE ("tenant_id", "rule_id", "rule_version")
);
--> statement-breakpoint
ALTER TABLE "flag_explanations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "flag_explanations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_flag_explanations" ON "flag_explanations"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint

CREATE TABLE "tenant_ai_settings" (
  "tenant_id" uuid PRIMARY KEY REFERENCES "tenants"("id"),
  "ai_enabled" boolean NOT NULL DEFAULT true,
  "updated_at" timestamptz DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "tenant_ai_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tenant_ai_settings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_tenant_ai_settings" ON "tenant_ai_settings"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
