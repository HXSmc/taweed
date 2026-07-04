-- Indexes for RLS predicate columns (tenant_id) and foreign keys, plus an
-- idempotency guard on claims. IF NOT EXISTS so re-runs / a future drizzle-kit
-- generate that re-proposes these stay safe. (schema.ts stays the declarative
-- table source; index reconciliation into schema.ts is an IMPLEMENT follow-up.)

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "branches_tenant_id_idx" ON "branches" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "providers_tenant_id_idx" ON "providers" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payers_tenant_id_idx" ON "payers" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "patients_tenant_id_idx" ON "patients" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "claims_tenant_id_idx" ON "claims" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "claim_lines_tenant_id_idx" ON "claim_lines" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "claim_responses_tenant_id_idx" ON "claim_responses" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "denials_tenant_id_idx" ON "denials" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rules_tenant_id_idx" ON "rules" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scrub_results_tenant_id_idx" ON "scrub_results" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appeal_templates_tenant_id_idx" ON "appeal_templates" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appeals_tenant_id_idx" ON "appeals" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_tenant_id_idx" ON "audit_logs" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_tenant_id_idx" ON "users" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "claims_branch_id_idx" ON "claims" ("branch_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "claims_provider_id_idx" ON "claims" ("provider_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "claims_payer_id_idx" ON "claims" ("payer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "claims_patient_id_idx" ON "claims" ("patient_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "claim_lines_claim_id_idx" ON "claim_lines" ("claim_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "claim_responses_claim_id_idx" ON "claim_responses" ("claim_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "denials_claim_line_id_idx" ON "denials" ("claim_line_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scrub_results_claim_id_idx" ON "scrub_results" ("claim_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scrub_results_rule_id_idx" ON "scrub_results" ("rule_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appeals_denial_id_idx" ON "appeals" ("denial_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appeals_template_id_idx" ON "appeals" ("template_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appeal_templates_payer_id_idx" ON "appeal_templates" ("payer_id");
--> statement-breakpoint
-- Prevent duplicate ingestion of the same NPHIES claim for a tenant.
CREATE UNIQUE INDEX IF NOT EXISTS "claims_tenant_nphies_uq" ON "claims" ("tenant_id", "nphies_claim_id");
