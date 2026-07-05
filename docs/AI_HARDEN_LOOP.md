# AI Harden-to-Deploy Loop — run AFTER PROMPT 1 (AI-0/AI-1)

> Companion to `docs/04_agentic_retrofit_plan.md` §9 (PROMPT 1 built AI-0 + AI-1 on branch
> `ai-phase-0-1`). This is the **hardening loop** that runs after that build lands on the branch and
> before it merges to `main`: it sweeps every error and every _latent_ ("possible") error across the
> whole product, fixes them at the root, and stops only when the branch is genuinely deploy-ready for
> the first-retrofit stage. It never adds features and never autonomously touches the money path.
>
> This doc was adversarially critiqued (4 lenses: completeness / tool-reality / termination /
> repo-facts) and the findings are folded in. Notably: the explainer dedupes by
> `(tenantId, ruleId, ruleVersion)` with **both locales in one row** (NOT by locale); `llm_calls` is
> append-only _by convention only_ today (no DB grant blocks UPDATE/DELETE); the terminal merge is
> **human-gated**, not autonomous.

## HANDOFF — current state (a fresh agent resumes HERE)

> Written mid-run so another agent (or a future you) can take over cleanly. **Read
> `docs/ai-deploy-readiness.md` (the durable ledger) FIRST — it is the loop's memory
> (counters, DoD ticks, defect log, the open escalation).** This block is the fast summary.

