-- AI-3 + AI-2 (plan 04 §9 PROMPT 2). Two additive surfaces on the tenant-scoped
-- core; both inherit the existing table-level RLS (0001: ENABLE + FORCE + policy)
-- and the blanket app-role GRANT (migrate.ts), so no new grant is needed.
--
--   rules (EXTENDED)     the pre-submission rule library gains authoring metadata
--                        so an LLM-authored ScrubRule can be persisted DISABLED,
--                        gated, and human-approved before it ever executes (AI-3).
--   appeal_suggestions   the SME-edit quality metric for AI-2 appeal assist. NO
--                        raw suggestion prose is stored (it is PHI-adjacent, like
--                        the appeal letter itself, which the app never persists) —
--                        only lengths, the verify score, and the edit distance the
--                        reviewer's action produced. The compliance record of the
--                        model call itself is the append-only llm_calls row (0006).
--
-- FORWARD-ONLY: bare ALTER/CREATE (no IF NOT EXISTS, no down), matching 0004-0006.
-- The test migrator drops + reapplies from zero; production uses a forward-only
-- ledger migrator (deferred to DEPLOY).

-- AI-3 — authored-rule columns on the existing rule library. `rule_key` is the
-- logical ScrubRule id (e.g. R-LLM-...); the uuid `id` stays the row PK. `status`
-- drives the lifecycle (draft -> approved | rejected); a rule executes ONLY when
-- approved. `weight` defaults 0 so any pre-existing row stays inert. Everything an
-- LLM-authored rule carries for the audit trail (authored_by, prompt_sha256,
-- model) lives here; `payer_id` is the business payer identifier the rule scopes
-- to (matches ClaimFacts.payerId), text — not the payers.id uuid.
ALTER TABLE rules
  ADD COLUMN rule_key text,
  ADD COLUMN name text,
  ADD COLUMN field text,
  ADD COLUMN weight integer NOT NULL DEFAULT 0,
  ADD COLUMN payer_id text,
  ADD COLUMN authored_by text NOT NULL DEFAULT 'human',
  ADD COLUMN prompt_sha256 text,
  ADD COLUMN model text,
  ADD COLUMN status text NOT NULL DEFAULT 'draft',
  ADD COLUMN rationale text,
  ADD COLUMN created_by text,
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
--> statement-breakpoint
ALTER TABLE rules
  ADD CONSTRAINT rules_authored_by_check CHECK (authored_by IN ('human', 'llm'));
--> statement-breakpoint
ALTER TABLE rules
  ADD CONSTRAINT rules_status_check CHECK (status IN ('draft', 'approved', 'rejected'));
--> statement-breakpoint
-- One logical rule_key has at most one row per (tenant, version) — a version bump
-- is a new row; re-authoring the same version is an idempotent upsert target.
CREATE UNIQUE INDEX rules_tenant_key_version_idx
  ON rules (tenant_id, rule_key, version)
  WHERE rule_key IS NOT NULL;
--> statement-breakpoint
CREATE INDEX rules_tenant_status_idx ON rules (tenant_id, status);
--> statement-breakpoint

-- AI-2 — appeal-suggestion edit tracking (the ongoing quality metric, plan 04
-- §4.2). Metadata + edit distance only; never the prose.
CREATE TABLE "appeal_suggestions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "denial_id" uuid NOT NULL,
  "actor_id" text NOT NULL,
  "locale" text NOT NULL CHECK (locale IN ('en', 'ar')),
  "model" text NOT NULL,
  "verify_score" integer,
  "suggestion_chars" integer NOT NULL DEFAULT 0,
  "edit_distance" integer,
  "final_chars" integer,
  "outcome" text NOT NULL DEFAULT 'suggested'
    CHECK (outcome IN ('suggested', 'inserted', 'edited', 'discarded', 'suppressed')),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "appeal_suggestions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "appeal_suggestions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_appeal_suggestions" ON "appeal_suggestions"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
CREATE INDEX "appeal_suggestions_tenant_created_idx"
  ON "appeal_suggestions" ("tenant_id", "created_at" DESC);
