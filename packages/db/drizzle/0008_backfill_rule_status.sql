-- Backfill so `status` is the SINGLE source of truth for "is this rule live",
-- including on EXISTING data — closing an upgrade-safety gap.
--
-- 0007 added rules.status with DEFAULT 'draft' and no backfill. The shipped
-- scrubber library is seeded into `rules` with rule_key IS NULL and active=true;
-- on any DB seeded before status existed, those rows are (active=true,
-- status='draft'). getRules now gates the Settings rule library on
-- status='approved' (matching the scrubber's own gate), so without this backfill
-- a DB migrated forward-in-place but not re-seeded would render an EMPTY rule
-- library while scrubbing keeps running from the compiled-in rules.
--
-- Reconcile only the shipped-library rows that were LIVE under the old active
-- gate (rule_key IS NULL AND active=true). Authored rows (rule_key IS NOT NULL)
-- keep their draft->approved|rejected lifecycle untouched. Idempotent: a second
-- run matches nothing. 'approved' satisfies the 0007 CHECK (draft|approved|
-- rejected). Migrations run as a superuser, so FORCE RLS on `rules` is bypassed
-- and the UPDATE reaches every tenant's rows.

UPDATE "rules"
   SET "status" = 'approved'
 WHERE "rule_key" IS NULL
   AND "active" = true
   AND "status" = 'draft';
