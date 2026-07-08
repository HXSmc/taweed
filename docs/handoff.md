# Handoff — start here (next session)

> Entry point for a new Claude Code session picking up Taweed. Read this, then run the
> next-step prompt (`docs/NEXT_STEP_PROMPT.md`). Blocker register + a per-blocker unblock prompt:
> `docs/blocker.md`. Written 2026-07-04; last refreshed 2026-07-06 (**AI-0 + AI-1 + the harden loop
> merged to `origin/main` (`2d0e1bb`); PROMPT 2 = AI-2 appeal assist + AI-3 rule authoring now BUILT
> and merged too** — both additive, PHI-free-build, fail-closed. Next = PROMPT 3 of
> `docs/04_agentic_retrofit_plan.md` §9 = AI-4 vision extraction. The EXECUTE UI tail A2/A3 + the
> real-data headline (BLK-1/2/9) remain independently pending).

## Where the project stands

- **CREATE + IMPLEMENT phases are DONE on synthetic/placeholder data** and merged to `origin/main` (github.com:HXSmc/taweed), merge `44e0e13` (2026-07-05). *(The `02` §2 / §8-wk3 CREATE-exit items that need real data — parsing one real de-identified NPHIES `ClaimResponse` to DB, and a KSA-RCM-SME-reviewed denial-reason taxonomy — remain deferred/blocked: `BLK-1` partner data, `BLK-2` real codes, `BLK-9` SME sign-off. "CREATE ✅" below means the synthetic spine, not the real-data exit gate.)*
- Full working product **on synthetic data**: 5 MVP modules + a bilingual EN/AR RTL multi-tenant Next.js 15 app. **143 unit + 11 integration** tests green; `pnpm build` green; multi-agent review (security/healthcare/TS) run and fixes landed.
- **EXECUTE buildable pass — DONE (synthetic data), merged to `main`.** The engineering readiness real-partner data needs, built + verified without a rewrite:
  - **B5** real-column scrubber mapping + a **production-tag gate** (`claims.data_origin`) so the synthetic hash projection can never touch real PHI (the hard PHI gate); a null real signal drives `unevaluable`, never a false pass.
  - **B6** `@taweed/ingest` — RFC-4180 CSV/TSV parser, field-mapping with confidence + override, per-tenant dimension resolution (XLSX + PDF-OCR are typed adapter stubs).
  - **B7** payer/tenant-scoped rule selection + version resolution, per-payer golden set, recovered-outcome feedback loop.
  - **B8** recovery integrity — `resolveRecovery` (recovered never exceeds appealed / never negative, §8.5), onboarding `recovery_baselines`.
  - **C** `@taweed/platform` typed swaps (ObjectStore/TenantKms/KSA-OIDC) + `infra/` Terraform skeleton (`me-riyadh-1`, not applied).
  - **A1** Playwright E2E + a11y + CI `e2e` job (CI-wired; browsers not local, first green expected in CI).
  - **A4** marketing landing (number-as-hero, EN + AR/RTL, chrome-devtools-verified) + an app-wide `cn()`/tailwind-merge fix (hero/stat numbers were rendering at 14px).
  - Verified: **206 unit tests green**, root+web typecheck green, `next build` green. Multi-lens review (healthcare + security + typescript) run on the diff with adversarial verification; findings fixed — a NUL byte that made `recovery.ts` binary-to-git, the `data_origin` gate now **fails closed** (default `production`; synthetic projection runs only on an explicit `synthetic` tag), diagnosis-code mapping in the normalizer (so `hasDiagnosis` reflects real data), a negative-ceiling floor in `resolveRecovery`, CSV blank-line/duplicate-header handling.
