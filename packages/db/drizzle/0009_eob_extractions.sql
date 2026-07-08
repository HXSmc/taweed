-- AI-4 — the EOB vision-extraction review queue (plan 04 §9 PROMPT 3, prep).
-- One additive tenant-scoped table. Inherits the same RLS treatment as every
-- other tenant table (ENABLE + FORCE + tenant_isolation policy, per 0001/0006)
-- and the blanket app-role GRANT (migrate.ts) — no new grant is needed, and
-- unlike llm_calls/audit_logs this table is NOT append-only: a reviewer
-- transitions status pending_review -> approved|rejected and stamps
-- reviewed_by/reviewed_at, so UPDATE stays granted.
--
--   eob_extractions   one row per AI-4 vision extraction attempt. `extraction`
--                     is the validated EobExtraction payload stored as opaque
--                     jsonb here — this migration does not import or depend on
--                     that zod schema, which a parallel task owns. `validator_report`
--                     is the deterministic post-extraction validation output.
--                     `model`/`prompt_sha256` are the LLM provenance fields, same
--                     shape as the other AI tables (0006/0007). `escalated` marks
--                     rows the deterministic validator kicked to mandatory human
--                     review (e.g. low confidence, arithmetic mismatch).
--
-- FORWARD-ONLY: bare CREATE (no IF NOT EXISTS, no down), matching 0004-0008.
-- The test migrator drops + reapplies from zero; production uses a forward-only
-- ledger migrator (deferred to DEPLOY).

CREATE TABLE "eob_extractions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "actor_id" text NOT NULL,
  "source_filename" text NOT NULL,
  "status" text NOT NULL CHECK (status IN ('pending_review', 'approved', 'rejected')) DEFAULT 'pending_review',
  "extraction" jsonb NOT NULL,
  "validator_report" jsonb NOT NULL,
  "model" text NOT NULL,
  "escalated" boolean NOT NULL DEFAULT false,
  "prompt_sha256" text NOT NULL,
  "reviewed_by" text,
  "reviewed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "eob_extractions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "eob_extractions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_eob_extractions" ON "eob_extractions"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
CREATE INDEX "eob_extractions_tenant_status_created_idx"
  ON "eob_extractions" ("tenant_id", "status", "created_at" DESC);
