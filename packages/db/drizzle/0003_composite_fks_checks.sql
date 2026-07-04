-- IMPLEMENT wk4 — closes CREATE follow-ups now due (docs/superpowers/CREATE_review_followups.md):
--   * Composite same-tenant FKs (DB HIGH #1): FK checks bypass RLS, so a single-column
--     FK could attach a row from ANOTHER tenant (e.g. a claim referencing another tenant's
--     branch_id). We add UNIQUE(id, tenant_id) on every referenced parent and rewrite each
--     intra-tenant FK as a COMPOSITE (child_col, tenant_id) -> parent(id, tenant_id), so the
--     database itself refuses a cross-tenant reference. tenant_id -> tenants.id stays single
--     (tenants is the RLS-less isolation root, has no tenant_id).
--   * Money precision / plausibility CHECKs (TS MEDIUM, DB MEDIUM #7): non-negative billed
--     amounts, plausible birth_year, ISO-4217 currency length. adjudicated_amount and
--     recovered_amount stay UNCONSTRAINED on purpose — reversals / partial-pay diffs can be
--     negative; their real range is KSA-RCM-SME gated (still deferred).
--
-- Postgres FK MATCH SIMPLE: a composite FK with any NULL column is not checked, so nullable
-- refs (appeals.template_id, appeal_templates.payer_id) still allow NULL while enforcing the
-- same-tenant pair when present.

--> statement-breakpoint
-- 1. UNIQUE (id, tenant_id) on every referenced parent (required target of a composite FK).
ALTER TABLE "branches" DROP CONSTRAINT IF EXISTS "branches_id_tenant_uq";
ALTER TABLE "branches" ADD CONSTRAINT "branches_id_tenant_uq" UNIQUE ("id", "tenant_id");
--> statement-breakpoint
ALTER TABLE "providers" DROP CONSTRAINT IF EXISTS "providers_id_tenant_uq";
ALTER TABLE "providers" ADD CONSTRAINT "providers_id_tenant_uq" UNIQUE ("id", "tenant_id");
--> statement-breakpoint
ALTER TABLE "payers" DROP CONSTRAINT IF EXISTS "payers_id_tenant_uq";
ALTER TABLE "payers" ADD CONSTRAINT "payers_id_tenant_uq" UNIQUE ("id", "tenant_id");
--> statement-breakpoint
ALTER TABLE "patients" DROP CONSTRAINT IF EXISTS "patients_id_tenant_uq";
ALTER TABLE "patients" ADD CONSTRAINT "patients_id_tenant_uq" UNIQUE ("id", "tenant_id");
--> statement-breakpoint
ALTER TABLE "claims" DROP CONSTRAINT IF EXISTS "claims_id_tenant_uq";
ALTER TABLE "claims" ADD CONSTRAINT "claims_id_tenant_uq" UNIQUE ("id", "tenant_id");
--> statement-breakpoint
ALTER TABLE "claim_lines" DROP CONSTRAINT IF EXISTS "claim_lines_id_tenant_uq";
ALTER TABLE "claim_lines" ADD CONSTRAINT "claim_lines_id_tenant_uq" UNIQUE ("id", "tenant_id");
--> statement-breakpoint
ALTER TABLE "rules" DROP CONSTRAINT IF EXISTS "rules_id_tenant_uq";
ALTER TABLE "rules" ADD CONSTRAINT "rules_id_tenant_uq" UNIQUE ("id", "tenant_id");
--> statement-breakpoint
ALTER TABLE "denials" DROP CONSTRAINT IF EXISTS "denials_id_tenant_uq";
ALTER TABLE "denials" ADD CONSTRAINT "denials_id_tenant_uq" UNIQUE ("id", "tenant_id");
--> statement-breakpoint
ALTER TABLE "appeal_templates" DROP CONSTRAINT IF EXISTS "appeal_templates_id_tenant_uq";
ALTER TABLE "appeal_templates" ADD CONSTRAINT "appeal_templates_id_tenant_uq" UNIQUE ("id", "tenant_id");
--> statement-breakpoint

-- 2. Replace each intra-tenant single-column FK with a composite same-tenant FK.
ALTER TABLE "claims" DROP CONSTRAINT IF EXISTS "claims_branch_id_branches_id_fk";
ALTER TABLE "claims" ADD CONSTRAINT "claims_branch_tenant_fk" FOREIGN KEY ("branch_id", "tenant_id") REFERENCES "public"."branches"("id", "tenant_id");
--> statement-breakpoint
ALTER TABLE "claims" DROP CONSTRAINT IF EXISTS "claims_provider_id_providers_id_fk";
ALTER TABLE "claims" ADD CONSTRAINT "claims_provider_tenant_fk" FOREIGN KEY ("provider_id", "tenant_id") REFERENCES "public"."providers"("id", "tenant_id");
--> statement-breakpoint
ALTER TABLE "claims" DROP CONSTRAINT IF EXISTS "claims_payer_id_payers_id_fk";
ALTER TABLE "claims" ADD CONSTRAINT "claims_payer_tenant_fk" FOREIGN KEY ("payer_id", "tenant_id") REFERENCES "public"."payers"("id", "tenant_id");
--> statement-breakpoint
ALTER TABLE "claims" DROP CONSTRAINT IF EXISTS "claims_patient_id_patients_id_fk";
ALTER TABLE "claims" ADD CONSTRAINT "claims_patient_tenant_fk" FOREIGN KEY ("patient_id", "tenant_id") REFERENCES "public"."patients"("id", "tenant_id");
--> statement-breakpoint
ALTER TABLE "claim_lines" DROP CONSTRAINT IF EXISTS "claim_lines_claim_id_claims_id_fk";
ALTER TABLE "claim_lines" ADD CONSTRAINT "claim_lines_claim_tenant_fk" FOREIGN KEY ("claim_id", "tenant_id") REFERENCES "public"."claims"("id", "tenant_id");
--> statement-breakpoint
ALTER TABLE "claim_responses" DROP CONSTRAINT IF EXISTS "claim_responses_claim_id_claims_id_fk";
ALTER TABLE "claim_responses" ADD CONSTRAINT "claim_responses_claim_tenant_fk" FOREIGN KEY ("claim_id", "tenant_id") REFERENCES "public"."claims"("id", "tenant_id");
--> statement-breakpoint
ALTER TABLE "denials" DROP CONSTRAINT IF EXISTS "denials_claim_line_id_claim_lines_id_fk";
ALTER TABLE "denials" ADD CONSTRAINT "denials_claim_line_tenant_fk" FOREIGN KEY ("claim_line_id", "tenant_id") REFERENCES "public"."claim_lines"("id", "tenant_id");
--> statement-breakpoint
ALTER TABLE "scrub_results" DROP CONSTRAINT IF EXISTS "scrub_results_claim_id_claims_id_fk";
ALTER TABLE "scrub_results" ADD CONSTRAINT "scrub_results_claim_tenant_fk" FOREIGN KEY ("claim_id", "tenant_id") REFERENCES "public"."claims"("id", "tenant_id");
--> statement-breakpoint
ALTER TABLE "scrub_results" DROP CONSTRAINT IF EXISTS "scrub_results_rule_id_rules_id_fk";
ALTER TABLE "scrub_results" ADD CONSTRAINT "scrub_results_rule_tenant_fk" FOREIGN KEY ("rule_id", "tenant_id") REFERENCES "public"."rules"("id", "tenant_id");
--> statement-breakpoint
ALTER TABLE "appeals" DROP CONSTRAINT IF EXISTS "appeals_denial_id_denials_id_fk";
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_denial_tenant_fk" FOREIGN KEY ("denial_id", "tenant_id") REFERENCES "public"."denials"("id", "tenant_id");
--> statement-breakpoint
ALTER TABLE "appeals" DROP CONSTRAINT IF EXISTS "appeals_template_id_appeal_templates_id_fk";
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_template_tenant_fk" FOREIGN KEY ("template_id", "tenant_id") REFERENCES "public"."appeal_templates"("id", "tenant_id");
--> statement-breakpoint
ALTER TABLE "appeal_templates" DROP CONSTRAINT IF EXISTS "appeal_templates_payer_id_payers_id_fk";
ALTER TABLE "appeal_templates" ADD CONSTRAINT "appeal_templates_payer_tenant_fk" FOREIGN KEY ("payer_id", "tenant_id") REFERENCES "public"."payers"("id", "tenant_id");
--> statement-breakpoint

-- 3. Money precision / plausibility CHECKs. Missing REQUIRED amounts are handled as ingest
--    quarantine (data-quality), not folded to 0.00 — enforced in the ingest validator.
ALTER TABLE "claims" DROP CONSTRAINT IF EXISTS "claims_total_amount_nonneg";
ALTER TABLE "claims" ADD CONSTRAINT "claims_total_amount_nonneg" CHECK ("total_amount" >= 0);
--> statement-breakpoint
ALTER TABLE "claims" DROP CONSTRAINT IF EXISTS "claims_currency_iso4217_len";
ALTER TABLE "claims" ADD CONSTRAINT "claims_currency_iso4217_len" CHECK (char_length("currency") = 3);
--> statement-breakpoint
ALTER TABLE "claim_lines" DROP CONSTRAINT IF EXISTS "claim_lines_amounts_nonneg";
ALTER TABLE "claim_lines" ADD CONSTRAINT "claim_lines_amounts_nonneg" CHECK ("unit_price" >= 0 AND "line_amount" >= 0 AND "qty" > 0);
--> statement-breakpoint
ALTER TABLE "denials" DROP CONSTRAINT IF EXISTS "denials_denied_amount_nonneg";
ALTER TABLE "denials" ADD CONSTRAINT "denials_denied_amount_nonneg" CHECK ("denied_amount" >= 0);
--> statement-breakpoint
ALTER TABLE "patients" DROP CONSTRAINT IF EXISTS "patients_birth_year_plausible";
ALTER TABLE "patients" ADD CONSTRAINT "patients_birth_year_plausible" CHECK ("birth_year" IS NULL OR ("birth_year" >= 1900 AND "birth_year" <= 2100));