- **AI phase — AI-0 + AI-1 DONE (synthetic/PHI-free), merged to `main`.** The selective LLM layer on the deterministic core (`docs/04_agentic_retrofit_plan.md`), additive and fail-closed:
  - **AI-0** `@taweed/ai` — the ONLY package that talks to an LLM. `LlmProvider` typed swap (`anthropic-1p` via `@anthropic-ai/sdk` — `messages.parse` + `zodOutputFormat`, models `claude-opus-4-8`/`claude-sonnet-5`/`claude-haiku-4-5`; `FixtureProvider` for CI). Three-layer kill switch (`TAWEED_AI_ENABLED` default OFF + per-feature env + per-tenant DB flag) → typed `AiDisabledError` → deterministic fallback. Audited runner writes an `llm_calls` row on **every** attempt (success, parse-failure, and provider exception) — **hashes only**, never raw prompt/output/PHI (extends the audit PHI-leak guard). Pure `pseudonymize` (structured-column tokenize/detokenize, DOB→age band, free-text excluded) + `postprocess-ar` (Arabic-Indic→Western digit law, tashkeel strip, bidi-control strip + LRM code isolation). evalite-style eval project (`AI_EVALS_LIVE=1` only, never CI). The **raw provider client is never exported** — a call can't skip the audit.
  - **AI-1** `explainFlag` (Haiku) — bilingual plain-language explanation of a scrub flag. Input is **PHI-free by construction** (`ExplainableFlag`: rule metadata + generic messages, runtime guard rejects any extra key); output is a zod `FlagExplanation` (both locales, one call). Deduped per (tenant, rule, version) in `flag_explanations`. Additive UI popover on the scrubber flag rows (EN/AR RTL × light/dark, a11y region + aria-expanded, reduced-motion, digit law); deterministic messages always shown, graceful "unavailable" when AI off. Server action re-derives the prompt from `SCRUBBER_RULES` (no client text into the LLM).
  - Verified: **266 unit + 6 integration green** (fixture/stub provider only — CI never calls the live API), root+web typecheck green, `next build` green, coverage 92% (`@taweed/ai`). chrome-devtools verified EN+AR RTL × light/dark on the scrubber explainer (cached path, no key). Multi-lens review (typescript + security + healthcare) run on the diff with adversarial verification; findings fixed — a pool-exhaustion DoS (LLM call no longer wrapped in a held DB transaction; short transactions + 30s client timeout), raw NUL bytes in `pseudonymize.ts` (rewritten as text), audit-on-provider-exception, SFDA prompt hardening (billing-only + anti-upcoding), digit-law on all fields, dedupe-race convergence, bounded output.
- **AI phase — AI-2 + AI-3 DONE (synthetic/PHI-free), merged to `main` 2026-07-06 (PROMPT 2).** AI-3
  `authorRule` (Opus): SME EN/AR sentence → structured `ScrubRule` DRAFT → the `@taweed/rules-engine`
  `validateAuthoredRule` gate (shape vs registry → engine dry-run → golden regression) → persist
  DISABLED (`rules.status`, migration `0007`) → human approve (rcm/owner/admin, server-enforced) →
  feeds the live scrubber. AI-2 `assistAppeal` (Opus + Sonnet judge): additive `suggestedParagraphs`;
  structural anti-hallucination (digit-free slot tokens → any literal digit = invented → suppress),
  pseudonymized member id, verify pass, detokenize-last, SME edit-distance metric (`appeal_suggestions`).
  Verified: unit 340/340 + integration 33/33 green, typecheck + lint (0 errors) + build green, migration
  0007 applies clean; multi-lens adversarial review run pre-merge (all 9 confirmed findings fixed).
- **Two post-merge hotfixes on `main`, both CI-GREEN (2026-07-06):**
  - `3acc285` — CI E2E blocker: `@taweed/shared`'s `newId` imported `randomUUID` from `node:crypto`;
    PROMPT 2's `appeals-composer.tsx` (client component) pulled in `levenshtein` from the same
    barrel, dragging `node:crypto` into the browser bundle and failing Next's webpack build. Fixed
    by making `newId` Web-Crypto-global (isomorphic).
  - `9813fc6` — 7 audit findings hardened: **HIGH** — engine `in`/`notIn` substring-matched on
    string constants (`"female".indexOf("male")` false-fired); now strict array membership. Golden
    corpus expanded 2→13 cases. `rules.status` made the single source of rule liveness + migration
    `0008` backfill. AI-3 approval UI stopped swallowing failures, added aria-live. AI-2
    `inference_geo` pinned. PHI-free-by-policy wording made honest. Unit 355/355, int 33/33 green,
    multi-lens review pre-commit.
