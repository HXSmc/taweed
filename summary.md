# Taweed — New Partner Summary

*Written 2026-07-24. This is the onboarding doc — read this first, then `docs/review.md` (Part 1
for a click-by-click local walkthrough, Part 2 for a from-scratch technical tour written for
non-TypeScript engineers) and `docs/handoff.md` (the full chronological build history).*

---

## 1. What this is, and what we're selling

**Taweed** (Arabic تعويض, "reimbursement") is a bilingual (English/Arabic, full right-to-left)
multi-tenant **denial-recovery SaaS** for Saudi Arabia's mid-market private clinic groups.

Every private health-insurance claim in Saudi Arabia flows through **NPHIES** — the national
HL7 FHIR R4 claims-exchange rail connecting providers and insurers. Insurers routinely **deny**
claims (bad or missing billing codes, no pre-authorization, eligibility mismatches, and dozens of
other reasons) — and that denied money is real, recoverable clinic revenue that mostly goes
uncollected today because nobody has time to fight every denial by hand.

Taweed ingests a clinic's own claim/remittance data — NPHIES FHIR bundles, CSV/Excel exports, or
scanned PDF insurer remittances (EOBs) — and:

1. **Analyzes** denial patterns by payer, branch, and billing code, so the clinic knows exactly
   where the money is leaking.
2. **Scrubs** claims against billing rules *before* submission, flagging what's likely to be
   denied so it can be fixed pre-emptively.
3. **Drafts bilingual appeal letters** automatically (deterministic templates, human-reviewed —
   nothing is ever auto-submitted).
4. **Tracks recovery** — how much denied money was actually won back.

The whole product orbits one number: **recovered SAR (Saudi Riyals)**. Everything in the UI is
designed around making that number visible and growing.

Taweed does **not** require live NPHIES PKI/vendor integration to deliver value — it works
purely on data a clinic already has or can export, which is deliberate: it removes the single
biggest and slowest blocker (NPHIES vendor certification) from the MVP's critical path.

### Who we're selling to, and how

**Target customer:** physician-owned private clinic groups with 3–15 branches, in
insured-revenue-heavy specialties (dental, dermatology, polyclinics, ophthalmology, IVF), in
Riyadh/Jeddah/Dammam/Makkah/Madinah. This segment is too small for enterprise RCM suites, too
multi-branch for a single-clinic tool, and underserved by existing clearinghouse/HIS products
(none of which are purpose-built for denial recovery at this scale — see
`docs/01_market_and_gtm.md` for the full competitive landscape).

**Pricing model:** a per-branch SaaS base fee (~SAR 1,500–3,000/branch/month) **plus** a 10–15%
success fee on denied SAR actually recovered via a generated appeal. This is deliberately
self-de-risking — the pricing only works if the recovered-SAR number is provably real, which is
exactly why product design treats that number as sacred (see `docs/03_design_brief.md`'s
"recovered SAR is the hero number" principle).

**Go-to-market wedge:** a free "denial audit" run on a prospect's own real data, converting into a
paid design-partner pilot once recovery is demonstrably real. Modeled ACV is roughly SAR
80–150k for a ~6-branch group.

**An important honesty note, baked into the docs themselves:** the commonly-cited "~25% denial
rate / SAR 3B denied per year" market-sizing figures were researched and found to be
**unverified vendor-blog claims**, not primary-sourced from any real KSA regulatory report
(`docs/01_market_and_gtm.md`, `docs/HUMAN_CONFIRMATION_NEEDED.md`). The real denial rate for any
given clinic must be proven per-clinic via the free audit — it is never asserted as a market fact
to a prospect. This kind of self-correcting rigor shows up throughout the docs (see `docs/audit
docs/deps.md`'s caught-fabricated-CVE example, and `docs/audit docs/idea-pressure-test.md`'s
frank "WEAK, not pivot-required" verdict) — a repo-wide habit worth knowing about and continuing.

### Where the company actually is, right now

