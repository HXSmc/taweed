# AI Deploy-Readiness Ledger — durable memory for the harden-to-deploy loop

> Loop: `docs/AI_HARDEN_LOOP.md`. Adapted mode (2026-07-05): AI-0/AI-1 already merged to
> `origin/main` (`8425801`), so hardening runs on a fresh **fix-branch `ai-harden`** off main; the
> whole-product deploy-readiness sweep + latent-defect fixes land here and PR into main (human-gated).
> This file is the loop's memory — every termination decision reads THIS file, not recollection.

## Anchors (set at iteration 0, immutable)

- `START_MAIN` = `842580177636c75718989bc3479bf5bf20719468` (origin/main tip when the loop began)
- `START_HEAD` = `842580177636c75718989bc3479bf5bf20719468` (ai-harden branch point)
- Branch: `ai-harden` (off `main`), terminal action = PR into `main`, human merges.

## Counters (loop memory)

- `iteration_counter` = 2
- `change_iteration_counter` = 2 _(only iterations that changed product source count toward the cap of 12)_
- `consecutive_clean_passes` = 0 _(need 2 to STOP DEPLOY-READY; reset — iteration 2 changed product source)_
- `last_clean_head_sha` = _(empty)_

## ⚠ OPEN ESCALATION — money-path semantics (HUMAN decision required, NOT patched)

`analytics/queries.ts:207,216` — `moneyScope` at-risk = `LEFT JOIN appeals a ON a.denial_id=d.id AND a.status='won' WHERE a.id IS NULL`, summing the **full** `denied_amount` of denials with no won appeal; `recovered_sar` sums the actual (possibly partial) `recovered_amount`. **On a PARTIAL win** (denied 100, recovered 60) the denial is fully excluded from at-risk (a won appeal exists) yet only 60 counts as recovered → the unrecovered **40 lands in NEITHER** at-risk nor recovered. Contradicts the docstring's stated intent ("atRiskSar = denied amount NOT yet recovered"). Filed CRITICAL by the money-path finder (opus); its adversarial verifiers **died on the session limit** → UNVERIFIED-by-sweep but confirmed by my own read.

- **Per the loop the money path is the moat — NOT patched.** Semantics question only a human with RCM/product knowledge can settle: **is the partial-win remainder still "at-risk" (→ real bug, understates the headline) or a resolved write-off (→ by-design)?**
- Repro: seed a denial with a `won` appeal whose `recovered_amount < denied_amount`; check `atRiskSar + recoveredSar` vs total denied. If they must reconcile, the at-risk subquery needs to subtract the partial recovery (money-path change → still human-gated).
- **DEPLOY-READY is blocked** on this decision (money-path re-verify DoD cannot tick while open).

## Defect log

_Each entry: `{key, severity, file:line, root_cause, fix, verifying_gate, recur_count}`. `key` = module +
normalized-symptom signature, STABLE across iterations (recurrence countable after file:line drifts).
Cap: any `recur_count` reaching 3 → ESCALATE._