- **Next up:** **PROMPT 3 of `docs/04_agentic_retrofit_plan.md` §9** — AI-4 vision EOB/PDF extraction +
  ground-truth eval (dual-gated: build on synthetic docs now, production route = counsel + hosting).
  Independently pending: EXECUTE UI tail (**A2 first-run corridor**, **A3 free-audit + owner report**)
  on synthetic data, then the **real-data headline** when BLK-1/2/9 clear. Paste-ready: `docs/NEXT_STEP_PROMPT.md`.
- Roadmap: CREATE ✅ → IMPLEMENT ✅ → **EXECUTE (buildable pass ✅ · headline pending real data)** → **AI phase (AI-0 ✅ · AI-1 ✅ · AI-2 ✅ · AI-3 ✅ · AI-4 pending)** → DEPLOY.

## Can you start now?

**The buildable half of EXECUTE — yes, now, on synthetic data** (finish the IMPLEMENT DoD tail: E2E/a11y/Lighthouse in CI, first-run corridor, free-audit report, landing; plus real-data scaffolding B5–B8 and typed DEPLOY swaps). **The headline** (recovered-SAR on a real clinic) is human-gated — see `docs/blocker.md` (needs B1 design-partner data + B2 real codes + B9 SME sign-off).

Soft caveats:

- Run `pnpm install` first (`node_modules` not committed).
- **Local-only (gitignored), on the owner's device, NOT in a fresh clone:** `design/` (UI source assets), `docs/NEXT_STEP_PROMPT.md`, `docs/blocker.md`, `docs/STEP_SUMMARY.md`, `docs/superpowers/`, `docs/screenshots/`, and root `ECC_GUIDE.md`. Start on the owner's machine, or copy them over.
- Fonts to source for the UI: **Cabinet Grotesk** (Fontshare, not Google Fonts), **Geist** (Vercel), **IBM Plex Sans Arabic** (Google). See `docs/03_design_brief.md` §4.3.
- Everything NPHIES-real (codes, IG validation, PKI, KSA-resident OIDC, KSA-region hosting) stays **stubbed/deferred** — a typed swap, tagged `TODO(nphies-creds)` / `TODO(ksa-oidc)`. Not a blocker; that's the design.

## How to run (this repo)

Environment quirks (macOS, fish shell):

- **pnpm** is at `~/.local/bin/pnpm` (not global; corepack was blocked). Prefix PATH per command:
  `set -x PATH $HOME/.local/bin $PATH`.
- **RTK hook** compresses test/tsc/eslint stdout to a useless summary but runs the real command
  and preserves exit codes. Workaround: write results to a file and read it —
  `vitest run --reporter=json --outputFile <path>` then parse; `tsc ... 2><file>`.