Pre-revenue, pre-first-design-partner. Commercial Registration (CR) was obtained 2026-07-21.
Several real-data/legal blockers remain fully open and gate ever touching real patient data:
NPHIES vendor certification (multi-step, gated behind CR + Academy enrollment), KSA privacy
counsel sign-off on AI/PHI handling (SDAIA/PDPL), and KSA-resident hosting for real data (the
current live deployment is intentionally synthetic-data-only and does not need to wait on this).
See `docs/blocker.md` for the full `BLK-*` registry and `docs/post-CR.md` for what the CR did and
didn't unblock.

**Everything built and running today uses synthetic (fake) data only.** No real patient data has
ever touched this system.

---

## 2. Architecture at a glance

- **Stack:** Next.js 15 (App Router) + TypeScript, Postgres with **Row-Level Security** as the
  real tenant-isolation boundary (not just app-layer checks), Drizzle ORM, a JSON-rules-DSL
  engine for the pre-submission scrubber, NextAuth (Credentials/dev-auth today; a real KSA-resident
  OIDC provider is the deferred production path), Tailwind + shadcn/ui, next-intl for EN/AR.
- **Monorepo:** pnpm workspaces — one app (`apps/web`), several focused internal packages
  (`packages/*`), all detailed in the full repo minimap below.
- **The FHIR-to-relational boundary is a deliberate architectural line:** raw NPHIES FHIR bundles
  are parsed and validated (`packages/fhir`), then immediately normalized into a canonical
  relational model (`packages/normalizer`) that the rest of the app — analytics, the rules engine,
  the UI — queries exclusively. FHIR is treated as an exchange format only, never queried directly
  outside the ingest boundary.
- **The AI layer is a single, narrow, kill-switched seam:** `packages/ai` is the ONLY package
  allowed to call an LLM (currently Anthropic Claude), gated behind per-feature environment flags,
  with a pseudonymizer stripping PHI before any model call. Four AI features exist today (plain-
  language flag explanations, appeal-draft assist, natural-language rule authoring, and vision-
  model PDF/EOB extraction) — all four are additive on top of a fully deterministic core that
  works with zero AI enabled. See `docs/04_agentic_retrofit_plan.md` for the full design reasoning
  and `docs/LLM_eval.md` for a live, scored comparison of Claude vs. Gemini vs. GLM as providers.
- **Deployed today** at `https://taweed.vercel.app` (Vercel + Neon Postgres) — a synthetic-data
  demo deployment, separate from the `infra/` Terraform skeleton (which targets real-data,
  KSA-resident hosting on Oracle Cloud Riyadh and is intentionally not yet runnable).
- **Audit trail as a first-class practice:** `docs/audit docs/` holds a 26+-pass, repeatedly
  re-run structured audit history (bugs, security, dependencies, accessibility, over-engineering,
  UI quality, production-readiness) — read `docs/audit docs/audit.md` before starting any new audit
  work, it's the index into everything else in that directory.

---

## 3. How to actually run it

Don't duplicate this here — `README.md` has a complete, copy-paste, no-coding-experience-required
Docker quick start, and `docs/review.md` Part 1 is a full click-by-click walkthrough of every
feature (including the 4 AI features) once it's running. Start with README.md.

---

## 4. Full repo file/folder minimap

### Root