**Where we are (2026-07-05):** AI-0/AI-1 already merged to `origin/main` (`8425801`), so the loop was
ADAPTED: hardening runs on a fresh fix-branch **`ai-harden`** off main (NOT the merged `ai-phase-0-1`).
Fixes land on `ai-harden`; at DEPLOY-READY a human reviews + merges the PR into main. `ai-harden` is
**local only — NOT pushed** (that's why CI on `main` still shows the pre-fix red).

**Committed on `ai-harden` (2 commits; iteration 3 in progress, uncommitted working tree):**

- **iter1 `99ff12d`** — AI compliance core: `llm_calls` append-only-by-privilege (REVOKE), cache
  invalidation on `prompt_sha256`, distinct `AiConfigError`, `server-only` markers (+ vitest alias
  `test/stubs/server-only.js`), audit-write observability, `created_at NOT NULL`, pseudonymize→100%;
  fixed the standing **CI E2E** blocker (money-arc filled a nonexistent email input — dev login is a
  demo-account PICKER; now clicks the owner button).
- **iter2 `cdb7021`** — deferred AI fixes (rate-limit on `explainFlagAction`, i18n loud-missing-message,
  a11y `aria-live`) + a 10-area full-product prior-core sweep (Workflow + adversarial verify). Fixed 6
  confirmed non-money-path defects: **`audit_logs` append-only** (CRITICAL, was mutable — same gap as
  llm_calls), appeals prototype-safe template lookup, appeals uses payer-facing `nphiesClaimId` not the
  internal UUID, CSV stray-quote + header-collision data-loss.
- **iter3 (uncommitted)** — verified the 3 session-limited findings: `recovery.ts` markAppealOutcome
  no-row-check → **FIXED** (guard on a missing appeal; no money-math change); `auth.ts` dev-auth-in-prod
  → **by-design** (documented env escape hatch, AUTH_SECRET fails closed in prod); normalizer
  `0.00`-vs-quarantine → **latent** (synthetic data always sets the amount) → documented for BLK-1.

**⚠ OPEN — DO NOT auto-fix (money path = moat, human-gated):** `analytics/queries.ts:207,216`
`moneyScope` excludes a PARTIALLY-won denial from at-risk entirely while counting only the partial
recovered — the unrecovered remainder falls into neither figure (contradicts the docstring intent).
**A human must decide** whether that remainder is still "at-risk" (bug) or a resolved write-off
(by-design). **DEPLOY-READY is blocked on this.** If the human says "bug, fix it", the at-risk subquery
must subtract the partial recovery — still a human-approved money-path edit.

**Still PENDING (next iterations, none money-path-gated except the above):**

1. Push `ai-harden` (or a human merges) so CI verifies — CI on main is red only because the fix is unpushed.
2. Local Playwright E2E verify of the money-arc fix (a run was in flight at handoff: seed + `playwright
install chromium` + `next build` + `test:e2e` money-arc; browsers were not previously installed).
3. `apps/web` ESLint gap (react reviewer CRITICAL): `eslint.config.mjs` ignores `apps/web/**` → `next
lint` lints ZERO files. Wiring eslint-config-next may cascade — triage in a dedicated iteration.
4. chrome-devtools runtime smoke (gate 6): 3 config states distinguishable, EN/AR RTL × light/dark,
   reduced-motion, WCAG AA, digit law, version-desync.
5. a11y row-semantics: `scrubber-table.tsx` `<TR role="button">` strips table row semantics.
6. drizzle-kit stale journal (MEDIUM dev-tooling): `db:generate` emits duplicate DDL — regenerate the
   snapshot or drop the script; the live migration path is the hand-written SQL, unaffected.
7. Give the recovery.ts fix a test (needs an apps/web test harness — tied to item 3).

**Toolchain gotchas (also in the ledger + [[toolchain-quirks]] memory):** pnpm at `~/.local/bin`; fish
shell (`env VAR=val` prefix); RTK compresses tsc/vitest/eslint stdout → write to a file + read it;
`--project unit` / `--project integration`; Docker CLI HANGS on daemon metadata (`info`/`ps`/`version`/
`compose exec`) — bring Postgres up with `docker compose up -d`, then probe port 5432 via a Node `net`
socket (never `docker info`); `server-only` throws in vitest → aliased to a no-op stub; session limits
can kill parallel subagents mid-workflow (re-verify after reset).

**To resume:** read the ledger → run gates 1–7 for the current HEAD → work the PENDING list one
iteration per turn → update the ledger every iteration → STOP at DEPLOY-READY (2 consecutive zero-change
clean passes, all DoD fresh) or ESCALATE (per SAFETY CAPS). The money-path item above is the one hard
gate on DEPLOY-READY until the human decides.

## When to run

- After PROMPT 1 has committed AI-0 + AI-1 on `ai-phase-0-1` (currently **N commits ahead of `main`,
  not yet merged** — check live with `git rev-list --count main..HEAD`; it grows as the loop commits
  fixes). This loop is the gate before the merge/push ritual.
- **Two-tier scope.** "Deploy-ready" is a _product-level_ bar, so the loop audits the WHOLE product,
  not just the new layer:
  - **Primary (deepest scrutiny) — the AI-0/AI-1 diff** (`git diff main...HEAD`) and anything it
    touches: `packages/ai/**`, migration `0006_llm_calls.sql`, the scrubber flag-explainer UI.
  - **Full-product regression + latent-defect sweep — everything already on `main`** from the prior
    phases (CREATE / IMPLEMENT / EXECUTE): `packages/{rules-engine, appeals, ingest, db, audit,
platform, shared}`, the whole `apps/web` app, `test/synthetic-fhir`, `scripts/`, `infra/`. Prior
    versions do not get a pass just because they predate this branch — a real error anywhere blocks
    deployment.
- It will _not_ start AI-2/AI-3/AI-4 (those are PROMPT 2/3) and does **not** rewrite or speculatively
  "improve" the deterministic core — it only _fixes genuine defects_, and any change to the money path
  is escalated to a human, never made autonomously (see SAFETY CAPS).

## How to invoke (two modes)

- **Self-paced loop (recommended):** paste the fenced block below into `/loop` with **no interval** —
  `/loop <paste the block>`. Self-paced means _the model decides when to continue_: each iteration
  does one full sweep + fixes, updates the durable ledger, then — if the CONTINUE condition holds —
  schedules the next iteration; when DEPLOY-READY or ESCALATE it prints the report and ends the turn
  **without** scheduling (loop stops).
- **Direct paste:** paste the block into a fresh session at the repo root. It self-loops via TodoWrite
  and the ledger until the exit criteria are met, then stops.

Either way the loop's memory lives in the durable ledger file `docs/ai-deploy-readiness.md` (created
on first iteration), so progress — including the clean-pass streak — survives context resets between
iterations.

---

## The loop prompt (paste-ready)