| key                                    | sev      | file:line                                   | root cause                                                                                                                               | fix                                                                                          | gate     | recur |
| -------------------------------------- | -------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------- | ----- |
| db/llm_calls-append-only-privilege     | CRITICAL | packages/db/test/migrate.ts:81              | app role granted UPDATE,DELETE ON ALL TABLES; only `tenants` revoked → llm_calls compliance trail mutable                                | REVOKE UPDATE,DELETE ON llm_calls in ensureAppRole after GRANT; int test asserts denied      | int      | 0     |
| ai/cache-ignores-prompt-sha256         | HIGH     | packages/ai/src/features/explainFlag.ts:137 | cache read keys on (rule,version) only, never compares stored prompt_sha256 → stale SFDA wording served forever                          | compare prompt_sha256 on read; regen + onConflictDoUpdate on mismatch; project explicit cols | unit+int | 0     |
| ai/enabled-unconfigured-no-loud-signal | HIGH     | packages/ai/src/anthropic-1p.ts:81          | enabled-but-no-API-key throws at request-time → audited as explain=error but collapses to same silent "unavailable" as off               | distinct AiConfigError pre-call when enabled+no key; distinct logging in action              | unit     | 0     |
| ai/run-audit-write-unobservable        | HIGH     | packages/ai/src/run.ts:94,98                | success-path audit write unguarded (loses good answer on DB blip); error-path .catch(()=>{}) fully silent → compliance gaps untraced     | log audit-write failures distinctly on both paths (keep fail-closed)                         | unit     | 0     |
| web/explainFlag-no-rate-limit          | MED-HIGH | apps/web/lib/actions/explain-flag.ts:18     | billable Server Action unthrottled; UI-only loading guard bypassable → burst parallel calls each pay                                     | per-actor in-memory rate limit; document per-instance residual                               | unit     | 0     |
| ai/no-server-only-marker               | MEDIUM   | packages/ai/src/*(server modules)           | no `import "server-only"`; one dropped `type` keyword ships SDK+drizzle+secrets to browser; apps/web tsconfig lacks verbatimModuleSyntax | add server-only to anthropic-1p/run/audit/features server modules + dep                      | build    | 0     |
| ai/pseudonymize-coverage-under-100     | MEDIUM   | packages/ai/src/pseudonymize.ts             | pure module at 96.82%L/86.66%B; DoD requires 100% (uncovered: future-DOB→null, birthday-not-reached branch, freeTextAllow null)          | add unit tests for the uncovered branches                                                    | unit-cov | 0     |
| db/audit-created_at-nullable           | LOW      | packages/db/drizzle/0006_llm_calls.sql:30   | llm_calls/flag_explanations created_at nullable → explicit NULL insert leaves timestampless compliance row                               | NOT NULL DEFAULT now() in 0006 + schema.ts .notNull()                                        | int      | 0     |
| i18n/no-loud-missing-message           | LOW      | apps/web/i18n                               | parity clean (197↔197) but no next-intl onError/getMessageFallback → a future missing key renders raw key silently                       | add getMessageFallback that fails loud                                                       | build    | 0     |

**RESOLVED + verified in iteration 1** (gates 1–4 green at HEAD after this commit):
`db/llm_calls-append-only-privilege` (REVOKE in ensureAppRole; int test asserts UPDATE+DELETE denied 42501, SELECT allowed) ·
`ai/cache-ignores-prompt-sha256` (prompt_sha256 compared on read, onConflictDoUpdate overwrites stale; int test proves regeneration + single row + hit-on-unchanged) ·
`ai/enabled-unconfigured-no-loud-signal` (distinct `AiConfigError` + `missingProviderConfig`; unit + int tests) ·
`ai/run-audit-write-unobservable` (both audit-write paths now log distinctly; fail-closed preserved) ·
`ai/no-server-only-marker` (server-only on 4 AI server modules + dep + vitest alias stub; `next build` green confirms no client-chunk leak) ·
`ai/pseudonymize-coverage-under-100` (now 100% L/B/F) ·
`db/audit-created_at-nullable` (NOT NULL in 0006 + schema.ts).
Plus **E2E blocker** (CI red on main): `e2e/money-arc-login-mismatch` — test filled a nonexistent email input; login is a demo-account picker → rewrote to click the owner's button. Root-caused + fixed; **local Playwright verification pending** (browsers not installed — iteration 2 / CI).

**Deferred to a later iteration (documented, NOT yet fixed):**
`web/explainFlag-no-rate-limit` (D8 — needs a package-level or apps/web limiter; apps/web isn't in the unit harness) ·
`i18n/no-loud-missing-message` (D12 — parity is clean; add getMessageFallback) ·
a11y: `flag-explainer` async panel needs `aria-live`; `scrubber-table` `<TR role="button">` strips row semantics (react reviewer HIGH) ·
`web/eslint-ignores-apps-web` (react reviewer CRITICAL — `next lint` lints zero files; wiring it risks a cascade → triage in a dedicated iteration) ·
full-product prior-core latent sweep (rules-engine/appeals/ingest/db-all-tables/audit/platform + money-path RE-VERIFY) ·
chrome-devtools runtime smoke (config states, version-desync, EN/AR RTL × light/dark, WCAG AA, digit law) ·
coverage-overall interpretation (unit-only = 75% pkg-scoped; run combined unit+int coverage for the true number).

**Deferred / documented (NOT fixed — rationale):**

- `ai/sfda-output-validator` (HIGH per healthcare) — output-side SFDA content check is AI-1's _documented_ deferral to AI-2's second-model verify (blocker.md AI-1 review-gate posture; control today = hardened prompt + BLK-9 SME sign-off). Fixing = building AI-2 early → out of loop scope.
- `ai/capabilities-batches-backwards` (MED per security) — real provider `batches:true` vs fixture `false`; INERT (no code reads it, no Batches call exists — guarantee holds). Ambiguous semantic (raw-capability vs policy-gate) → flag for human, do not speculatively flip.
- `web/version-desync-fallback` (`scrubber-table.tsx:134 ?? 1`) — doubly inert (ruleVersions built from same rules set as flags; all versions =1). Landmine only; will make rule-not-found LOUD in the action instead.
- `apps/web/tsconfig verbatimModuleSyntax` — would hard-error a dropped `type` keyword (belt for server-only), but enabling it repo-wide on apps/web risks cascading breakage → recommend at DEPLOY, not this loop.
- `0006 re-runnability` — bare CREATE (no IF NOT EXISTS/down) matches 0001/0005 precedent; test migrator DROPs+reapplies; production forward-only migrator deferred to DEPLOY → **document forward-only + recovery**, no code change (DoD satisfied by documentation).

## Deploy-Ready DoD checklist

_Every item must be ticked with `head_sha == current HEAD` to STOP. On ANY product change in an
iteration, all gate-derived ticks CLEAR (re-earn against the new HEAD). Provenance `{iteration, head_sha}`
recorded next to each tick when earned._

- [x] root `pnpm typecheck` green (root `build` == typecheck, no separate root bundle); web typecheck + `next build` green _(iter1)_
- [ ] root `pnpm lint` + web `next lint` clean; prettier clean on changed files
- [ ] `pnpm test` (unit) green — ALL packages; coverage ≥80% overall; 100% on pseudonymize/postprocess-ar/sha256; payer-golden green; no regression vs main baseline
- [x] `pnpm test:int` green (22/22); migrations 0000–0006 apply from a clean DB; RLS enforced on every table (not just declared); `llm_calls` append-only ENFORCED BY PRIVILEGE (app role denied UPDATE/DELETE); 0006 re-runnable or forward-only+recovery documented _(iter1)_
- [ ] money-path integrity RE-VERIFIED unchanged (`resolveRecovery`: recovered ≤ appealed, never negative; `data_origin` production gate fails closed) — verified, not modified
- [ ] E2E/a11y green (Playwright, whole app) OR chrome-devtools MCP smoke: scrubber flag-explainer AND app shell EN+AR RTL × light/dark, reduced-motion, WCAG AA, zero console errors, digit law honored
- [ ] config states distinguishable: AI-off graceful absence (deterministic messages, no network call) AND AI-on-but-unconfigured fails LOUD (not collapsed into the same "unavailable" as off)
- [x] kill switch fails CLOSED (default OFF → AiDisabledError → deterministic fallback at every caller) _(iter1; existing tests + no regression)_
- [x] audit: `llm_calls` row on every call; HASHES ONLY, no PHI/raw text; PHI-leak guard covers new path _(iter1; + created_at NOT NULL, audit-write failures now observable)_
- [x] cache invalidation: `flag_explanations` regenerates when SYSTEM_PROMPT / rule text changes (keyed/compared on `prompt_sha256`); test proves it _(iter1; int test)_
- [x] explainFlag PHI-free-by-construction (asserted); dedupe by (tenantId, ruleId, ruleVersion), BOTH locales one row (NOT keyed by locale); `claude-haiku-4-5`; SFDA billing-only wording _(iter1; healthcare review holds)_
- [ ] paid endpoint has an abuse/cost control (per-tenant/actor rate limit or spend cap); dedupe documented as storage-level
- [x] `@taweed/ai` server modules marked `server-only` (or client-safe types split); bundle analysis confirms `@anthropic-ai/sdk` / drizzle / `node:crypto` never enter a client chunk _(iter1; `next build` green; verbatimModuleSyntax-on-apps/web belt deferred)_
- [ ] i18n key parity en.json ↔ ar.json for all keys; missing-message behavior fails loud
- [x] FixtureProvider is the only provider in CI (no API key for `pnpm test`); evals gated by `AI_EVALS_LIVE`, never in CI; raw client + runner NOT exported from `packages/ai` _(iter1; verified)_
- [ ] reviewers run with no open HIGH/CRITICAL — on BOTH the AI diff AND a full-product sweep of the prior-phase core (typescript + react + security + healthcare + silent-failure + database + code-reviewer; quality-gate + production-audit + security-scan)
- [ ] no secrets committed; ANTHROPIC key only from env; no Batches call introduced; no money-path touch
- [ ] `git diff main...HEAD` reviewed end-to-end; no debug logs / stray console.* / TODO regressions

## Iteration log

_(terse per-iteration status appended below each pass)_

### iteration 1 — AI compliance/security core + E2E blocker

- **Adapted** the loop to post-merge reality (AI-0/AI-1 already on origin/main `8425801`); hardening on fix-branch `ai-harden`.
- **Swept**: gates 1–4 + a 5-reviewer latent sweep on the AI diff (healthcare, security, database, silent-failure, react). Also pulled CI (main is RED).
- **Found**: 8 AI defects (1 CRITICAL, 3 HIGH, 2 MED-HIGH/MED, 2 LOW) + the CI E2E blocker + several deferred items.
- **Fixed + verified (gates 1–4 GREEN)**: D1 append-only privilege, D2 cache-invalidation, D3 config-loud (AiConfigError), D4 server-only, D6 created_at NOT NULL, D7 audit-write observability, D5 pseudonymize→100%; +5 new int tests, +8 unit tests. Root typecheck ✓, root lint ✓ (2 pre-existing warnings in `.claude/scripts`, non-product), web typecheck+`next build` ✓, unit 274/274 ✓ (pure trio 100%), int 22/22 ✓.
- **E2E blocker root-caused + fixed**: `money-arc.spec.ts` filled a nonexistent email input; login is a demo-account picker → rewrote to click the owner button. **Local Playwright verify pending** (browsers not installed).
- **Deferred to next iterations** (see defect log): D8 rate-limit, D12 i18n-loud, a11y (aria-live + row semantics), lint-infra gap (apps/web unlinted), full-product prior-core latent sweep, chrome-devtools runtime smoke, coverage-overall interpretation, money-path RE-VERIFY.
- **DoD**: 9/18 ticked at this HEAD. **EXIT = CONTINUE** (E2E/runtime/full-sweep/rate-limit/i18n/lint/money-path pending; consecutive_clean_passes=0).
- Docker note: the Docker CLI hangs on daemon metadata queries on this host, but the Postgres container/port work (verified via TCP probe) — integration runs fine; avoid `docker info`/`ps`/`version`/`exec` (they hang), probe port 5432 directly.

### iteration 2 — deferred AI fixes + full-product prior-core sweep

- **Known AI-surface fixes** (verified green): D8 rate-limit (`packages/shared` pure `checkRateLimit` + `apps/web/lib/rate-limit.ts` wrapper, wired into `explainFlagAction`, per-actor 30/60s, +4 unit tests), D12 i18n loud-missing-message (next-intl `onError`+`getMessageFallback`, dev throws / prod ⚠MISSING), a11y `aria-live`+`aria-busy` on the flag-explainer panel.
- **Full-product prior-core sweep** via Workflow (10 finder areas + adversarial verify). **6 confirmed** defects FIXED + tested this iteration (all NON-money-path, all verified):
  - `audit-phi` **CRITICAL** — `audit_logs` (primary PHI trail) was NOT append-only-enforced (same gap as llm_calls) → REVOKE UPDATE,DELETE in ensureAppRole + int test (23/23).
  - `appeals/generate.ts` — prototype-chain read: untrusted `denialCode`/`payerName` = `"toString"`/`"__proto__"` etc. resolved to inherited built-ins → crash instead of GENERIC_TEMPLATE → `ownGet` (hasOwnProperty) + tests.
  - `appeals/templates.ts` — appeal letter/PDF used the internal DB UUID, not the payer-facing `nphiesClaimId` → `{claimRef}` = nphiesClaimId ?? claimId; corrected 2 tests that asserted the buggy behavior + added tests.
  - `ingest/csv.ts` — (a) quote-mode toggled on ANY quote → a stray inch-mark swallowed the rest of the file (field-start guard); (b) `dedupeHeaders` could synth a name colliding with a real column (collision-skip) → + tests.
- **Escalated (NOT patched)**: the money-path `moneyScope` partial-win discrepancy (see the ⚠ OPEN ESCALATION block up top) — awaits a human semantics decision.
- **Unverified findings (sweep verifiers died on the session limit — re-verify next)**: `normalizer/normalize.ts:191` missing denial amount → 0.00 instead of quarantine (money-path-adjacent, filed HIGH); `web/lib/auth.ts:19` DEV_AUTH forceable in prod via env (filed HIGH); `recovery.ts:43` markAppealOutcome no-row-check still logs write+ok (filed MEDIUM, money-path-adjacent). Platform `tenantKey` '/'-collision was REFUTED (tenantId is a slash-free UUID).
- **Deferred (documented)**: drizzle-kit journal stale (0001-0006 not snapshotted → `pnpm db:generate` emits duplicate DDL; MEDIUM dev-tooling); apps/web ESLint gap; chrome-devtools runtime smoke; E2E Playwright local verify; row-semantics a11y.
- Gates this iteration: root+web typecheck/build ✓, lint ✓, unit **284/284** ✓, int **23/23** ✓. **EXIT = CONTINUE** (money-path escalation open; unverified findings + runtime smoke + Playwright + lint-infra pending; consecutive_clean_passes=0).
- Constraint: hit the session limit (resets 8:20pm Asia/Riyadh) — 15 sweep verifier subagents failed; main-agent work unaffected.