| Path | What it is |
|---|---|
| `README.md` | Primary onboarding doc: a no-code-experience-needed Docker quick start, a non-Docker local-dev path, test commands, and how to turn on the (off-by-default) AI features. Start here for "how do I run this." |
| `package.json` / `pnpm-workspace.yaml` / `tsconfig.base.json` / `tsconfig.json` | Monorepo root config — pnpm workspaces, pinned Node ≥22 / pnpm 11.13, shared TS config extended by every package. |
| `vitest.workspace.ts` | Defines the multi-project Vitest setup (`unit`, integration, `evals`) so `pnpm test` / `pnpm test:int` / the opt-in live AI evals run against the right project. |
| `eslint.config.mjs` | Root ESLint flat config shared across `apps/web` and `packages/*`. |
| `Dockerfile` / `docker-compose.yml` / `.dockerignore` | Docker-first local dev stack (Postgres 16 + the Next.js app) — the path the README recommends for non-technical setup. |
| `.env.local` | Root-level env (gitignored elsewhere per-package; this one holds shared/dev secrets). |
| `.github/workflows/ci.yml` + `.github/dependabot.yml` | CI: lint → typecheck (root + web) → `pnpm audit --audit-level=high` → unit tests, then a separate integration job against a real Postgres service container, plus Dependabot for dependency bumps. KSA-region infra/NPHIES creds are explicitly deferred to DEPLOY, not part of CI. |
| `__mocks__/next/cache.ts` | A manual Vitest mock for `next/cache` (`unstable_cache`/`revalidateTag`) used across the web unit test suite — added 2026-07-24 for the caching hardening story (see §6). |
| `.claude/` | Claude Code / "Everything Claude Code" (ECC) harness configuration for this project — skills, agents, slash commands, rules, hooks, marketplace/plugin config. Not product code; tooling only. |
| `.orchestrator/` | State for an internal multi-phase "autopilot" agent orchestrator run (spec → plan → execution → QA → validation handoff docs, plus per-run logs/specs/reports and a loop-guard lockfile). Build-process bookkeeping, not product code. |
| `summary.md` | This file. |

### `apps/web` — the Next.js 15 App Router application (the only app in the workspace)

- **`app/[locale]/`** — locale-prefixed (`en`/`ar`) App Router tree, route groups:
  - **`(app)/`** — the authenticated product shell, gated by `layout.tsx` (session + RBAC-aware nav rail):
    - `overview/` — the owner/finance landing dashboard (recovered-SAR hero number, forward links).
    - `analytics/` — denial analytics (Pareto by payer/code/branch, trend lines); `analytics/audit-report/` — the "free denial audit" printable/exportable report surface (the literal sales-wedge deliverable).
    - `ingest/` — upload/import UI for FHIR bundles, CSV/XLSX remittances, and PDF EOBs, tabbed alongside the AI-assisted EOB extraction review queue.
    - `scrubber/` — pre-submission rules-engine flag table (claims likely to deny, with the failing rule/field named per flag).
    - `appeals/` — appeal drafting/composer (deterministic bilingual templates + optional AI-suggested paragraphs, human-approved).
    - `recovery/` — recovery-tracking pipeline (mark appeals won/lost, win-rate/median-days); `recovery/owner-report/` — the owner-facing recovered-SAR report surface.
    - `settings/` — tenant settings, rules authoring (including NL→JSON AI rule-authoring), audit log viewer.
    - `error.tsx` / `loading.tsx` — route-group error/loading boundaries.
  - **`(auth)/login/`** — the passwordless demo-account picker (dev/local auth only; production would swap in a KSA-resident OIDC provider).
  - **`(onboarding)/onboarding/`** — first-run branch/tenant setup corridor gating entry into `(app)`.
  - `error.tsx`, `not-found.tsx`, `layout.tsx`, `page.tsx` — locale root: `page.tsx` routes signed-in users to their role's landing module and shows the marketing landing page to everyone else.
  - **`api/`** — `api/auth/[...nextauth]/route.ts` (NextAuth handler) and `api/sample-bundle/route.ts` (serves a sample FHIR bundle for demo/testing).
