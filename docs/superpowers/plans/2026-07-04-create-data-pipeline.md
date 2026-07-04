# CREATE Data Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, chosen) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Prove a synthetic NPHIES `Claim`/`ClaimResponse` R4 bundle parses and normalizes into canonical Postgres rows (migrations + RLS), verified by TDD tests. No UI.

**Architecture:** pnpm-workspace monorepo. Contract-first: `packages/shared` defines canonical row types + placeholder denial enum; `packages/db` (Drizzle) owns schema/migrations/RLS + a tenant-scoped insert; `packages/fhir` parses/validates R4 via `@medplum/fhirtypes`; `packages/normalizer` maps parsed FHIR → canonical rows (denials exploded); `test/synthetic-fhir` generates deterministic R4 bundles. Integration test drives the full path into local Postgres.

**Tech Stack:** TypeScript (strict, NodeNext ESM), pnpm workspaces, Vitest, Drizzle ORM + drizzle-kit, node-postgres (`pg`), `@medplum/fhirtypes`, Next.js (empty placeholder), GitHub Actions.

---

## File Structure

```
taweed/
├─ package.json                 # root, pnpm workspaces, scripts
├─ pnpm-workspace.yaml
├─ tsconfig.base.json           # strict, NodeNext
├─ vitest.workspace.ts
├─ .github/workflows/ci.yml     # lint+typecheck+test w/ postgres service
├─ docker-compose.yml           # local postgres for integration tests
├─ apps/web/                    # empty Next.js placeholder
├─ packages/
│  ├─ shared/    src/{index,types,denial-codes,id}.ts + tests
│  ├─ db/        src/{schema,client,insert-normalized,index}.ts; drizzle/*.sql; drizzle.config.ts; tests
│  ├─ fhir/      src/{index,parse,validate-r4,nphies-profile}.ts; tests
│  ├─ normalizer/ src/{index,normalize}.ts; tests
│  ├─ rules-engine/ package.json + src/index.ts (stub)
│  ├─ appeals/     package.json + src/index.ts (stub)
│  └─ audit/       package.json + src/index.ts (stub)
└─ test/synthetic-fhir/ src/{index,generate,rng,scenarios}.ts; tests
```

---

## Task 1: Monorepo scaffold