```
ROLE: You are hardening branch ai-phase-0-1 (AI-0 @taweed/ai foundation + AI-1 scrub-flag
explainer) to first-retrofit-stage DEPLOY-READY. You run as an iterative loop: each iteration
sweeps for errors AND latent defects, fixes them at the root, re-verifies, and updates a durable
ledger. You STOP only when the whole DoD battery is green with zero open HIGH/CRITICAL findings on
TWO consecutive clean passes (defined below). You add NO features, weaken NO gate/test to go green,
and never autonomously touch the money path (resolveRecovery / analytics SQL / recovered-SAR stay
100% deterministic — a real bug there is ESCALATED, not patched).

FIRST, ORIENT (once, iteration 0 only):
- Read docs/handoff.md, docs/04_agentic_retrofit_plan.md §3–§6 and the §9 shared invariants
  (toolchain quirks, in-place branch, docs-sync, git ritual), and docs/blocker.md.
- Confirm branch: `git rev-parse --abbrev-ref HEAD` == ai-phase-0-1. Record START_MAIN =
  `git rev-parse origin/main` and START_HEAD = `git rev-parse HEAD`.
- Create the durable ledger docs/ai-deploy-readiness.md if absent, seeded with EXACTLY these fields:
  * iteration_counter = 0
  * change_iteration_counter = 0   (only iterations that changed product source count toward the cap)
  * consecutive_clean_passes = 0
  * last_clean_head_sha = <empty>
  * DoD checklist below, every item UNCHECKED, each tick to carry provenance {iteration, head_sha}
  * defect_log = []  (each entry: {key, severity, file:line, root_cause, fix, verifying_gate,
    recur_count}); `key` = module + normalized-symptom signature, STABLE across iterations so
    recurrence is countable even after file:line drifts.
- SCOPE IS TWO-TIER — "deploy-ready" is a PRODUCT-level bar, so audit the whole product:
  * PRIMARY (deepest scrutiny) — the AI-0/AI-1 diff (git diff main...HEAD) + anything it touches:
    packages/ai/** (provider/anthropic-1p/fixture, config kill-switch, audit, pseudonymize,
    postprocess-ar, sha256, schemas/flagExplanation, features/explainFlag, evals/explainFlag.eval),
    packages/db/drizzle/0006_llm_calls.sql, apps/web components/modules/flag-explainer.tsx +
    scrubber-table.tsx, lib/actions/explain-flag.ts, app/[locale]/(app)/scrubber/page.tsx.
  * FULL-PRODUCT (the deploy bar) — EVERYTHING already on main from the prior phases
    (CREATE/IMPLEMENT/EXECUTE): packages/{rules-engine, appeals, ingest, db, audit, platform,
    shared}, the whole apps/web app (auth, RBAC, actions, all [locale] routes), test/synthetic-fhir,
    scripts/, infra/, and migrations 0000–0006. Prior versions are NOT exempt: a real error or latent
    defect anywhere blocks deployment and must be fixed this loop.
  * You do NOT rewrite or speculatively refactor the deterministic core — fix genuine defects only,
    root-cause, golden-gated (/santa-loop + payer-golden). The MONEY PATH (resolveRecovery, analytics
    SQL, recovered-SAR) is the moat: if you find a real correctness bug there, do NOT patch it
    autonomously — STOP-ESCALATE with a failing test + analysis for a human. Do NOT start AI-2/3/4.

TOOLCHAIN QUIRKS (obey — plan §9 invariant 4):
- pnpm is at ~/.local/bin/pnpm; fish shell → prefix env as `env VAR=val <cmd>`, PATH via
  `set -x PATH $HOME/.local/bin $PATH`.
- The RTK hook COMPRESSES test/tsc stdout → always write reports to a file and READ the file:
  `vitest run --project unit --reporter=json --outputFile /tmp/ut.json`;
  `pnpm typecheck 2> /tmp/tsc.txt`; likewise for web build/lint.
- Integration tests destructively migrate the SHARED Postgres and run single-fork sequentially:
  `docker compose up -d` first; RE-SEED after (`pnpm --filter @taweed/web seed`); never run int in
  parallel. Migrations 0000–0006 must apply cleanly from zero.
- `rm -rf apps/web/.next` if disk fills. Node v20; Next 15. CI runs unit+int+e2e (see .github/
  workflows/ci.yml) — your local green must predict CI green.

=== ONE ITERATION ===
Run the gate battery below TOP-TO-BOTTOM. Collect EVERY failure and EVERY latent finding into a
ranked defect list this pass (severity order: build > type > lint > unit-fail > integration-fail >
coverage-gap > security/PHI > a11y/RTL > silent-failure/latent > polish). Then fix the whole batch
this iteration using the FIX DISCIPLINE, re-verify, update the ledger, and take the EXIT DECISION.

GATE BATTERY (each maps to a real tool — use it, don't wing it):
1. BUILD/TYPE — root `pnpm typecheck` (NOTE: root `pnpm build` is an ALIAS for typecheck — no
   separate root bundle, don't run it twice); web `pnpm --filter @taweed/web typecheck` &&
   `pnpm --filter @taweed/web build` (the real `next build` — the only genuine compile artifact).
   Any red → build-error-resolver agent (root types) / react-build-resolver agent (web build);
   /build-fix skill. Minimal-diff fixes only.
2. LINT/FORMAT — root `pnpm lint`; web `pnpm --filter @taweed/web lint`; `pnpm prettier --check`
   on changed files. Fix; no rule suppressions unless justified in the ledger.
3. UNIT — `pnpm test` with coverage: `env … vitest run --project unit --coverage
   --reporter=json --outputFile /tmp/ut.json` (/test-coverage skill for the report). Require ≥80%
   overall AND 100% on the pure modules (pseudonymize.ts, postprocess-ar.ts, sha256.ts). Missing
   branch → add a real test (TDD: failing test first), never delete/loosen an assertion.
4. INTEGRATION — `docker compose up -d`; `pnpm test:int`; re-seed. Verify migrations 0000–0006 apply
   from a clean DB and llm_calls RLS is enforced. APPEND-ONLY IS PRIVILEGE-BASED, not convention:
   connect AS THE APP RUNTIME ROLE and assert UPDATE and DELETE on llm_calls are DENIED. Today they
   are NOT (the role has a broad GRANT … UPDATE, DELETE ON ALL TABLES with a REVOKE only on tenants —
   see packages/db/test/migrate.ts) so the compliance trail is mutable — fix it: add
   `REVOKE UPDATE, DELETE ON llm_calls FROM <app_role>` (or a BEFORE UPDATE/DELETE reject trigger) to
   migration 0006, then tick the box. Also confirm an audit row is written per call.
   → database-reviewer agent for the migration-from-zero / RLS-coverage / append-only-privilege /
   schema checks.
5. E2E + A11Y — if Playwright browsers are installed: `pnpm --filter @taweed/web seed` then
   `pnpm --filter @taweed/web test:e2e` (chromium/firefox/webkit + axe). If not installed, run
   `pnpm --filter @taweed/web exec playwright install --with-deps chromium` OR substitute the
   chrome-devtools MCP smoke in step 6. Use the e2e-runner agent for flake triage.
   i18n PARITY (do here): assert every locale message key exists in BOTH apps/web messages/en.json
   and ar.json (key-diff) — the 5 new explainer keys and all others. There is NO next-intl
   onError/getMessageFallback handler, so a key present in only one locale renders the raw key or
   throws at runtime; fix by restoring parity AND wiring a loud missing-message behavior.
6. RUNTIME SMOKE (chrome-devtools MCP; the `run` skill launches+drives the app, the `verify` skill
   drives the changed flow end-to-end) — `pnpm --filter @taweed/web dev` (env
   TAWEED_ENABLE_DEV_AUTH=1 AUTH_SECRET=dev). Navigate the scrubber surface and drive the
   flag-explainer popover: verify EN + AR/RTL, light + dark, reduced-motion, WCAG AA
   (lighthouse_audit / list_console_messages must be zero errors), design-brief §4.3 digit law
   (Western digits). Verify THREE config states are DISTINGUISHABLE, not silently collapsed:
   (a) AI OFF (TAWEED_AI_ENABLED unset) → graceful absence: deterministic bilingual flag messages
       still render, no Anthropic network call, no thrown error;
   (b) AI ON but UNCONFIGURED (flag on, no ANTHROPIC_API_KEY) → must FAIL LOUD / be distinguishable
       from (a), not show the same "unavailable" as intentional-off (today it silently collapses —
       add startup/first-call config validation or a distinct audited/alerting state);
   (c) AI ON + configured (fixture provider) → popover renders the explanation.
   Also drive the version-desync path: a flag whose rule version is absent-from / ahead-of the
   ruleVersions map must not silently render "unavailable" (scrubber-table passes `?? 1`).
7. LATENT-DEFECT HUNT ("possible errors" — the whole point of the loop). Run each reviewer TWICE
   in scope: (A) deepest on the AI-0/AI-1 diff `git diff main...HEAD`, and (B) a FULL-PRODUCT sweep
   across the prior-phase deterministic core on main — rules-engine (scrub/select, custom operators),
   appeals (generate, deterministic templates), ingest (CSV/TSV parser, field-mapping, dimension
   resolution), db (RLS on every table + migrations 0000–0006), audit (PHI-leak guard), platform
   (typed swaps), web app (auth/session gate withTenant, RBAC lib/rbac.ts, server actions,
   data_origin production gate). Money-path integrity (resolveRecovery: recovered ≤ appealed, never
   negative) is RE-VERIFIED, never modified. Each reviewer returns findings you then fix (core fixes:
   root-cause + golden-gated only; money-path bug ⇒ STOP-ESCALATE):
   - security-reviewer agent + /security-scan skill: no committed secrets; API key only from env;
     ZDR org posture documented; no prompt-injection surface; no PHI in the prompt, audit table, or
     logs. BATCHES: no feature uses the Batches API (AI-1 = synchronous messages.parse only);
     capabilities.batches is exposed for a future feature-layer gate but NO enforcing code reads it
     yet — assert no Batches call is introduced (the guarantee is "no call exists", not "a flag
     blocks it"). COST-ABUSE: explainFlagAction is a BILLABLE endpoint and common/security.md mandates
     rate limiting — verify a per-tenant/per-actor rate limit or spend cap exists (dedupe only bounds
     steady-state and is storage-level, so concurrent first-callers each pay); add one if missing.
   - healthcare-reviewer agent (MANDATORY — LLM boundary = PHI path): explainFlag input type is
     PHI-FREE BY CONSTRUCTION (assert no claim/patient fields reach the prompt); audit stores
     HASHES ONLY (prompt_sha256/output_sha256), never raw text; PHI-leak guard covers the new path;
     SFDA wording — explainer explains BILLING rules, never diagnoses/clinical judgment. CACHE
     INVALIDATION (compliance-critical): the flag_explanations cache is read by (tenant_id, rule_id,
     rule_version) and NEVER compares the stored prompt_sha256, so tightening the SFDA SYSTEM_PROMPT
     (or editing rule text without a version bump) serves the STALE, weaker wording forever. Fix:
     key/compare on prompt_sha256 so a system-prompt change forces regeneration; add a test proving a
     changed prompt re-generates.
   - silent-failure-hunter agent: no swallowed errors, no bad fallbacks, no empty catch. Confirm the
     KILL SWITCH FAILS CLOSED: TAWEED_AI_ENABLED default OFF → typed AiDisabledError → EVERY call site
     falls back to the deterministic path (grep every explainFlag/feature caller).
   - typescript-reviewer + react-reviewer agents: hook correctness, server/client boundary, no `any`
     leaks. SERVER-ONLY BUNDLE BOUNDARY: packages/ai has NO `import "server-only"` marker; the client
     component flag-explainer.tsx only avoids bundling @anthropic-ai/sdk + drizzle + node:crypto via
     the `type` keyword on `import type { FlagExplanation }`. Drop that keyword anywhere and the whole
     server SDK/secrets stack ships to the browser. Fix: add `import "server-only"` to the AI server
     modules (or split a client-safe types entrypoint) and assert via bundle analysis that those deps
     never appear in a client chunk.
   - database-reviewer agent: schema/migration correctness across 0000–0006, RLS actually enforced on
     every table, append-only PRIVILEGE on llm_calls (gate 4), no N+1 / unbounded query regressions.
     Also: 0006 is forward-only with bare CREATE TABLE/POLICY (no IF NOT EXISTS, no down) — confirm a
     failed/partial 0006 is safely re-runnable or document forward-only + the recovery path.
   - code-reviewer agent + /quality-gate + production-audit skill on the full diff.
   - AI-invariant grep-checks (plan §5), stated as they ACTUALLY are in code:
     * raw provider client + internal runner (run.ts) are NOT exported from packages/ai (grep index.ts).
     * every feature fn takes {actor, tenantId} and routes through runStructured, which DERIVES
       `purpose` internally from the feature key (run.ts PURPOSE_BY_FEATURE) — so audit is unskippable.
       (Feature fns do NOT take a `purpose` argument — don't hunt for one.)
     * explainFlag DEDUPES by (tenantId, ruleId, ruleVersion) — migration 0006
       UNIQUE(tenant_id, rule_id, rule_version) — with BOTH locales stored in ONE row
       (explanation_en/ar + suggested_fix_en/ar). `locale` is deliberately NOT a dedupe dimension;
       do NOT "add locale to the key" (that would split the row and double paid calls). Verify the
       onConflictDoNothing + re-read race path; note concurrent first-callers can each make one paid
       call (acceptable — must NOT be "fixed" into the money path).
     * models are exact IDs (claude-haiku-4-5 for the explainer, no date suffix).
     * FixtureProvider is the only provider CI uses (no ANTHROPIC_API_KEY for `pnpm test`);
       evals never run in CI (AI_EVALS_LIVE gate).
   - /santa-loop on any rules-engine-adjacent change; docs-lookup (Context7 MCP) to confirm any
     @anthropic-ai/sdk / zod / drizzle API you're unsure about; the claude-api skill before editing
     any SDK call.

FIX DISCIPLINE (every fix):
- superpowers:systematic-debugging — find the ROOT cause, not the symptom; reproduce, then fix.
- superpowers:test-driven-development for any logic bug — failing test FIRST, then the fix.
- Minimal diff; immutable patterns (new objects, no mutation); match surrounding style.
- Fix the implementation, not the test. Never disable/skip/weaken a gate or assertion to go green.
  If a gate is legitimately wrong, fix the gate and NOTE it in the ledger with the reason.
- Hardening an existing compliance control (append-only REVOKE, server-only marker, cache
  invalidation, config validation, rate limit) is a DEFECT FIX, not a new feature — allowed. Adding a
  NEW product capability is not.
- Never autonomously change the money path; keep every LLM surface additive + human-in-the-loop; keep
  the deterministic fallback intact.

AFTER FIXING THIS ITERATION (update durable state — this is the loop's memory):
- Regression re-run: gates 1–6 to confirm your fixes introduced no regression. (This is a REGRESSION
  CHECK, not a stability pass — see the definition below.)
- Compute PRODUCT_CHANGED = `git status --porcelain` shows any change to product source
  (code/tests/config/migrations/UI), EXCLUDING docs/ai-deploy-readiness.md and the docs-sync files.
  Ledger/docs writes NEVER count as changes.
- Update docs/ai-deploy-readiness.md:
  * iteration_counter += 1; if PRODUCT_CHANGED, change_iteration_counter += 1.
  * For each defect: match by stable `key`; if a defect previously marked resolved reappears,
    recur_count += 1.
  * DoD ticks carry provenance {iteration, head_sha}. On ANY product change this iteration, CLEAR all
    gate-derived ticks (they must be re-earned against the new HEAD); a tick whose head_sha != current
    HEAD is STALE and does NOT satisfy exit.
  * Clean-pass streak: a CLEAN/STABILITY PASS = a COMPLETE iteration running gates 1–7 with ZERO
    findings AND PRODUCT_CHANGED == false. If this iteration was a clean pass at the current HEAD,
    consecutive_clean_passes += 1 and set last_clean_head_sha = HEAD; on ANY change or any red
    gate/finding, reset consecutive_clean_passes = 0.
- Print a terse status: iteration N — swept [gates], found [K defects], fixed [K], still-red [list],
  open HIGH/CRITICAL [list], consecutive_clean_passes = X, EXIT DECISION.

=== EXIT DECISION (read from the LEDGER, not memory) ===
- CONTINUE if: any gate is red, OR any HIGH/CRITICAL finding is open, OR any DoD tick is missing or
  STALE (head_sha != current HEAD), OR consecutive_clean_passes < 2.
  Concrete action: under `/loop` self-pacing, ScheduleWakeup for the next iteration; standalone, start
  the next iteration in-session. (Do NOT stop while DoD ticks are missing/stale or a change just
  landed — the two-clean-pass tail is mandatory.)
- STOP — DEPLOY-READY when, at the CURRENT HEAD: every gate green, every DoD item ticked with
  head_sha == HEAD, zero HIGH/CRITICAL open, AND consecutive_clean_passes >= 2. Do the TERMINAL
  ACTION and END THE TURN WITHOUT SCHEDULING.
  PRECEDENCE: if the iteration cap is reached in the SAME iteration this becomes true, DEPLOY-READY
  WINS over the cap.
- STOP — ESCALATE (end turn, no schedule) if a SAFETY CAP trips: a defect's recur_count reaches 3,
  OR change_iteration_counter reaches 12 (only change-making iterations count, so the mandatory
  clean-pass tail never starves the cap), OR a fix would require touching the money path / adding a
  feature / relaxing a compliance gate. Write the blocker + analysis to the ledger and hand back to
  the human with a crisp summary.

DEPLOY-READY DoD (ledger checklist — every item ticked with head_sha == current HEAD to STOP):
[ ] root pnpm typecheck green (root `build` == typecheck, no separate root bundle); web typecheck +
    `next build` green
[ ] root pnpm lint + web next lint clean; prettier clean on changed files
[ ] pnpm test (unit) green — ALL packages; coverage ≥80% overall; 100% on
    pseudonymize/postprocess-ar/sha256; payer-golden corpus green; no regression vs the main baseline
[ ] pnpm test:int green; migrations 0000–0006 apply from a clean DB; RLS enforced on every table
    (not just declared); llm_calls append-only ENFORCED BY PRIVILEGE (app role denied UPDATE/DELETE),
    not by convention; 0006 re-runnable or forward-only+recovery documented
[ ] money-path integrity RE-VERIFIED unchanged (resolveRecovery: recovered ≤ appealed, never
    negative; data_origin production gate fails closed) — verified, not modified
[ ] E2E/a11y green (Playwright, whole app) OR chrome-devtools MCP smoke: scrubber flag-explainer AND
    the pre-existing app shell work EN+AR RTL × light/dark, reduced-motion, WCAG AA, zero console
    errors, digit law honored
[ ] config states distinguishable: AI-off graceful absence (deterministic messages, no network call)
    AND AI-on-but-unconfigured fails LOUD (not collapsed into the same "unavailable" as off)
[ ] kill switch fails CLOSED (default OFF → AiDisabledError → deterministic fallback at every caller)
[ ] audit: llm_calls row on every call; HASHES ONLY, no PHI/raw text; PHI-leak guard covers new path
[ ] cache invalidation: flag_explanations regenerates when the SYSTEM_PROMPT / rule text changes
    (keyed/compared on prompt_sha256) — no stale SFDA wording served; test proves it
[ ] explainFlag PHI-free-by-construction (asserted); dedupe by (tenantId, ruleId, ruleVersion), BOTH
    locales in one row (NOT keyed by locale); claude-haiku-4-5; SFDA billing-only wording
[ ] paid endpoint has an abuse/cost control (per-tenant/actor rate limit or spend cap); dedupe
    documented as storage-level
[ ] @taweed/ai server modules marked `server-only` (or client-safe types split); bundle analysis
    confirms @anthropic-ai/sdk / drizzle / node:crypto never enter a client chunk
[ ] i18n key parity en.json ↔ ar.json for all keys; missing-message behavior fails loud
[ ] FixtureProvider is the only provider in CI (no API key for `pnpm test`); evals gated by
    AI_EVALS_LIVE, never in CI; raw client + runner NOT exported from packages/ai
[ ] reviewers run with no open HIGH/CRITICAL — on BOTH the AI diff AND a full-product sweep of the
    prior-phase core: typescript + react + security + healthcare + silent-failure + database +
    code-reviewer; /quality-gate + production-audit + /security-scan clean across the repo
[ ] no secrets committed; ANTHROPIC key only from env; no Batches call introduced; no money-path touch
[ ] git diff main...HEAD reviewed end-to-end; no debug logs / stray console.* / TODO regressions

TERMINAL ACTION (only on STOP — DEPLOY-READY). This is HUMAN-GATED: an autonomous loop must NOT
force-push or merge to main by itself (irreversible, self-graded). Do a–d, then STOP for a human.
a. Docs sync: update docs/handoff.md (AI-0/AI-1 hardened + deploy-ready, repo map incl. packages/ai
   and migration 0006); sync docs/blocker.md (BLK-AI-1..4 state; note none block this PHI-free
   phase); rewrite docs/NEXT_STEP_PROMPT.md to point at PROMPT 2 of docs/04_agentic_retrofit_plan.md
   §9; update the Obsidian brain ~/Desktop/ObsidianVault/Projects/Taweed (NPHIES).md "Build
   progress". Fold the ledger headline into handoff; leave docs/ai-deploy-readiness.md as the trail.
b. superpowers:verification-before-completion, then /checkpoint.
c. Commit everything on ai-phase-0-1 (conventional commits) and push the BRANCH (no force):
   `git push -u origin ai-phase-0-1`. Then open a PR into main: `gh pr create` with the DEPLOY-READY
   report as the body (DoD all ticked, defects fixed, iterations run).
d. Print the final DEPLOY-READY report and STOP-FOR-HUMAN-MERGE (do NOT reschedule, do NOT merge, do
   NOT force-push). Include the exact human merge+back-up ritual for the operator to run after review
   (plan §9 invariant 3), reminding them: capture OLD = pre-merge main tip BEFORE merging
   (`set OLD (git rev-parse origin/main)`); if the "back-up is exactly one commit behind main"
   invariant is wanted, SQUASH-merge (else back-up == pre-merge main tip); then
   `git branch -f back-up $OLD && git push -f origin back-up`; THEN `git push origin main`; and REFUSE
   the ritual if origin/main advanced past START_MAIN since the loop began.

Blockers: none gate this loop — AI-0/AI-1 are PHI-free by construction. BLK-AI-2 (Anthropic org +
ZDR) is needed ONLY to flip TAWEED_AI_ENABLED=true against the LIVE API in dev; the fixture path and
every gate above pass without it. The loop does not merge to main — a human does, after PR review.
```

