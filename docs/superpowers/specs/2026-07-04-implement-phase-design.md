# IMPLEMENT Phase — Design Spec

> Wk4–8 of `02_product_build_plan.md`. Turns the proven CREATE data pipeline into the 5 MVP
> modules on synthetic data: bilingual (EN/AR RTL) multi-tenant app, audit-everything, RBAC.
> Requirements are locked by `02_product_build_plan.md` (§1–§12) and `03_design_brief.md` (§1–§14).
> This doc is the decomposition + thinnest-working-slice + build order, not a re-litigation of those.

## 1. What already exists (build on, do not rebuild)

- `@taweed/shared` — canonical row types (snake_case, money-as-string), `newId()`, placeholder
  `TWD-D01..D08` denial taxonomy (`DENIAL_REASON_CODES`, `denialLabel`).
- `@taweed/fhir` — R4 parse + validate + NPHIES-profile (base) → `ClaimPair`.
- `@taweed/normalizer` — `normalize(pair, ctx)` → `NormalizedClaim`.
- `@taweed/db` — Drizzle schema (all §7 tables incl. rules/scrub_results/appeals/audit_logs already
  declared), `withTenant(pool, tenantId, fn)` (the ONLY sanctioned tenant data path; RLS FORCE +
  non-owner `taweed_app` role), `insertNormalizedClaim`, migrations 0000–0002.
- `test/synthetic-fhir` — synthetic NPHIES bundle generator.
- `apps/web` — placeholder Next.js 15 / React 18 App Router (to be stood up for real).
- Stubs to fill: `@taweed/audit`, `@taweed/rules-engine`, `@taweed/appeals`. New: `@taweed/analytics`.

Conventions (match exactly): ESM, `.js` import specifiers in TS, `verbatimModuleSyntax`, snake_case
row props, money as `numeric`→string, vitest projects `unit` + `integration` (`*.int.test.ts` needs
`DATABASE_URL`), pnpm workspace.

## 2. Architecture of this pass

```
Browser (EN/AR RTL, light/dark)
   │  Auth.js session { userId, tenantId, role }  ← tenant_id NEVER from client input
   ▼
Next.js App Router (apps/web)
   │  every data access → withTenant(pool, session.tenantId, db => …)   [RLS enforced]
   │  every PHI read/write/export → @taweed/audit.logPhiAccess(...)     [append-only]
   ├── Ingest      → @taweed/fhir → @taweed/normalizer → @taweed/db.insertNormalizedClaim + quarantine
   ├── Analytics   → @taweed/analytics rollups (canonical rows only, never raw FHIR)
   ├── Scrubber    → @taweed/rules-engine.scrub(claim, rules) → ScrubResult
   ├── Appeals     → @taweed/appeals.generate(denialCtx, locale) → { en, ar, docChecklist }
   └── Recovery    → status transitions on appeals → recovered SAR → analytics + money indicator
   ▼
Postgres (docker postgres:16, RLS FORCE, per-tenant) + object store (local fs stub, S3 swap = DEPLOY)
```

Tenant isolation is proven at three layers per the DoD: **DB** (RLS FORCE, already tested in CREATE),
**API** (`withTenant` wraps every access; `tenant_id` derived from verified session), **UI**
(RBAC-gated nav + server-enforced role; switching tenant/role from client is impossible).

## 3. Thinnest working slice per module (each proves the module on synthetic data)

| Module | Thinnest slice that is genuinely "working" |
|---|---|
| **Shell** | Login (dev creds) → session {userId,tenantId,role} → a server component reads seeded rows via `withTenant` → renders. RBAC hides/shows nav + gates one action. One PHI read writes an `audit_logs` row. |
| **Ingest** | Upload one FHIR `Claim`+`ClaimResponse` bundle → parse→normalize→insert; a deliberately-malformed bundle lands in a quarantine list with a human-readable reason (nothing silently dropped). Run-ledger counters tick. |
| **Analytics** | SQL rollups over seeded canonical rows → hero stat (denial rate + at-risk SAR), ranked payer bars, denial-reason Pareto, trend line. Numbers provenance-labeled. |
| **Scrubber** | Evaluate a seeded claim against rules-as-data → `ScrubResult` (risk 0–100 + each flag traced to rule name + failed field) → table + detail drawer. |
| **Appeals** | Pick a denial → `generate()` returns EN + AR draft + doc checklist → human review gate must be confirmed before Export PDF enables → export produces a PDF-ready payload. Never auto-submits. |
| **Recovery** | Mark an appeal Won with recovered SAR → row moves stage, ROI band + global money indicator recompute (at-risk decrements, recovered increments). |

## 4. Packages — interfaces (design for isolation; each testable alone)

### `@taweed/audit`
```ts
type AuditAction = "read" | "write" | "export";
interface AuditEntry { actor: string; action: AuditAction; entity: string; entityId: string; ip?: string; }
// Writes one append-only audit_logs row. MUST run inside withTenant (RLS supplies tenant_id match).
// Guard: entity/entityId/actor only — no PHI fields accepted in the payload (type-enforced).
async function logAudit(db: Database, entry: AuditEntry): Promise<void>;
```

