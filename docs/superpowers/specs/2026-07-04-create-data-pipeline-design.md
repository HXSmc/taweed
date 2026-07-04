# CREATE — Data Pipeline Vertical (Design Spec)

> Taweed KSA denial-management SaaS. CREATE phase (build-plan §2, §8 Wk1–3).
> Goal: **de-risk the data pipeline**. Prove a synthetic NPHIES `Claim`/`ClaimResponse`
> bundle parses and normalizes into canonical DB rows, verified by tests. **No UI this pass.**

## 1. Objective & Non-Goals

**Objective (CREATE structural DoD):** the smallest end-to-end vertical —

```
synthetic generator → FHIR R4 bundle (Claim + ClaimResponse)
  → packages/fhir  (parse + base-R4 validate)
  → packages/normalizer (map → canonical rows; denials exploded)
  → packages/db   (insert into local Postgres; migrations + RLS applied)
```

proven green by TDD unit tests (parser, normalizer, generator — table-driven) plus one
integration test that runs the full path into a real local Postgres.

**Explicitly out of scope (do NOT build):** any `apps/web` screens, design port, analytics
dashboard, rules engine, appeal generator, recovery tracking, auth/RBAC, live NPHIES, real IG
validation, real KSA code sets, hosting/infra. `design/` is untouched.

**Creds-gated → typed stubs only, tagged `TODO(nphies-creds)`:** NPHIES profile validation,
real adjudication/denial codes. Placeholder denial enum (~8 fake CARC/RARC-style codes),
never presented as real.

## 2. Architecture (this pass)

Monorepo (build-plan §4), pnpm workspaces + TypeScript, strict. Packages built this pass:

| Package | Purpose | Depends on |
|---|---|---|
| `packages/shared` | Canonical row types + `DenialReasonCode` placeholder enum + shared utils | — |
| `packages/db` | Drizzle schema for §7 entities, SQL migrations, RLS policies, tenant-scoped client | `shared` |
| `packages/fhir` | Parse `Claim`/`ClaimResponse` (R4) via `@medplum/fhirtypes`; base-R4 validation; `validateAgainstNphiesProfile()` **stub** | `shared` |
| `packages/normalizer` | Map parsed FHIR → canonical rows (one row per claim line; denials exploded per denied line/reason) | `shared`, `fhir` |
| `test/synthetic-fhir` | Hand-rolled TS generator → valid R4 bundles across permutations | `shared`, `fhir` (types) |

**Stubbed dirs (package.json + placeholder only, no logic):** `packages/rules-engine`,
`packages/appeals`, `packages/audit`.

**`apps/web`:** empty Next.js placeholder (scaffold only, no screens).

### Decision: ORM = Drizzle
TS-native; first-class RLS via `pgPolicy`/`crudPolicy`; `drizzle-kit` emits reviewable SQL
migrations. Prisma's session-variable/RLS story is weak; raw SQL makes the normalizer's writes
heavier. Drizzle is the strongest fit for "migrations + RLS applied, proven by tests."

### Data-flow contract (the seams)
- **fhir parse output:** discriminated result `{ ok: true, resource } | { ok: false, issues }`.
  Parser returns strongly-typed `Claim` / `ClaimResponse` (Medplum types) + base-R4 issues.
- **normalizer input:** a matched `{ claim, claimResponse }` pair (both parsed). **Output:**
  `NormalizedClaim` = `{ claim, lines: ClaimLineRow[], response, denials: DenialRow[] }`
  in canonical (DB-ready) shape from `packages/shared`.
- **db insert:** `insertNormalizedClaim(tx, tenantId, normalized)` inside a tenant-scoped
  transaction that `SET LOCAL app.tenant_id` so RLS applies.

## 3. Data model (build-plan §7)

Full tables (schema only, no logic beyond FKs/RLS):
Tenant, Branch, Provider, Payer, Patient, Claim, ClaimLine, ClaimResponse, Denial,
Rule, ScrubResult, Appeal, AppealTemplate, AuditLog, User.

- `tenant_id` on **every** tenant-scoped row.
- **RLS** enabled on every tenant-scoped table; policy: `tenant_id = current_setting('app.tenant_id')::uuid`.
- `Denial` is the exploded analytics row: one row per denied line × reason.
- Money as `numeric`, currency code column. Codes (`sbs_code`, `icd10am_code`,
  `reason_code`) as text this pass (real KSA code sets are creds-gated).

## 4. Synthetic generator (build-plan §9)

Deterministic (seeded PRNG — no `Date.now`/`Math.random` in fixtures) TS generator producing
valid R4 `Bundle`s containing a `Claim` + its `ClaimResponse`, covering:
denial-reason permutations, payer variants, **partial** denials, **bundled** lines,
**missing pre-auth**, EN/AR text. Denial reasons drawn from the placeholder enum
(`// TODO(nphies-creds): replace with real NPHIES adjudication codes`).

## 5. Testing (TDD, table-driven)

- **Unit** (Vitest): parser (valid/invalid/edge R4), normalizer (mapping + denial explosion),
  generator (produces valid-parsing bundles across permutations). Written test-first.
- **Integration:** spin local Postgres (docker/CI service via `DATABASE_URL`), run migrations,
  apply RLS, generate a bundle, parse → normalize → insert, assert canonical rows + assert RLS
  blocks cross-tenant reads.
- Coverage target 80%+ on the three logic packages.

## 6. CI skeleton (build-plan §8 Wk1)

GitHub Actions on push/PR: install (pnpm) → lint → typecheck → test (with Postgres service).
**Deferred to DEPLOY:** KSA-region cloud env, infra/creds.

## 7. Definition of Done

- Monorepo builds; `pnpm test` green.
- Parser, normalizer, synthetic generator have passing table-driven unit tests.
- A generated synthetic bundle runs full parse→normalize→insert into local Postgres
  (migrations + RLS applied); RLS isolation asserted.
- Every NPHIES-creds dependency is a typed stub tagged `TODO(nphies-creds)`.
- `code-review` run on the diff before finishing.

**Left OPEN (creds/SME-gated, per plan §8 CREATE exit gate):** parse a *real* NPHIES
`ClaimResponse` → rows; denial taxonomy reviewed by a KSA RCM SME. This pass delivers the full
structure so closing the gate later = drop in a real bundle + swap the placeholder enum. No rewrite.