- Env vars don't always reach RTK's re-exec'd child — use an `env VAR=val <cmd>` prefix.
- Node is **v20.2.0** (below Next 16's floor) → `apps/web` pins **Next 15**. `rm -rf apps/web/.next` if disk fills.

Commands:

```bash
cd "$HOME/Desktop/web apps/taweed"
~/.local/bin/pnpm install
~/.local/bin/pnpm typecheck        # tsc --noEmit
~/.local/bin/pnpm lint             # eslint
~/.local/bin/pnpm test             # unit (vitest --project unit)
~/.local/bin/pnpm build            # full build (must stay green)
docker compose up -d               # local Postgres (postgres:16, creds taweed/taweed)
env DATABASE_URL=postgres://taweed:taweed@localhost:5432/taweed ~/.local/bin/pnpm --filter @taweed/web seed
env DATABASE_URL=postgres://taweed:taweed@localhost:5432/taweed ~/.local/bin/pnpm test:int
docker compose down
```

> Integration tests run single-fork and **destructively migrate** the shared Postgres — re-seed after.

## Repo map (what exists — all built unless noted)

- `packages/shared` — canonical row types + placeholder `DENIAL_REASON_CODES` (8 fake `TWD-*`, `TODO(nphies-creds)`; replaced by B2).
- `packages/fhir` — R4 parse + base-R4 validate (`@medplum/fhirtypes` for types only); `validateAgainstNphiesProfile()` is a creds-gated stub (real IG validation = B6).
- `packages/normalizer` — FHIR pair → canonical rows, denials exploded.
- `packages/db` — **Drizzle** schema + migrations **through `0006`**, **RLS (FORCE + non-superuser `taweed_app` role)**, `withSession` → `withTenant` (auth-derived tenant), `insertNormalizedClaim`. **EXECUTE:** `0004` adds `claims.data_origin` (CHECK synthetic|production) + nullable real signal columns; `0005` adds `recovery_baselines`. **AI-0:** `0006` adds `llm_calls` (append-only LLM audit, hashes only), `flag_explanations` (AI-1 dedupe cache), `tenant_ai_settings` (per-tenant AI kill switch) — all RLS ENABLE+FORCE + tenant_isolation policy. *(The custom migrate runner applies all `drizzle/*.sql` sorted; 0006 verified against local Postgres this pass.)*
- `packages/audit` — **BUILT.** Append-only PHI audit log; tenant from the active RLS GUC; PHI-leak guard. Written on every PHI read/write/export.
- `packages/rules-engine` — **BUILT.** `json-rules-engine` scrubber, **15 rules-as-data**, golden-set harness; `ScrubResult` traces every flag to a named rule + the failed field. **EXECUTE:** `project.ts` (`projectClaimFacts` real/synthetic split + the B5 production guard; `ClaimFacts` real signals widened to `| null`); `select.ts` (`selectRulesForClaim` — payer/tenant scope + version resolution, B7); the 3 payer rules carry explicit `payerId` metadata.
- `packages/appeals` — **BUILT.** Deterministic **bilingual EN/AR** appeal letters, document checklist, human-in-the-loop, **never auto-submits**.
- `packages/analytics` — **BUILT.** Rollups over canonical rows: denial rate, at-risk / recovered SAR, Pareto, trend. **EXECUTE:** `resolveRecovery` (recovered-exceeds-appealed guardrail, §8.5), `captureBaseline`/`getLatestBaseline` (onboarding baseline), `recoverability`/`recoverabilityByPayerReason` (recovered-outcome feedback loop, B7/B8).
- `packages/ingest` — **BUILT (EXECUTE B6).** Real-data intake: `parseDelimited` (dependency-free RFC-4180 CSV/TSV), `detectFieldMapping`/`applyMappingOverrides` (column→field with confidence + override), `resolveDimension(s)` (per-tenant find-or-create from partner data). `parseXlsx`/`ocrEob` are typed adapter stubs (inject SheetJS + Tesseract at DEPLOY).
- `packages/ai` — **BUILT (AI-0/AI-1).** The only package that talks to an LLM. `provider.ts` (`LlmProvider`/`LlmClient` narrow swap surface), `anthropic-1p.ts` (`@anthropic-ai/sdk` `messages.parse` + `zodOutputFormat`, no thinking/effort on Haiku, 30s timeout, extracted+tested response mapping), `fixture.ts` (record/replay for CI), `run.ts` (audited runner — 3-layer kill switch, short transactions around the network call, audit on every attempt incl. failures), `audit.ts` (`writeLlmCall` hashes-only + PHI-leak guard), `pseudonymize.ts` + `postprocess-ar.ts` (pure, 100% covered), `config.ts`/`errors.ts` (kill switches + `AiDisabledError`), `schemas/flagExplanation.ts`, `features/explainFlag.ts` (AI-1). `evals/` (live smoke eval, `AI_EVALS_LIVE=1` only). Exports feature fns + gates + pure helpers ONLY — never the provider client or the runner.
- `packages/platform` — **BUILT (EXECUTE C, typed swaps).** `ObjectStore` + `InMemoryObjectStore` (per-tenant keyed) + `S3ObjectStoreConfig` (`me-riyadh-1`, SSE); `TenantKms` + `DevPassthroughKms` (dev stub, NOT real crypto, cross-tenant decrypt refused); `ksaOidcConfigFromEnv` + `KsaOidcConfig` (BLK-7 swap, fails closed). Dev impls now; real KSA-region clients at DEPLOY.
- `infra/` — **BUILT (EXECUTE C, skeleton).** Terraform pinned to Oracle Cloud Riyadh `me-riyadh-1` (Postgres + S3-compatible store + per-tenant KMS), resources commented until BLK-8 creds; NOT applied. `*.tfstate*`/`*.tfvars`/`*.pem`/`*.key` gitignored.
- `apps/web` — **BUILT.** Next 15 App Router. Design tokens (`globals.css`) → Tailwind + hand-built shadcn/Radix primitives → EN/AR RTL (`next-intl`, logical properties, `dir` on `<html>`) → light/dark → Auth.js **dev credentials** (gated dev-only; `TODO(ksa-oidc)` swap = B7) → app-level RBAC (owner/finance/rcm/clinician/admin), **server-enforced** in server actions → three-zone shell + persistent dual money indicator with count-up. Five module surfaces: Ingest, Denial Analytics, Scrubber, Appeal Generator, Recovery.
  - Seams: `apps/web/lib/{db,auth,session,rbac,authz,audit,data,appeals-data}.ts`, `lib/actions/*` (server actions), `components/{ui,shell,charts,money,modules}`, `i18n/*`, `messages/{en,ar}.json`.
- `test/synthetic-fhir` — deterministic R4 bundle generator (9 scenarios).
- CI: `.github/workflows/ci.yml` (lint + typecheck + unit + integration w/ Postgres service + **`e2e` job** — Playwright + a11y against a seeded Postgres, EXECUTE A1).
- `apps/web` **EXECUTE additions:** marketing landing at `/[locale]` for logged-out visitors (`components/marketing/landing.tsx`, A4); `playwright.config.ts` + `tests/e2e/*` (smoke/a11y/money-arc, A1); `lib/data.ts` uses `projectClaimFacts` + `selectRulesForClaim`; `lib/actions/recovery.ts` uses `resolveRecovery`; `lib/utils.ts` `cn()` teaches tailwind-merge the custom fontSize scale (app-wide hero-size fix). **AI-1 additions:** `lib/actions/explain-flag.ts` (server action → `@taweed/ai` `explainFlag`, re-derives prompt from `SCRUBBER_RULES`, RBAC-gated, catches `AiDisabledError` → deterministic); `components/modules/flag-explainer.tsx` (additive bilingual popover); `lib/data.ts` `ScrubRow` carries `ruleVersions`; `@taweed/ai` added to deps + `transpilePackages`; EN/AR scrubber i18n keys. **Not yet built (next pass): A2 first-run corridor, A3 free-audit + owner report, B6 field-mapping panel wired into the Ingest UI; AI-2/AI-3/AI-4.**

## Must-read before building

- `docs/NEXT_STEP_PROMPT.md` — the **EXECUTE** prompt (local only).
- `docs/blocker.md` — blocker register + a paste-ready unblock prompt per blocker (local only).
- `docs/02_product_build_plan.md` §2/§7/§8 · `docs/03_design_brief.md` (UI system) · `ECC_GUIDE.md` (tooling, at repo root, local only).
- `docs/superpowers/CREATE_review_followups.md` — **now CLOSED** in migration `0003` (auth-derived `tenant_id`, composite same-tenant FKs, money precision). Kept for history (local only).

## Key decisions locked (CREATE + IMPLEMENT)

CREATE:
- ORM = **Drizzle** (chosen over Prisma for first-class RLS / session-var support).
- FHIR types = `@medplum/fhirtypes`; validation is **base R4 only, hand-rolled** (NPHIES profile validation is a creds-gated stub).
- RLS proven via a **non-superuser `taweed_app` role** (superusers bypass RLS); migrations run as superuser.
- No build step for tests: `moduleResolution: Bundler` + workspace `exports` → `src/index.ts`.

IMPLEMENT:
- **`tenant_id` is auth-derived** — from the verified session via `withSession` → `withTenant`, never client input.
- Migration `0003`: **composite same-tenant FKs** (a cross-tenant id can't attach — closes the FK-bypasses-RLS hole), money/plausibility CHECKs, missing-required-amount → **ingest quarantine** (not `0.00`).
- **RBAC is server-enforced** in the server actions (`lib/authz.ts`), not just UI-gated.
- Auth = Auth.js dev credentials, gated non-prod by `TAWEED_ENABLE_DEV_AUTH`; real KSA-OIDC is a typed swap `TODO(ksa-oidc)`.
- Charts: **pass HEX to Recharts** (CSS `var()` doesn't resolve in SVG attrs); no `/opacity` modifier on var-colors (renders transparent).
- **Arabic wordmark تعويض is Latin-isolated on every AR surface until an RCM SME signs off** (design-brief §11; blocker `BLK-9`). Design-brief non-negotiables (§13 anti-slop, §4.3 digit law, one cobalt accent `#2557E4`, money-semantics colors, hairlines-over-cards, WCAG AA, reduced-motion) apply to all new UI.
- Scrubber's `ClaimFacts` projection is now **real-column mapped + gated (EXECUTE B5, done)**: `apps/web/lib/data.ts` calls `projectClaimFacts` (`@taweed/rules-engine`), which routes a `data_origin='synthetic'` claim to the demo hash projection and everything else (production/untagged) to the real-column projection; the synthetic projection hard-fails on a non-`synthetic` tag. Real partner PHI (BLK-1) tags `production` at ingest → real columns → a null signal is `unevaluable`, never fabricated.

## Git workflow & safety

- **The app lives on `main` in this dir** (`~/Desktop/web apps/taweed`). IMPLEMENT was built in a worktree (`worktree-create-data-pipeline`, merged to `44e0e13` + deleted). The **EXECUTE buildable pass** was built on branch `execute-phase` (in-place, given the local-only gitignored docs live in this dir) and **merged to `main`**; `back-up` was left at the pre-EXECUTE tip `44e0e13` as the restore point.
- **Backup-branch rule — `back-up` is the pre-advance `main` tip (restore point).** Before any push that advances `main`, snapshot the current (soon-to-be-previous) `main` tip onto `back-up`. After the EXECUTE merge, `back-up` = `44e0e13` (the pre-EXECUTE `main`); `main` carries EXECUTE.

  ```bash
  git branch -f back-up main        # snapshot the current main tip (the 'old' commit)
  git push -f origin back-up         # mirror the backup to origin
  # ...now commit/merge the new work onto main...
  git push origin main               # main advances; back-up stays one commit behind
  # restore if a push goes bad:
  git reset --hard back-up           # (or inspect first: git checkout back-up)
  ```

- **Isolated feature work** (e.g. EXECUTE): create a fresh worktree + branch (`superpowers:using-git-worktrees`), build, merge to `main`, then delete the worktree + branch. NOTE: gitignored local docs (`docs/NEXT_STEP_PROMPT.md`, `docs/blocker.md`, `design/`, …) do **not** sync between a worktree and `main` — edit them directly in whichever dir you read from.