**Files:** Create `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `vitest.workspace.ts`, `.gitignore` (append), `docker-compose.yml`.

- [ ] Root `package.json`: `"private": true`, packageManager pnpm, scripts `build`/`lint`/`typecheck`/`test`/`test:int` running across workspaces; devDeps: typescript, vitest, @vitest/coverage-v8, eslint + typescript-eslint, prettier.
- [ ] `pnpm-workspace.yaml`: packages `apps/*`, `packages/*`, `test/synthetic-fhir`.
- [ ] `tsconfig.base.json`: `strict`, `module: NodeNext`, `moduleResolution: NodeNext`, `target: ES2022`, `declaration`, `composite` off, `verbatimModuleSyntax`.
- [ ] `vitest.workspace.ts`: glob `packages/*` + `test/synthetic-fhir`.
- [ ] `docker-compose.yml`: `postgres:16`, db `taweed`, expose 5432, `POSTGRES_PASSWORD`.
- [ ] Append to `.gitignore`: `node_modules`, `dist`, `.turbo`, `*.tsbuildinfo`, `coverage`.
- [ ] `pnpm install` (root devDeps). Commit `chore: monorepo scaffold`.

## Task 2: packages/shared (contract)

**Files:** Create `packages/shared/{package.json,tsconfig.json,src/index.ts,src/types.ts,src/denial-codes.ts,src/id.ts,test/*.test.ts}`.

- [ ] **Test first** `denial-codes.test.ts`: assert `DENIAL_REASON_CODES` has 8 entries, each `{code, kind:'CARC'|'RARC', label}`, and `isDenialReasonCode(x)` narrows. Run → fail.
- [ ] `denial-codes.ts`: placeholder enum. Header comment `// TODO(nphies-creds): replace with real NPHIES adjudication codes`. 8 fake codes e.g. `TWD-D01..TWD-D08`, kinds mixed, EN labels. `export type DenialReasonCode = typeof DENIAL_REASON_CODES[number]['code']`.
- [ ] `types.ts`: canonical **row** types (snake-cased fields matching DB) — `ClaimRow, ClaimLineRow, ClaimResponseRow, DenialRow, PatientRow, PayerRow, ProviderRow, BranchRow`, and `NormalizedClaim = { claim; lines: ClaimLineRow[]; response: ClaimResponseRow; denials: DenialRow[] }`. All money `string` (numeric), ids `string` (uuid).
- [ ] `id.ts`: `newId()` wrapper over `crypto.randomUUID()` (single seam; keeps ids swappable/mokable).
- [ ] `index.ts` re-exports. Run tests → pass. Commit `feat(shared): canonical types + placeholder denial enum`.

## Task 3: packages/fhir — parse + base-R4 validate + nphies stub

**Files:** Create `packages/fhir/{package.json,tsconfig.json,src/index.ts,src/parse.ts,src/validate-r4.ts,src/nphies-profile.ts,test/*.test.ts}`. Dep: `@medplum/fhirtypes`.

- [ ] **Test** `validate-r4.test.ts` (table-driven): rows of `{name, input, expectOk, expectIssueContains?}` covering: valid Claim, valid ClaimResponse, wrong `resourceType`, missing required (`status`), non-object. Run → fail.
- [ ] `validate-r4.ts`: `validateR4(resource): { ok:true; resource } | { ok:false; issues: string[] }`. Base FHIR R4 structural checks only (resourceType present + known, required fields present per resource kind). No external validator.
- [ ] **Test** `parse.test.ts`: `parseBundle(json)` returns matched `{claim, claimResponse}` pairs + `issues`; handles a `Bundle` with one Claim + one ClaimResponse referencing it; flags unmatched. Run → fail.
- [ ] `parse.ts`: `parseResource(json): ParseResult<Claim|ClaimResponse>` (JSON → validateR4). `parseBundle(json): { pairs: {claim,claimResponse}[]; issues }` — pairs ClaimResponse.request → Claim by id/fullUrl.
- [ ] `nphies-profile.ts`: `export function validateAgainstNphiesProfile(_r: unknown) { return { ok: true, todo: 'nphies-creds' } as const }` with `// TODO(nphies-creds): plug gated IG StructureDefinitions here (build-plan §5,§12)`.
- [ ] `index.ts` re-exports. Tests → pass. Commit `feat(fhir): R4 parse + base validation + nphies stub`.

## Task 4: test/synthetic-fhir — deterministic generator

**Files:** Create `test/synthetic-fhir/{package.json,tsconfig.json,src/index.ts,src/rng.ts,src/scenarios.ts,src/generate.ts,test/*.test.ts}`. Dep: `@medplum/fhirtypes`, `@taweed/fhir`.

- [ ] `rng.ts`: seeded PRNG (mulberry32) — deterministic, **no** `Math.random`/`Date.now`.
- [ ] **Test** `generate.test.ts` (table-driven over scenarios): every generated bundle `parseBundle()`s with **zero** issues and yields exactly one pair; partial-denial scenario yields a ClaimResponse with ≥1 adjudication error + ≥1 accepted; missing-pre-auth scenario sets the flag; AR scenario includes Arabic text. Run → fail.
- [ ] `scenarios.ts`: named scenario descriptors — `fullDenial, partialDenial, bundledLines, missingPreAuth, payerVariantA/B, arabicText, clean`. Each picks denial codes from `DENIAL_REASON_CODES`.
- [ ] `generate.ts`: `generateBundle(scenario, seed): Bundle` building valid R4 Claim + ClaimResponse (item/adjudication, `outcome`, `disposition`, EN/AR `text`). `generateAll(seed)` → all scenarios.
- [ ] Tests → pass. Commit `feat(synthetic-fhir): deterministic R4 bundle generator`.

## Task 5: packages/normalizer — FHIR → canonical rows

**Files:** Create `packages/normalizer/{package.json,tsconfig.json,src/index.ts,src/normalize.ts,test/*.test.ts}`. Deps: `@taweed/shared`, `@taweed/fhir`.

- [ ] **Test** `normalize.test.ts` (table-driven, fed by `generateAll`): for each scenario assert — one `ClaimLineRow` per Claim.item; `DenialRow` **exploded** to one row per denied line × reason (partial denial → fewer denials than lines; full → one per line); amounts/currency mapped; every row carries `tenant_id`. Run → fail.
- [ ] `normalize.ts`: `normalize(pair, ctx: {tenantId, branchId, providerId, payerId, patientId}): NormalizedClaim`. Map Claim→ClaimRow, Claim.item[]→ClaimLineRow[], ClaimResponse→ClaimResponseRow, ClaimResponse.item[].adjudication (error reasons) → DenialRow[] (skip accepted lines). Map adjudication reason codes → `DenialReasonCode`.
- [ ] `index.ts` re-exports. Tests → pass. Commit `feat(normalizer): FHIR → canonical rows with denial explosion`.

## Task 6: packages/db — schema + migrations + RLS + tenant client

**Files:** Create `packages/db/{package.json,tsconfig.json,drizzle.config.ts,src/schema.ts,src/client.ts,src/insert-normalized.ts,src/index.ts}`; generated `drizzle/*.sql`; `src/rls.sql`.

- [ ] `schema.ts`: Drizzle pgTable for all §7 entities. `tenant_id uuid not null` on every tenant-scoped table. FKs per text-ERD. `enableRLS()` on tenant-scoped tables.
- [ ] `pnpm drizzle-kit generate` → base migration SQL. Commit generated SQL.
- [ ] `rls.sql` (hand-written migration appended): `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + `CREATE POLICY tenant_isolation USING (tenant_id = current_setting('app.tenant_id')::uuid)` for each tenant-scoped table. Also a non-superuser app role note.
- [ ] `client.ts`: `getPool()` from `DATABASE_URL`; `withTenant(pool, tenantId, fn)` → runs `fn` in a tx after `SET LOCAL app.tenant_id = $1` (RLS seam).
- [ ] `insert-normalized.ts`: `insertNormalizedClaim(db, n: NormalizedClaim)` — inserts claim, lines, response, denials in FK order within the caller's tenant tx.
- [ ] `index.ts` re-exports. Typecheck. Commit `feat(db): Drizzle schema + migrations + RLS + tenant client`.

## Task 7: Integration test — full path into local Postgres

**Files:** Create `packages/db/test/integration.test.ts` (gated on `DATABASE_URL`), `packages/db/test/migrate.ts` helper.

- [ ] `migrate.ts`: apply generated SQL + `rls.sql` against `DATABASE_URL` (drizzle migrate or raw exec).
- [ ] **Test** `integration.test.ts`: `beforeAll` migrate. Seed tenant/branch/provider/payer/patient. `generateBundle('partialDenial', seed)` → `parseBundle` → `normalize` → `withTenant(tenantId, tx => insertNormalizedClaim(...))`. Assert row counts (claim=1, lines=N, denials=exploded count). **RLS assertion:** `withTenant(otherTenantId, ...)` SELECT returns 0 rows. Run against docker PG → pass.
- [ ] Commit `test(db): full parse→normalize→insert integration + RLS isolation`.

## Task 8: apps/web placeholder + stub packages

- [ ] `apps/web`: minimal Next.js app (`vercel:nextjs` scaffold), no screens beyond default placeholder; ensure it typechecks and is excluded from unit test run.
- [ ] `packages/{rules-engine,appeals,audit}`: each `package.json` + `src/index.ts` exporting a `TODO(nphies-creds)`/`// built later` placeholder. No logic.
- [ ] Commit `chore: apps/web placeholder + stub packages`.

## Task 9: CI + final review

- [ ] `.github/workflows/ci.yml`: on push/PR → pnpm install → `lint` → `typecheck` → `test`; job with `services: postgres:16` + `DATABASE_URL` for `test:int`. Comment: KSA-region env deferred to DEPLOY.
- [ ] Run `pnpm lint && pnpm typecheck && pnpm test && pnpm test:int` locally green.
- [ ] Run `code-review` on the diff; address CRITICAL/HIGH.
- [ ] Commit `ci: lint+typecheck+test skeleton`.

---

## Self-Review

- **Spec coverage:** §2 packages → Tasks 2–6,8; §3 data model → Task 6; §4 generator → Task 4; §5 tests → Tasks 3–7; §6 CI → Task 9; DoD integration+RLS → Task 7. Stubs (rules-engine/appeals/audit, nphies-profile) → Tasks 3,8. No gaps.
- **Placeholders:** none — every task has concrete files/signatures.
- **Type consistency:** `NormalizedClaim`, `insertNormalizedClaim`, `withTenant`, `parseBundle`, `generateBundle`, `normalize`, `DenialReasonCode` used consistently across tasks 2/4/5/6/7.