- **`lib/`** — the server-side data-access/business layer:
  - `db.ts` — the tenant-safe Postgres access seam: two pools (`appPool` under RLS via `withSession`→`withTenant`, and a superuser `adminPool` used *only* for the pre-session login lookup).
  - `auth.ts` / `session.ts` / `rbac.ts` / `authz.ts` — NextAuth Credentials-based dev auth, session helpers, the `Role`/`ModuleKey`/`Level` RBAC capability matrix, and `authorizeAction()` (the server-enforced gate every mutating action calls first).
  - `data.ts`, `appeals-data.ts`, `rules-data.ts`, `eob-review-data.ts`, `report-data.ts`, `tenant-dimensions.ts` — per-domain query/read layers; `data.ts`'s analytics bundles are now wrapped in `unstable_cache` with `cache-tags.ts` tag invalidation (2026-07-24, see §6).
  - `cache-tags.ts` — single source of truth for the per-tenant `analytics:<tenantId>` cache tag string, shared by the read side (`data.ts`) and write side (mutating actions' `revalidateTag` calls). Added 2026-07-24.
  - `actions/` — Next.js Server Actions, one file per feature: `ingest.ts`/`ingest-csv.ts`, `eob-extract.ts`/`eob-review.ts`, `appeals.ts`/`assist-appeal.ts`, `author-rule.ts`, `explain-flag.ts`, `recovery.ts`, `onboarding.ts`, `auth.ts` — each RBAC-gates, rate-limits, and validates before touching data. `eob-extract.ts` now returns fast and runs the heavy PDF/AI work via `after()` (2026-07-24, see §6).
  - `audit.ts` — PHI-access audit-log recording helper used by pages that render sensitive data.
  - `money.ts`, `chart-colors.ts`, `csv-mapping-submit.ts`, `eob-to-normalized.ts`, `ingest-submit.ts`, `rule-decide.ts`, `rate-limit.ts`, `request-guard.ts`, `error-log.ts`, `utils.ts`, `dev-auth-flag.ts`/`dev-auth-secret.ts` — supporting utilities (money formatting/rounding, in-memory rate limiting, dev-only auth flags/secrets, error-log redaction, request guards).
- **`components/`** — `shell/` (app chrome: rail nav, tenant/branch switcher, locale/theme toggles, command bar, account menu); `modules/` (feature UI: ingest panel, scrubber table, appeals composer, EOB review queue + extraction form, rule authoring, onboarding corridor, owner/audit report documents); `charts/` (Pareto, ranked bars, trend line); `money/` (count-up animation, money figure display); `marketing/landing.tsx` (the pre-login marketing page); `ui/` — the shadcn/ui-derived primitive component set (button, card, table, tabs, select, sheet, dropdown, etc.), token-owned per the design brief.
- **`i18n/`** — next-intl routing/navigation/request config for the `en`/`ar` locale split; `messages/en.json` / `ar.json` hold the translation catalogs (kept parity-checked in CI).
- **`test/`** — ~130 Vitest unit/component test files, one per feature/bug-class (rate limiting, RBAC/authz ordering, race conditions like TOCTOU, a11y/contrast checks per component, i18n parity, money-arithmetic edge cases, etc.) — the sheer density reflects the "root-cause fix + regression test" discipline visible throughout the audit docs.
- **`tests/e2e/`** — Playwright specs: `smoke.spec.ts`, `a11y.spec.ts`, `money-arc.spec.ts`, `eob-review-queue.spec.ts`.
- **`hooks/`**, **`types/`** — a single reduced-motion hook, and NextAuth type augmentation.
- Config: `middleware.ts` (locale routing), `next.config.mjs` (incl. security headers), `playwright.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`.

### `packages/*` — the workspace libraries (`@taweed/*`)

| Package | Purpose (verified from source, no `package.json` description fields exist) |
|---|---|
| **`packages/fhir`** | Parses and validates NPHIES FHIR R4 `Claim`/`ClaimResponse` bundles — pairs claims to their responses, runs base-R4 structural validation (`validate-r4.ts`), with a separate NPHIES-profile stub gated on IG licensing (`nphies-profile.ts`). |
| **`packages/normalizer`** | Maps parsed FHIR `ClaimPair`s into the canonical internal relational row types (`ClaimRow`/`ClaimLineRow`/`DenialRow`, etc.) that the rest of the app queries — "FHIR is for exchange, the canonical model is for analytics." |
| **`packages/rules-engine`** | The pre-submission "scrubber": a JSON-rules-DSL evaluator (`scrub.ts`, on top of `json-rules-engine`) with three-valued (true/false/unknown) fact resolution, plus rule authoring/versioning/scoping (`author.ts`, `select.ts`, `project.ts`, `registry.ts`) and a golden-corpus regression gate for AI-authored rules. |
| **`packages/appeals`** | Bilingual (EN/AR) appeal-letter template engine (`generate.ts`, `templates.ts`) — deterministic by design, "NO LLM" in the core path; AI-suggested paragraphs are bolted on additively elsewhere. |
| **`packages/analytics`** | Aggregation/rollup queries over the canonical model (never raw FHIR): money-at-risk vs. recovered SAR (`money.ts`), denial Pareto/trend/recoverability queries (`queries.ts`, `recovery.ts`), always run inside `withTenant` so RLS scopes them. |
| **`packages/audit`** | Append-only PHI-access audit-log library: a field-allowlisting sanitizer (`sanitizeAuditEntry`) that rejects any non-whitelisted key, plus `logAudit`, always scoped to the active RLS tenant. |
| **`packages/db`** | Drizzle ORM schema (`schema.ts`) + hand-written SQL migrations (`drizzle/0000`–`0011`: init, RLS, indexes, composite FKs, LLM-call audit tables, rule-authoring columns, rate-limit windows, etc.) + the tenant-scoped `client.ts` connection/session helpers (`getPool()` now sets TCP `keepAlive`, 2026-07-24 — see §6). This is the single source of truth for the DB shape and Row-Level Security policy. |
| **`packages/ingest`** | File-ingestion adapters: a dependency-free RFC-4180 CSV/TSV parser (`csv.ts`), CSV→claims mapping (`csv-to-claims.ts`, `mapping.ts`), XLSX, PDF text-layer extraction (`pdf-text-layer.ts`) and an `OcrAdapter` seam for vision-model PDF OCR (`pdf-ocr.ts`), and an EOB-extraction adapter that plugs into `packages/ai`. |
| **`packages/platform`** | Infra-abstraction seams meant to be swapped for real KSA-region services at DEPLOY: per-tenant envelope-encryption KMS interface (`kms.ts`, dev impl is a reversible XOR stub, explicitly marked non-secure), an object-store interface (`object-store.ts`), and an OIDC stub (`oidc.ts`). |
| **`packages/shared`** | Cross-package primitives: canonical row/type definitions (`types.ts`), denial-reason code taxonomy (`denial-codes.ts`), an EN/AR glossary, ID generation, edit-distance (used for appeal-suggestion diffing), and a shared in-memory rate-limiter. |
| **`packages/ai`** | The **only** package allowed to call an LLM (currently Anthropic Claude) — a single audited, kill-switched gate (`run.ts`, `config.ts`, `errors.ts`) with per-feature env flags (`explain`/`appeal`/`authorRule`/`extractEob`), a pseudonymizer for PHI-free payloads, Arabic post-processing, appeal-guardrails (invented-number/glossary/second-model-verify checks), and `evals/` — objective scoring harnesses (currently comparing Claude vs. Gemini vs. GLM per `docs/LLM_eval.md`) that never run in CI, only opt-in live. |

### `infra/`

Terraform **skeleton only** (deliberately not runnable — no credentials, no live infra): pinned to Oracle Cloud Riyadh (`me-riyadh-1`) for PDPL in-Kingdom hosting. Files: `main.tf`, `kms.tf`, `object-store.tf`, `postgres.tf`, `variables.tf`, `terraform.tfvars.example`, `README.md` (documents the blockers — Oracle creds, counsel PDPL sign-off, pre-GA pen-test — that gate actually applying it). **The app is separately ALSO already deployed live** on Vercel + Neon Postgres (`https://taweed.vercel.app`) for the synthetic-data demo — a faster, separate path from this KSA-Terraform real-data target.

### `test/` (root)

Synthetic data generators/fixtures shared across packages: `test/synthetic-fhir/` and `test/synthetic-eob/` are their own small local packages (with `src`/`test`/`package.json`) generating synthetic NPHIES FHIR bundles and synthetic EOB documents respectively; `test/stubs/server-only.js` is a test-environment stub for the `server-only` import guard used throughout `apps/web/lib` and `packages/ai`.

### `scripts/`

- `seed.ts` — destructive local-dev seed: wipes + re-migrates local Postgres, then loads synthetic multi-tenant demo data.
- `seed-data.ts` — the shared synthetic-data generation/insertion logic used by both seed scripts (tenants → branches/providers/payers/patients → claims/denials → appeals → rules → users).
- `seed-prod.ts` — the same demo data loaded into an **already-migrated** hosted DB, non-destructively. Actually run successfully against the real production Neon DB for the first time 2026-07-24 (see §6).
- `load-test.ts` — a real `autocannon`-based load test against a live deployment (unauthenticated landing page, cached authenticated analytics page, bounded ingest-page reads). Added and run 2026-07-24 — see `docs/load-test-report.md` and §6.

### `design/`

Visual/design-system reference material: `Taweed Landing.dc.html` and `Taweed Shell.dc.html` (standalone HTML design mockups), `tokens.css` (the locked design-token set — colors, radii — described in `docs/03_design_brief.md`), `support.js`.

---

## 5. In-depth `docs/` minimap

> **Reading note on staleness:** dated headers are self-reported inside each file. `docs/handoff.md` (last refreshed 2026-07-16 as of this writing), `docs/NEXT_STEP_PROMPT.md` (2026-07-18), `docs/blocker.md`/`docs/deferred.md` (2026-07-16) are roughly a week stale relative to this hardening pass (2026-07-24) — real work has landed since (a live Vercel/Neon deploy, further audit passes, `docs/LLM_eval.md`, `docs/post-CR.md`, `docs/counsel-whatsapp-log.md`, and this hardening loop itself). `docs/audit docs/audit.md` and `docs/LLM_eval.md` are current as of 2026-07-24. Treat "current state" docs as directionally right but re-verify against `git log`/the audit docs' latest pass before trusting a specific claim.

| File | Summary |
|---|---|
| **`01_market_and_gtm.md`** | The GTM/market strategy doc: verified NPHIES market sizing (~6,600 provider orgs, 28 insurers, ~14.1M beneficiaries — confirmed from the NPHIES IG), an explicit flag that the popular "~25% denial rate / SAR 3B/yr denied" figures are **unverified vendor claims** that failed primary-source verification, TAM/SAM/SOM sizing, a competitive landscape table (Waseel, HealthOrbit, Insta by Practo, Cirrus, Ecaresoft — none purpose-built for the mid-market), an ICP + buyer/champion persona pair, a 36-account target list (verified branch counts/insured-mix per account), a bilingual cold-outreach cadence, and a full AARRR marketing plan. Current and heavily maintained — this is the primary sales/positioning source. |
| **`02_product_build_plan.md`** | The engineering/product design companion to `01`: MVP scope (5 modules), a CREATE→IMPLEMENT→EXECUTE→DEPLOY roadmap, system architecture (multi-tenant + RLS, FHIR-as-ingest-contract normalized to a relational model, rules-as-data, audit-everything), the stack table, and KSA-region hosting research. This is the closest thing to an architecture doc in the repo. |
| **`03_design_brief.md`** | The design system spec: the "recovered SAR is the hero number" principle, loss-aversion-driven UI framing, the locked color-token system, shadcn/ui-as-foundation rationale, RTL-as-first-class guidance, per-persona design dials. |
| **`04_agentic_retrofit_plan.md`** | The plan for bolting an LLM layer onto the deterministic core. Defines AI-0 (the `@taweed/ai` foundation) through AI-4 (vision-LLM EOB/PDF extraction), and explicitly rules out an NL→SQL agent and any LLM in the money path. All four AI features are confirmed built and merged. |
| **`05_open_source_switching.md`** | A **contingency plan, not an active migration** — what fully switching off Anthropic onto a self-hosted open-weight model in-Kingdom would look like, if/when Oracle or AWS GPU access in KSA clears. |
| **`AI_HARDEN_LOOP.md`** | An operational "harden-to-deploy loop" doc for a specific earlier build phase (post AI-2/AI-3) — a mid-run handoff record, not living documentation. |
| **`ECC_GUIDE.md`** | How the Claude Code tooling harness is wired into this project — a tooling/process doc, not product documentation. |
| **`HUMAN_CONFIRMATION_NEEDED.md`** | The largest "gaps and human-action-items" registry (1000+ lines) — every fact research could **not** confirm, spanning market data, NPHIES onboarding, regulatory posture, and a full KSA compliance audit. The company's living due-diligence ledger. |
| **`LLM_eval.md`** | A scored, code-verified comparison of Claude vs. Gemini vs. GLM across all 4 AI features. Anthropic remains the sole live-path provider; the others are local-only research branches. |
| **`NEXT_STEP_PROMPT.md`** | Gitignored, local-only "what to build next" scratch file. Remaining work is either an external human blocker (`BLK-*`) or a deliberate deferral (`DEF-*`). |
| **`ai-deploy-readiness.md`** | The durable "loop memory" ledger for the AI hardening loop — iteration counters, a defect log, resolved-vs-deferred findings. Operational state, not narrative documentation. |
| **`blocker.md`** | The `BLK-*` registry — every external/human dependency gating real-data operation. Distinguished from `deferred.md`: a blocker is "waiting on someone else," a deferral is "chosen not to build yet." None of the open blockers affect the synthetic-data product already built. |
| **`counsel-whatsapp-log.md`** | An append-only, auto-generated monitoring log of the founder's counsel WhatsApp/email thread re: PDPL/SCC/CR legal work. Operational/legal-process log. |
| **`deferred.md`** | The `DEF-*` registry of deliberately parked engineering decisions. |
| **`handoff.md`** | The primary "start here for a new session" entry point (1100+ lines) — a chronological running log of what's been built/pushed, with commit references. The single best "what actually happened and when" narrative in the repo, though currently about a week stale (needs a fresh entry for this hardening pass — see §6). |
| **`post-CR.md`** | Written the day the Commercial Registration was obtained (2026-07-21): what it does/doesn't unblock. |
| **`review.md`** | A two-part developer-facing doc (1000+ lines): Part 1 is a complete click-by-click local testing guide; Part 2 is a "technical review" tour written for non-TypeScript engineers. Read this alongside this file. |
| **`load-test-report.md`** | New 2026-07-24 — real `autocannon` numbers from Story 3 of this hardening pass, see §6. |

### `docs/audit docs/` — the audit-workflow findings ledgers

A structured, repeatedly-re-run audit trail (26+ passes as of 2026-07-24). Contents:

- **`audit.md`** — the master runbook and pass-history index — read this first before any new audit pass.
- **`bugs.md`** — the correctness bug-hunt ledger; each finding has file:line, root cause, fix, and the test added to prove it.
- **`secure.md`** — the security-audit ledger; most recent passes report zero new confirmed findings, with explicit "considered and refuted" reasoning.
- **`deps.md`** — dependency CVE/license/abandonment tracking; documents real findings AND at least one caught **fabricated** CVE claim from an AI research pass.
- **`a11y.md`** — WCAG AA accessibility audit findings, tracked incrementally.
- **`minimap.md`** — a lower-level, more granular codebase subsystem map (gitignored, local-only) — a predecessor/companion to this file's own minimap sections, worth cross-referencing for deeper subsystem detail and the full seeding-hang investigation history (§6 summarizes it, `minimap.md` has the full evidence trail).
- **`ponytail-debt.md`** — over-engineering/complexity-only audit findings.
- **`ui-slop.md`** — a generic-AI-SaaS-template "anti-slop" checklist audit; latest passes report 0/8 template tells found.
- **`idea-pressure-test.md`** — a YC-style business-idea pressure test: verdict "weak, not pivot-required" — the core value proposition is still empirically unproven, and the fastest path to proving it is itself blocked on the CR/legal process.

### `docs/counsel-docs/`

Legal/compliance PDFs prepared for or by KSA privacy counsel (SCC, SDAIA risk assessment, breach-notification runbook, DPA template, NPHIES ToU risk analysis, etc.) plus an `official-sources/` subfolder of underlying primary regulatory documents. The paper trail for the real-PHI compliance blockers. Also directly under `docs/`: `counsel-scoping-checklist.pdf` / `-ar.pdf`.

### `docs/screenshots/`, `docs/superpowers/`, `docs/test-fixtures/`

`screenshots/` — mostly-empty placeholder for manual-test evidence. `superpowers/` — historical build-planning artifacts from an earlier planning skill, not living documentation. `test-fixtures/` — real fixture files used by ingest/EOB-extraction tests (CSV samples, synthetic EOB PDFs with ground-truth extractions, synthetic FHIR edge-case bundles).

---

## 6. Current state — the 2026-07-24 production-hardening pass

The app was deployed to production for the first time this same day (Vercel + Neon Postgres,
`https://taweed.vercel.app` — synthetic data only). Immediately after, an explicit user-scoped
hardening pass covered 5 items (real auth and the business blockers were deliberately out of
scope for this pass):

1. **Caching** — `apps/web/lib/data.ts`'s 5 analytics bundle functions (`getMoneyScope`,
   `getAnalytics`, `getRecovery`, `getAuditReportData`, `getOwnerReportData`) are now wrapped in
   `unstable_cache`, tenant-scoped by key and tag (`apps/web/lib/cache-tags.ts`), invalidated via
   `revalidateTag` from every write path that changes claims/denials/appeals/baseline data. A
   cross-tenant cache-leak test is written to actually fail if tenant-scoping ever regresses.