---

## Notes

- **Two-tier scope (whole product):** the loop scrutinizes the AI-0/AI-1 diff deepest, but the
  deploy-ready bar covers the entire product — every prior phase (CREATE/IMPLEMENT/EXECUTE) already on
  `main` is regression-tested and latent-defect-swept, so a bug that predates this branch still blocks
  release. The deterministic core is fixed, never rewritten; the money path is re-verified and, if a
  real bug surfaces, escalated to a human rather than autonomously changed.
- **Durable ledger is the loop's memory:** `docs/ai-deploy-readiness.md` holds the iteration counters,
  the `consecutive_clean_passes` streak + `last_clean_head_sha`, per-DoD tick provenance, and the
  defect log with stable keys + `recur_count`. Every termination decision reads the ledger, not the
  model's recollection — so the two-clean-pass rule and the 3×-recurrence cap survive context resets.
- **Termination is explicit, computable, and bounded:** DEPLOY-READY needs two consecutive full
  (gates 1–7) zero-change clean passes at the current HEAD, with all DoD ticks fresh (head_sha ==
  HEAD). "Zero change" excludes ledger/docs writes. SAFETY CAPS (recur_count 3, 12 change-making
  iterations, or a fix that would breach a hard rule) force ESCALATE; DEPLOY-READY wins over the cap
  if both fire together. It cannot loop forever, terminate early, or "fix" its way into the money path.
- **Terminal action is human-gated:** the loop commits, pushes the branch, and opens a PR — it does
  NOT merge to main or force-push `back-up` autonomously. A human reviews the PR and runs the
  merge+back-up ritual. This removes the "AI writes, self-grades, force-pushes to production" failure
  mode.
- **Tool roster mapped to gates:** each gate names the CLI (pnpm/rtk/docker/gh), MCP (chrome-devtools
  for UI/a11y, Context7/docs-lookup for API truth), agent (build/type/security/healthcare/
  silent-failure/react/database/code reviewers, e2e-runner), and skill (systematic-debugging, TDD,
  test-coverage, run/verify, security-scan, production-audit, quality-gate,
  verification-before-completion, checkpoint, santa-loop) that applies.
- **Findings folded from the adversarial critique:** corrected dedupe key
  `(tenantId, ruleId, ruleVersion)` (both locales one row); append-only is convention-only today →
  loop enforces it by privilege; added gates for cache-invalidation (stale SFDA prompt),
  config-validation (enabled-but-unconfigured), rate-limit/spend-cap, server-only bundle boundary,
  i18n parity, and migration re-runnability; corrected `purpose` (derived, not a feature-fn arg) and
  the Batches claim (no call exists; no enforcing flag yet).
