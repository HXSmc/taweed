# CREATE — Code-Review Follow-ups

Multi-agent review (typescript-reviewer, database-reviewer, security-reviewer) of the
CREATE data-pipeline branch. **Fixed** items are done on this branch; **Deferred** items are
out of CREATE scope (de-risk data pipeline; tables-only for later entities; no auth/analytics/perf
this pass) and tracked here for IMPLEMENT/DEPLOY.

## Fixed on this branch
- **`ClaimResponse.outcome` dropped `"queued"`** (HIGH). Added `"queued"` to `ClaimOutcome`
  so an interim adjudication is never silently coerced to a terminal state.
- **`withTenant` rollback masked the original error** (LOW). ROLLBACK now wrapped so the real
  cause always propagates.
- **`migrate()` destructive reset had no guard** (MEDIUM). Refuses non-local `DATABASE_URL`
  unless `TAWEED_ALLOW_DESTRUCTIVE_MIGRATE=1`.
- **App role had blanket CRUD on the RLS-less `tenants` table** (MEDIUM). Revoked; tenant seed
  now goes through the admin connection only.
- **Role DDL used raw string interpolation** (LOW). Now uses `escapeIdentifier`/`escapeLiteral`.
- **Misleading FORCE-RLS comment** (MEDIUM). Corrected: isolation is proven via the non-owner
  NOBYPASSRLS `taweed_app` role; FORCE is defense-in-depth for the owner case.
- **No indexes / no ingestion idempotency** (HIGH). Added `0002_indexes.sql`: `tenant_id` +
  FK indexes and `UNIQUE(tenant_id, nphies_claim_id)` on `claims`.

## Deferred (IMPLEMENT / DEPLOY)
- **Composite same-tenant FKs** (DB HIGH #1). FK checks bypass RLS, so a cross-tenant `branch_id`
  could be attached to a claim. Enforce via composite `(id, tenant_id)` unique + composite FKs (or
  triggers) when the ingest/write API lands. No live path today (normalizer builds all ids from one
  ctx; no user-supplied ids).
- **Money precision + missing-amount quarantine** (TS MEDIUM). `moneyStr` folds missing amounts to
  `0.00` and sums floats before rounding. Adopt integer-halalas or a decimal type and flag missing
  required amounts as data-quality issues when real payer data (sub-riyal precision) arrives.
- **`normalize()` throws vs. issue-collection** (TS MEDIUM). Currently fail-fast on a denial that
  references a missing line. Decide batch semantics (collect issues like `parseBundle`) when the
  ingest pipeline processes bundles at volume.
- **CHECK constraints** (DB MEDIUM #7): non-negative amounts, plausible `birth_year`, ISO-4217
  `currency`. Add once real value ranges (incl. reversals/negatives) are confirmed with a KSA RCM SME.
- **`submitted_at`/`received_at` as `text`** (DB MEDIUM #8). Intentional for lossless ingest;
  add validation + an expression/`timestamptz` index for date-range analytics in IMPLEMENT.
- **`insertNormalizedClaim` transactional contract not type-enforced** (DB LOW #11). Consider a
  branded transaction type so a non-tx `Database` can't be passed.
- **Reconcile `schema.ts` ↔ hand-written migrations.** RLS + indexes are applied via the ordered
  SQL runner, not declared in `schema.ts`. When adopting drizzle's forward-only migrator (DEPLOY),
  bring policies/indexes into `schema.ts` or a checked-in baseline.
- **`tenant_id` supplied to `withTenant` is trusted** (SEC LOW). Correct now (no auth). Hard
  requirement for IMPLEMENT: derive `tenant_id` from a verified session claim, never client input.