2. **Async background jobs** — PDF/EOB extraction (`apps/web/lib/actions/eob-extract.ts`) now
   returns fast (inserts a `processing` row) and runs the heavy PDF-parse + AI-extraction work via
   `next/server`'s `after()`, with a 10-minute stale-row reaper guarding against a killed process
   leaving a row stuck forever.
3. **Load testing** — `scripts/load-test.ts` (autocannon) actually run against the live production
   URL: zero errors/timeouts across 3 scenarios, real numbers in `docs/load-test-report.md`.
4. **Seeding reliability root-cause** — a reported "hangs 5/5 times against Neon" bug was
   investigated via two real, live-monitored (`pg_stat_activity` polled throughout) reproduction
   attempts against the actual production DB, with a full backup-and-restore-verified safety net
   first. **Honest result: the hang did not reproduce under current conditions.**
   `packages/db/src/client.ts`'s `getPool()` now sets TCP `keepAlive` as cheap defensive hardening
   against the leading theoretical cause — explicitly documented as NOT a confirmed fix, since
   there was no reproducible failure left to root-cause. See `docs/audit docs/minimap.md` for the
   full evidence trail if this ever recurs.
5. **`seed-prod.ts` proof** — actually run successfully end-to-end against the real hosted Neon DB
   (the same run that investigated item 4), exact parity confirmed: `tenants=2 claims=1196
   denials=520 appeals=416 rules=30 users=10`.

