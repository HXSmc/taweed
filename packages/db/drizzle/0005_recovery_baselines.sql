-- EXECUTE B8 — recovery baseline snapshot (build-plan §11, design-brief §8.5).
--
-- Captured at onboarding so recovered-SAR ROI is measured against a fixed starting
-- at-risk figure, not a moving target. Tenant-scoped, so it gets the same RLS
-- treatment (ENABLE + FORCE + tenant_isolation policy) as every other tenant table
-- (drizzle/0001_rls.sql). The app-role GRANT in migrate.ts runs after all
-- migrations against ALL TABLES, so this new table is covered automatically.

CREATE TABLE "recovery_baselines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "captured_at" timestamptz DEFAULT now(),
  "baseline_at_risk_sar" numeric(14,2) NOT NULL,
  "baseline_denied_count" integer NOT NULL,
  "baseline_claim_count" integer NOT NULL,
  "note" text
);
--> statement-breakpoint
ALTER TABLE "recovery_baselines" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "recovery_baselines" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_recovery_baselines" ON "recovery_baselines"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
CREATE INDEX "recovery_baselines_tenant_captured_idx"
  ON "recovery_baselines" ("tenant_id", "captured_at" DESC);