### `@taweed/rules-engine`
```ts
interface ScrubRule { id: string; name: string; scope: "global"|"tenant"|"payer"; version: number;
  when: JsonRulesCondition; severity: "info"|"warn"|"high"; weight: number;
  field: string; message_en: string; message_ar: string; }
interface ScrubFlag { ruleId: string; ruleName: string; field: string; severity: string;
  message_en: string; message_ar: string; }
interface ScrubResult { claimId: string; riskScore: number /*0–100*/; flags: ScrubFlag[]; unevaluable: string[]; }
async function scrub(facts: ClaimFacts, rules: ScrubRule[]): Promise<ScrubResult>;
```
- Built on `json-rules-engine` (ISC). Rules are JSON data (PR-diffable, no `eval`). Ship 10–20 rules.
- `ClaimFacts` = flat projection of a claim+lines+patient+payer (pre-auth present?, patient gender,
  patient age, sbs codes, payer id, line units, eligibility window …). Codes stay `TODO(nphies-creds)`.
- Golden set: `{ name, facts, expectFlags[] }[]` table-driven; runs on every rule change.
- Risk score = bounded weighted sum of fired flags → 0–100. A rule that cannot read its fact → `unevaluable`
  (surfaces "needs data", never a false pass — design-brief §8.3).

### `@taweed/appeals`
```ts
interface AppealContext { claim, line, denial, payerName, providerName, memberId, clinicalNote?, atRiskSar }
interface AppealDraft { subject_en; body_en; subject_ar; body_ar; docChecklist: {key,label_en,label_ar}[];
  payerSpecific: boolean; }
function generateAppeal(ctx: AppealContext): AppealDraft;
function appealToPdfModel(draft, ctx, locale): PdfDoc; // structured, render later
```
- Deterministic templates keyed on `denial.category` (+ payer override when present). NO LLM (AR-medical
  reliability gap §12.2 → human-in-loop). AR output is a real Arabic document, not mirrored EN.
- Latin claim IDs / SBS codes stay LTR-isolated inside AR body.

### `@taweed/analytics`
```ts
interface DenialRateByDim { dim: string; label: string; claims: number; denied: number; rate: number; atRiskSar: string; }
interface ReasonPareto { code: string; label: string; count: number; sar: string; cumulativePct: number; }
interface MoneyScope { recoveredSar: string; atRiskSar: string; deniedCount: number; }
// All take (db, filters) and run inside withTenant; canonical rows only, never raw FHIR (§3).
async function denialRateBy(db, dim: "payer"|"branch"|"provider"|"reason"|"sbs", f): Promise<DenialRateByDim[]>;
async function reasonPareto(db, f): Promise<ReasonPareto[]>;
async function moneyScope(db, f): Promise<MoneyScope>;
async function trend(db, f): Promise<{ period: string; deniedSar: string; recoveredSar: string }[]>;
```

## 5. CREATE follow-ups now due (migration 0003 + code)

- **Auth-derived `tenant_id`** (SEC): shell derives `tenant_id` from the verified Auth.js session claim,
  passes to `withTenant`. Client input is never trusted. (Closes SEC LOW follow-up.)
- **Composite same-tenant FKs** (DB HIGH #1): add `UNIQUE(id, tenant_id)` to each parent, and composite
  FKs `(child_ref, tenant_id) → (id, tenant_id)` on branch_id/provider_id/payer_id/patient_id/claim_id/
  claim_line_id so a cross-tenant id can't attach (FK checks bypass RLS).
- **Money precision** (TS MEDIUM): add CHECK non-negative on amount columns; missing required amount is a
  data-quality quarantine reason, not a silent `0.00`. Keep `numeric(14,2)` (halalas = later/DEPLOY);
  document the choice.

## 6. Build order (Wk4→8) → one plan per unit

1. **Foundation** (Wk4 base): migration 0003 (composite FKs + CHECK), session→tenant contract, synthetic
   volume + `seed` script (docker postgres up → migrate → generate N tenants/branches/claims/denials).
2. **Logic packages, parallel, TDD each**: `audit`, `rules-engine` (+golden set), `appeals` (+templates),
   `analytics`. Pure-logic first (rules/appeals need no DB); audit/analytics add integration tests.
3. **App shell** (Wk4): tokens.css → Tailwind+shadcn primitives → i18n/RTL + theme → Auth.js dev + RBAC +
   tenant context + audit wiring → three-zone shell + dual money indicator.
4. **Module surfaces** (Wk5–8): Ingest → Analytics → Scrubber → Appeals → Recovery, each wired to its
   package + seeded DB, EN/AR + light/dark, count-up on money.
5. **Verify**: unit+integration green, Playwright E2E/a11y/visual (feasible subset), `pnpm build`,
   code-review + healthcare + security reviewers on PHI paths.

## 7. Out of scope (typed stubs, tagged) — unchanged from task

Live NPHIES/PKI/submission, real IG StructureDefinition validation, real KSA code sets, real
design-partner data, KSA-region hosting + KSA-resident OIDC + object-store region, ML denial
prediction, mobile, HIS write-back, pen-test. Every gated dep stays a typed stub tagged
`TODO(nphies-creds)` or `TODO(ksa-oidc)`.

## 8. Definition of done (this pass) — from build-plan §8 Wk8

5 modules functional on synthetic data (ingest→analytics→scrubber→appeal→recovery); EN/AR RTL both
first-class; light/dark both intentional; tenant isolation verified UI+API+DB with session-derived
tenant_id; audit on every PHI read/write/export, no PHI in logs; rules golden-set green; ≥1 appeal in
EN and AR; recovery moves the ROI counter; `pnpm build` green; unit+integration+E2E/a11y green as
feasible; reviewers run on the diff.