**Found and fixed along the way (not one of the 5 named items):** `TAWEED_APP_PASSWORD` in Vercel
was a "Sensitive"-flagged env var that read back as an empty string via CLI pull — a genuine CLI
limitation, not a real outage (the live app was working fine on the real value). Rotated to a new
known value and redeployed. Also caught a moderate CVE (`uuid` buffer-bounds-check) introduced
transitively by the new `autocannon` devDependency, fixed via a `pnpm-workspace.yaml` override.

**Validated via 3 parallel Phase 4 reviewers** (architecture/correctness, security, code quality)
over the full diff — 2 real findings, both fixed before merge: a missing cache-invalidation call
in the onboarding completion action (a 5th write path the original spec didn't name, caught by
independent call-site tracing rather than checking the spec's own list), and an unsafe type cast
in the caching helper. See `docs/audit docs/audit.md` pass #27 for the complete verdict trail.

**Gates green throughout:** typecheck (root + web), lint, unit **1125/1125**, integration 43/43,
a real `apps/web` production build — all re-verified after every fix, not just once at the start.

**A discipline worth noting for whoever reads this next:** item 4 above could have been declared
"fixed" the moment the defensive `keepAlive` change landed. It wasn't — two real reproduction
attempts were run specifically to get evidence either way, and when the hang didn't recur, that
honest non-result is what got recorded (in the code comment, in `minimap.md`, and in `audit.md`),
not an inflated "root-caused and fixed" claim. If this hang ever comes back, treat it as a fresh
investigation — the current `keepAlive` line is not proven to be why it would or wouldn't recur.
