# AI Harden-to-Deploy Loop — run AFTER PROMPT 2 (AI-2 appeal assist + AI-3 rule authoring)

> Companion to `docs/04_agentic_retrofit_plan.md` §9 (PROMPT 2 builds AI-3 + AI-2 on branch
> `ai-phase-2-3`). This is the **hardening loop** that runs after that build lands on the branch and
> before it is trusted for the second-retrofit stage: it sweeps every error and every _latent_
> ("possible") error across the new AI-2/AI-3 surfaces AND the whole product, fixes them at the root,
> and stops only when the branch is genuinely deploy-ready. It never adds features and never
> autonomously touches the money path OR the deterministic rule/appeal semantics.
>
> This doc was written from a read of the PROMPT-2 additions and an adversarial audit (5 lenses:
> AI-3-gate-correctness / security-PHI / data-migration / scope-completeness / UI-react-a11y, each
> finding independently verified). The findings are folded in below. **Both halves of PROMPT 2 are
> additive LLM layers with a deterministic fallback: AI-3 proposes a scrubber-rule DRAFT that a human
> approves before it executes; AI-2 suggests appeal paragraphs the reviewer may insert/edit/discard on
> top of the deterministic template. The loop hardens the guard rails around those layers — it does not
> let any model output reach production un-gated, and it never changes the deterministic core.**

## HANDOFF — current state (a fresh agent resumes HERE)

> Written mid-run so another agent (or a future you) can take over cleanly. **Read
> `docs/ai-deploy-readiness.md` (the durable ledger) FIRST — it is the loop's memory (counters, DoD
> ticks, defect log, open escalations).** This block is the fast summary. The prior AI-0/AI-1 loop is
> archived at `docs/AI_HARDEN_LOOP.md.ai01-bak`.

**Where we are (2026-07-06):** PROMPT 2 (AI-2 appeal assist + AI-3 rule authoring) is built on
`ai-phase-2-3`. Confirm the live state before trusting any claim here — `git rev-parse --abbrev-ref
HEAD`, `git log --oneline -5`, `git status --porcelain` — because this doc was drafted while the build
was still in flight. Re-run every gate against the current HEAD; do not carry a stale green.

**AI-3 (NL → ScrubRule authoring) — the chain as it is in code:**
`app/[locale]/(app)/settings/page.tsx` → `components/modules/rule-authoring.tsx` (`"use client"`) →
`lib/actions/author-rule.ts` (`draftRuleAction`: RBAC `authorizeAction("settings", ["full","rules"])`
→ zod input → per-(tenant,actor) rate limit → `authorRule`) → `packages/ai/features/authorRule.ts`
(`claude-opus-4-8`, `import "server-only"`, PHI-free input type, `runStructured` → `llm_calls` audit
row, AR post-processing) → `packages/rules-engine/author.ts` `validateAuthoredRule` (**shape → engine
dry-run → golden-corpus regression**, stops at first failure) → persist **DISABLED** (`status='draft'`,
`active=false`) via `lib/rules-data.ts` → `approveRuleAction` **RE-GATES** against the current library →
on approve `status='approved'` + `active=true` → scrubber loads approved authored rules in its RLS txn
via `loadApprovedAuthoredRulesTx` in `lib/data.ts:getScrubRows`. Registry
(`rules-engine/registry.ts`, `AUTHORABLE_FACT_KEYS`/`SCRUB_OPERATORS`) is the single source of truth;
the `@taweed/ai` zod schema (`scrubRuleDraft.ts`) enum-constrains against it. Migration **0007** adds
the authoring columns to `rules`.

**AI-2 (appeal-draft assist) — the chain as it is in code:** the deterministic bilingual template
(`packages/appeals`) stays the PRIMARY output; AI-2 is additive. `assistAppeal`
(`packages/ai/features/assistAppeal.ts`, `claude-opus-4-8`) takes pseudonymized claim-shape context and
returns optional `suggestedParagraphs` (`AppealDraft.suggestedParagraphs`, `packages/appeals/types.ts`).
The guardrail chain lives in `packages/ai/appeal-guardrails.ts` + `schemas/appealAssist.ts` — exported
as `buildFactSlots`, `slotLegend`, `assertNoInventedNumbers`, `unknownSlots`, `detokenizeSlots`,
`checkParagraphs`, `AppealAssistSchema`, `AppealVerifySchema`. It maps to plan §4.2's five checks:
(a) slot-fill diff — every fact is an immutable `[SLOT_N]` token, `assertNoInventedNumbers` rejects any
new digit/date/code; (b) glossary term check (`@taweed/shared` glossary); (c) second-model verify
(`AppealVerifySchema`, `claude-sonnet-5` judge — low score suppresses the suggestion); (d)
`postprocess-ar` on AR output; (e) `detokenizeSlots` runs LAST, after all checks. SME edits are tracked
as metadata only via `recordSuggestion` (`lib/appeals-data.ts`) into the `appeal_suggestions` table
(0007: lengths, `verify_score`, `edit_distance`, `outcome` — **never the prose**). UI: labelled DRAFT
blocks in `components/modules/appeals-composer.tsx` the reviewer inserts/edits/discards.

**Gate baseline observed DURING the build (treat as indicative, RE-RUN fresh):** root `pnpm typecheck`
green; web typecheck + `next build` green (22 pages); unit `vitest --project unit` green (all packages,
incl. the AI-3 tests); ESLint clean on the changed files; i18n `en.json`↔`ar.json` parity clean. **Not
verified this loop:** integration (`test:int`, migrations 0000–**0007**, RLS on the new tables), the
AI-2 guardrail-chain unit coverage, Playwright E2E, and the chrome-devtools runtime smoke of both new
surfaces (settings authoring + appeals composer). These are the open gates.

**Confirmed audit findings folded (fix in-loop; check the ledger for live status):**

1. **`in` / `notIn` operators let a nonsense rule pass the whole gate (HIGH, verified).**
   `SCRUB_OPERATORS` (`registry.ts`) includes `in`/`notIn`, and `authorRule.ts` advertises the full set
   to the model, but the draft schema's `value` is scalar-only (`string|number|boolean`) and
   `validateDraftShape` has NO fact/operator agreement check for them. json-rules-engine evaluates
   `in`/`notIn` as `value.indexOf(factValue)`. A STRING value → substring match, no throw → passes
   shape + dry-run + golden and PERSISTS. Concrete: `{fact:"patientGender", operator:"in",
   value:"female"}` ("gender is female") runs `"female".indexOf(patientGender)` — and
   `"female".indexOf("male") === 2` (fe-**male**), so the approved rule **also fires for MALE claims**:
   a silent false positive in a high-stakes billing scrubber. Fix: drop `in`/`notIn` from
   `SCRUB_OPERATORS` (they cannot be expressed with scalar values and the prompt never offers them), OR
   add an array-value shape rule + widen the schema for them. Confirm dry-run behaviour first.
2. **`status` (text) + `active` (bool) are a dual source of truth on authored rules (MEDIUM).**
   `setRuleStatus` sets both; `loadApprovedAuthoredRulesTx` filters on `status='approved'` only. They
   can drift (approved-but-inactive, or active-but-not-approved) through any path that touches one and
   not the other. Collapse to one gate (derive `active` from `status`, or filter on both) and test it.
3. **AI-3 approval UI swallows action failures (HIGH, verified).** In `rule-authoring.tsx`, the
   `decide()` handler `await fn(rowId)` and discards the returned `{ok, error}` — an approve that the
   re-gate blocks (or a `not_draft`) refreshes silently with no feedback. Surface the result.
4. **AI-3 draft-error states render nothing (HIGH, verified).** The result block handles
   `disabled`/`misconfigured`/`generation` but not `rate_limited`/`forbidden`/`invalid` — those return
   `{ok:false, error}` with no draft, so the user sees no message. Add the missing branches.
5. **AI-3 async result region has no `aria-live`/`aria-busy` (MEDIUM).** The draft/gate result is not
   announced to a screen reader (the AI-1 explainer added `aria-live`; parity is missing here). Also:
   overlapping transitions can clobber `acting` (state-management, MEDIUM); focus is lost after
   approve/reject clears the panel; the condition-leaf `<code>` lacks `dir="ltr"` so LTR
   fact/operator/value tokens can bidi-reorder in Arabic (LOW each).
6. **AI-2 data-residency (ZDR / `inference_geo`) is asserted in comments but not set on the request
   (MEDIUM).** `anthropic-1p.ts` documents the ZDR posture but does not set it on the Anthropic call.
   AI-2 sends pseudonymized PHI, so this matters the moment a LIVE call is enabled — it stays behind
   BLK-AI-1/BLK-AI-2 until then, but wire the control (or document that fixture-only is enforced) so
   the guarantee is in code, not prose.
7. **"PHI-free by construction" is really "by policy" for free-text inputs (MEDIUM).** AI-3 `smeText`
   and AI-2 free-text context are strings an SME types; the input TYPE carries no claim/patient fields
   (structurally PHI-free), but nothing filters the string content itself. State the guarantee
   precisely and keep the pseudonymization + free-text-exclusion on the AI-2 path as the real control.
8. **Billing-endpoint rate limit is per-process, in-memory (LOW).** The limit multiplies across
   instances and resets on cold start; it is at the server-action caller, not co-located with the
   billable `authorRule`/`assistAppeal`. Fine for now — note it; move to a shared store when multi-
   instance. Also `run.ts`: a provider error + audit-DB failure leaves the attempt unaudited (LOW).
9. **Thin golden regression corpus (coverage limitation).** `checkGoldenRegression` guards authored
   rules against only the 2 `PAYER_GOLDEN_CASES`. The guarantee is "no PINNED golden outcome changes";
   an authored rule that alters behaviour on a claim shape not in the corpus is not caught. Document +
   consider widening. Also cosmetic: `author.ts:187` has a dead `? 0 : 0` ternary; the plan's operator
   enum "+ custom operators" is currently vacuous (no `addOperator` is registered — builtins only).

**Toolchain gotchas (also in the ledger + [[toolchain-quirks]] memory):** pnpm at `~/.local/bin`; fish
shell (`env VAR=val` prefix); RTK compresses tsc/vitest/eslint stdout → write to a file + read it;
`--project unit` / `--project integration`; Docker CLI HANGS on daemon metadata — bring Postgres up
with `docker compose up -d`, then probe port 5432 via a Node `net` socket (never `docker info`);
`server-only` throws in vitest → aliased to a no-op stub; session limits can kill parallel subagents
mid-workflow (re-verify after reset).

**To resume:** read the ledger → run gates 1–7 for the current HEAD → work the defect list one
iteration per turn → update the ledger every iteration → STOP at DEPLOY-READY (2 consecutive
zero-change clean passes, all DoD fresh) or ESCALATE (per SAFETY CAPS).

## When to run

- After PROMPT 2 has built AI-2 + AI-3 on `ai-phase-2-3`. Primary diff = `git diff main...HEAD` (or the
  working tree if uncommitted). This loop is the gate before the work is trusted for deploy.
- **Two-tier scope.** "Deploy-ready" is a _product-level_ bar:
  - **Primary (deepest scrutiny) — the AI-2/AI-3 additions:** `packages/ai/{features/authorRule.ts,
    features/assistAppeal.ts, appeal-guardrails.ts, schemas/scrubRuleDraft.ts, schemas/appealAssist.ts}`,
    `packages/rules-engine/{registry.ts, golden.ts, author.ts}` + `index.ts`, `packages/appeals/types.ts`,
    `packages/shared` glossary/edit-distance, `packages/db/{drizzle/0007_*.sql, src/schema.ts}`,
    `apps/web/lib/{actions/author-rule.ts, actions/assist-appeal.ts, rules-data.ts, appeals-data.ts,
    data.ts}`, `apps/web/components/modules/{rule-authoring.tsx, appeals-composer.tsx}`, the settings +
    appeals pages, and the new tests.
  - **Full-product regression + latent-defect sweep — everything already on `main`** from the prior
    phases (CREATE/IMPLEMENT/EXECUTE/AI-0/AI-1): `packages/{rules-engine, appeals, ingest, db, audit,
    platform, ai, shared}`, the whole `apps/web` app, `test/synthetic-fhir`, `scripts/`, `infra/`,
    migrations 0000–0007. A real error anywhere blocks deployment.
- It will _not_ start AI-4 (PROMPT 3) and does **not** rewrite or speculatively "improve" the
  deterministic rule/appeal core — it fixes genuine defects and HARDENS the guard rails (the authoring
  gate, the AI-2 guardrail chain, RLS, config, audit, rate limits). Any change to the money path or to
  deterministic rule/appeal semantics is escalated to a human, never made autonomously (SAFETY CAPS).
- **PHI posture / blockers:** AI-3 authoring input has no claim/patient FIELDS (rule description +
  scope); it hardens fully on the fixture path. AI-2 sends **pseudonymized** claim-shape context (free
  text excluded, DOB→age band) — the fixture/synthetic path hardens without blockers, but any LIVE
  pseudonymized-PHI call stays gated by **BLK-AI-1** (privacy counsel) + **BLK-AI-2** (ZDR org), and any
  Arabic appeal/rule text reaching a real clinic is gated by **BLK-9** (SME sign-off). The loop keeps
  the per-feature live flag OFF and verifies the fixture path + deterministic fallback.

## How to invoke (two modes)

- **Self-paced loop (recommended):** paste the fenced block below into `/loop` with **no interval** —
  `/loop <paste the block>`. Each iteration does one full sweep + fixes, updates the durable ledger,
  then schedules the next iteration if the CONTINUE condition holds; at DEPLOY-READY or ESCALATE it
  prints the report and ends the turn **without** scheduling.
- **Direct paste:** paste the block into a fresh session at the repo root. It self-loops via TodoWrite
  and the ledger until the exit criteria are met, then stops.

The loop's memory lives in `docs/ai-deploy-readiness.md`, so progress survives context resets.

---

## The loop prompt (paste-ready)

```
ROLE: You are hardening branch ai-phase-2-3 (AI-3 NL→ScrubRule authoring + AI-2 appeal-draft assist) to
second-retrofit-stage DEPLOY-READY. You run as an iterative loop: each iteration sweeps for errors AND
latent defects, fixes them at the root, re-verifies, and updates a durable ledger. You STOP only when
the whole DoD battery is green with zero open HIGH/CRITICAL findings on TWO consecutive clean passes.
You add NO features, weaken NO gate/test to go green, and never autonomously touch the money path OR
the deterministic rule/appeal semantics (resolveRecovery / analytics SQL / recovered-SAR / the shipped
SCRUBBER_RULES condition logic / the deterministic appeal templates stay 100% deterministic — a real
bug there is ESCALATED, not patched). You only fix defects and HARDEN the guard rails AROUND that core:
the AI-3 authoring gate, the AI-2 guardrail chain, RLS, config, audit, rate limits.

FIRST, ORIENT (once, iteration 0 only):
- Read docs/handoff.md, docs/04_agentic_retrofit_plan.md §3–§6 and §4.2–4.3 (AI-2/AI-3 spec) and the
  §9 shared invariants, docs/blocker.md (BLK-AI-1/BLK-AI-2 gate live pseudonymized-PHI AI-2 calls; BLK-9
  gates AR text reaching a clinic), and docs/ai-deploy-readiness.md (the durable ledger — loop memory).
- Confirm branch: `git rev-parse --abbrev-ref HEAD` == ai-phase-2-3. Record START_MAIN =
  `git rev-parse origin/main` and START_HEAD = `git rev-parse HEAD`. Primary review target = the AI-2/
  AI-3 diff (git diff main...HEAD, or the working tree if uncommitted).
- Seed docs/ai-deploy-readiness.md (start a NEW section if it still describes an earlier run) with:
  * iteration_counter = 0
  * change_iteration_counter = 0   (only iterations that changed product source count toward the cap)
  * consecutive_clean_passes = 0
  * last_clean_head_sha = <empty>
  * DoD checklist below, every item UNCHECKED, each tick carrying provenance {iteration, head_sha}
  * defect_log = []  (each entry: {key, severity, file:line, root_cause, fix, verifying_gate,
    recur_count}); `key` = module + normalized-symptom signature, STABLE across iterations.
- SCOPE IS TWO-TIER — audit the whole product:
  * PRIMARY (deepest) — the AI-2/AI-3 additions: packages/ai/{features/authorRule.ts,
    features/assistAppeal.ts, appeal-guardrails.ts, schemas/scrubRuleDraft.ts, schemas/appealAssist.ts},
    packages/rules-engine/{registry.ts, golden.ts, author.ts}, packages/appeals/types.ts,
    packages/shared glossary/edit-distance, packages/db/{drizzle/0007_*.sql, src/schema.ts},
    apps/web/lib/{actions/author-rule.ts, actions/assist-appeal.ts, rules-data.ts, appeals-data.ts,
    data.ts}, apps/web/components/modules/{rule-authoring.tsx, appeals-composer.tsx}, the settings +
    appeals pages, and the new tests.
  * FULL-PRODUCT — EVERYTHING already on main from the prior phases. Prior versions are NOT exempt.
  * You do NOT rewrite the deterministic rule/appeal core. The MONEY PATH and deterministic rule/appeal
    SEMANTICS are the moat: a real correctness bug there ⇒ STOP-ESCALATE with a failing test. Do NOT
    start AI-4.

TOOLCHAIN QUIRKS (obey — plan §9 invariant 4):
- pnpm at ~/.local/bin/pnpm; fish shell → `env VAR=val <cmd>`, PATH via `set -x PATH $HOME/.local/bin $PATH`.
- The RTK hook COMPRESSES test/tsc stdout → write reports to a file and READ the file:
  `vitest run --project unit --reporter=json --outputFile /tmp/ut.json`; `pnpm typecheck 2> /tmp/tsc.txt`.
- Integration tests destructively migrate the SHARED Postgres, single-fork: `docker compose up -d`
  first; RE-SEED after; never run int in parallel. Migrations 0000–0007 must apply from zero. Docker
  metadata commands HANG — probe port 5432 with a Node `net` socket.
- `rm -rf apps/web/.next` if disk fills. Node v20; Next 15. CI runs unit+int+e2e — local green must
  predict CI green.

=== ONE ITERATION ===
Run the gate battery TOP-TO-BOTTOM. Collect EVERY failure and EVERY latent finding into a ranked list
this pass (build > type > lint > unit-fail > integration-fail > coverage-gap > security/PHI > a11y/RTL
> silent-failure/latent > polish). Fix the whole batch using the FIX DISCIPLINE, re-verify, update the
ledger, take the EXIT DECISION.

GATE BATTERY (each maps to a real tool):
1. BUILD/TYPE — root `pnpm typecheck` (root `build` == typecheck); web `pnpm --filter @taweed/web
   typecheck` && `pnpm --filter @taweed/web build`. Red → build-error-resolver / react-build-resolver;
   /build-fix. Minimal-diff fixes only.
2. LINT/FORMAT — root `pnpm lint`; web `pnpm --filter @taweed/web lint`; `pnpm exec eslint <changed>`;
   `pnpm prettier --check` on changed files. No suppressions unless justified in the ledger.
3. UNIT — `vitest run --project unit --coverage --reporter=json --outputFile /tmp/ut.json`. ≥80%
   overall AND 100% on the pure modules (pseudonymize.ts, postprocess-ar.ts, sha256.ts). SAFETY-CRITICAL
   coverage: (a) the AI-3 gate rules-engine/author.ts — every validateDraftShape reject branch,
   clampWeight, dryRunRule failure path, checkGoldenRegression fired+notFired; (b) the AI-2 guardrail
   chain appeal-guardrails.ts — assertNoInventedNumbers (a smuggled digit/date/code fails closed),
   unknownSlots, checkParagraphs, detokenizeSlots (round-trips only after checks pass). Missing branch
   → add a real test (TDD: failing test first); never loosen an assertion.
4. INTEGRATION — `docker compose up -d`; `pnpm test:int`; re-seed. Migrations 0000–0007 apply from a
   clean DB. Verify:
   - RLS on the new surfaces: the `rules` authoring columns AND the `appeal_suggestions` table are
     tenant-RLS-enforced (0007 ENABLE+FORCE+policy); connect AS THE APP ROLE and assert a cross-tenant
     read/write is denied.
   - AI-3 lifecycle: a `status='draft'`/`'rejected'` authored rule NEVER executes (seed one, scrub,
     assert no fire); approve loads it via loadApprovedAuthoredRulesTx; status/active cannot leave an
     approved rule inactive (finding #2 — pick one source of truth and TEST it). persistDraftRule sets
     tenant_id from the app.tenant_id GUC (not a param); the unique (tenant, rule_key, version) index
     makes re-authoring an idempotent upsert, never a cross-tenant clobber.
   - AI-2 tracking: appeal_suggestions stores METADATA ONLY (lengths, verify_score, edit_distance,
     outcome) — assert NO prose column exists and nothing writes prose.
   - llm_calls append-only STILL enforced (0006 REVOKE via migrate.ts) after 0007 — assert UPDATE and
     DELETE denied to the app role; an llm_calls audit row (hashes only) is written per authorRule AND
     per assistAppeal call.
   → database-reviewer agent.
5. E2E + A11Y — Playwright (chromium/firefox/webkit + axe) if installed, else install chromium or use
   the chrome-devtools smoke in gate 6. i18n PARITY (do here): every message key exists in BOTH en.json
   and ar.json — the settings.* authoring keys AND the appeals.* AI-2 keys (aiSuggest, aiDraftLabel,
   aiSuppressed, aiUnavailable, aiDisclaimer, insert, discard). No next-intl onError handler exists, so
   keep parity AND loud missing-message behaviour.
6. RUNTIME SMOKE (chrome-devtools MCP; `run` launches the app, `verify` drives the changed flow) —
   `pnpm --filter @taweed/web dev` (env TAWEED_ENABLE_DEV_AUTH=1 AUTH_SECRET=dev). Dev login is a
   demo-account PICKER — click the owner button. Drive BOTH new surfaces, EN + AR/RTL, light + dark,
   reduced-motion, WCAG AA (lighthouse_audit / list_console_messages zero errors), design-brief §4.3
   digit law (Western digits on weights/amounts):
   - SETTINGS rule-authoring: THREE config states DISTINGUISHABLE — (a) AI OFF → manual-authoring note,
     deterministic library unaffected, no Anthropic call; (b) AI ON but UNCONFIGURED → misconfigured
     signal DISTINCT from off; (c) AI ON + fixture → draft + gate verdict render. Drive the GATE-FAIL
     path (bad rule → blocked stage + reasons, NOTHING persisted) and the APPROVE path (persist DISABLED
     → approve → appears in the library AND the scrubber picks it up). Reject never executes.
   - APPEALS composer AI-2: the deterministic template body renders WITHOUT AI (additive proof); with
     the fixture provider, suggestions appear as clearly-labelled DRAFT blocks the reviewer can
     insert/edit/discard. A suggestion that fails the guardrail chain shows the SUPPRESSED state
     (aiSuppressed), not a silent blank — and the deterministic letter is still complete. No raw
     [SLOT_N] token ever renders (detokenize ran); no invented digit/date/code appears in a suggestion.
7. LATENT-DEFECT HUNT ("possible errors"). Run each reviewer TWICE: (A) deepest on the AI-2/AI-3
   additions, (B) a FULL-PRODUCT sweep across the prior-phase core on main. Money-path integrity
   (resolveRecovery: recovered ≤ appealed, never negative) and deterministic rule/appeal semantics are
   RE-VERIFIED, never modified. Fix findings (guard-rail/RLS/config/audit hardening = root-cause +
   golden-gated; money-path OR deterministic-semantics bug ⇒ STOP-ESCALATE). Invariants as they ARE:
   - AI-3 authorRule: claude-opus-4-8; `import "server-only"`; input type has no claim/patient FIELD
     (but smeText is free text — the guarantee is "no fields", not content-filtered — finding #7);
     routes through runStructured → unskippable llm_calls audit (hashes only); returned draft is
     UNVALIDATED (caller MUST gate + persist DISABLED). The GATE is the moat: shape → engine dry-run →
     golden regression, stops at first failure; WEIGHT clamped [1,100] deterministically; id/version
     from the DB. Registry is the SINGLE SOURCE OF TRUTH; the wire schema is NON-RECURSIVE
     (GroupL1→L2→L3, agreeing with author.ts MAX_GROUP_DEPTH=3). FINDING #1: in/notIn are unsafe under
     the scalar value schema — drop them or add an array-value rule (docs-lookup json-rules-engine
     first). FINDING #2: status/active dual source of truth. FINDINGS #3–#5: AI-3 UI swallows action
     failures, misses draft-error states, lacks aria-live — fix them.
   - AI-2 assistAppeal: claude-opus-4-8; ADDITIVE — the deterministic template stays PRIMARY and an
     appeal works with NO LLM text (generateAppeal signature unchanged). PSEUDONYMIZED input only
     (structured columns → tokens, free text EXCLUDED, DOB → age band); assert no raw identifier or
     free-text clinical note reaches the prompt. SLOT-FILLING: facts are immutable [SLOT_N] tokens, the
     model writes ONLY prose. GUARDRAIL CHAIN fails CLOSED to template-only: assertNoInventedNumbers
     (zero new digits/dates/codes over Arabic+Western digits), slot-presence (every token verbatim),
     glossary term check, second-model verify (AppealVerifySchema, claude-sonnet-5 — low score
     SUPPRESSES + logs), postprocess-ar, detokenize LAST. FINDING #6: wire the ZDR/inference_geo control
     (or document fixture-only) before any live call. appeal_suggestions is METADATA ONLY — never prose.
   - security-reviewer agent + /security-scan: no committed secrets; ANTHROPIC key only from env; both
     draftRuleAction and the assist-appeal action are BILLABLE endpoints — verify the per-(tenant,actor)
     rate limit fires BEFORE the model call (finding #8: it is per-process/in-memory — note the limit);
     server-enforced RBAC on every action; zod input validation; no prompt-injection surface that
     reaches the money path (an authored rule only adds a FLAG; an AI-2 suggestion only adds prose a
     human inserts — neither alters recovery math).
   - healthcare-reviewer agent (MANDATORY — AI-2 is the PHI boundary): assert the pseudonymization is
     applied pre-call and free text is excluded; llm_calls + appeal_suggestions store HASHES/METADATA
     ONLY; the PHI-leak guard covers both new paths; SFDA wording — authored rule messages describe
     BILLING checks and appeal prose argues ADMINISTRATIVE points, never a diagnosis/clinical judgment.
   - silent-failure-hunter agent: no swallowed errors. KILL SWITCHES fail CLOSED — authorRule/assistAppeal
     throw AiDisabledError (feature/tenant flag off) → the caller falls back (manual authoring / template-
     only appeal); AiConfigError (on but unconfigured) → distinct signal. The AI-2 guardrail failure path
     falls back to template-only, never emits an unverified suggestion.
   - typescript-reviewer + react-reviewer agents: hook correctness; server/client boundary
     (packages/ai/features/*.ts and apps/web/lib/{rules-data,appeals-data}.ts `import "server-only"`;
     the client components import only types + actions); the recursive ConditionTree renderer tolerates
     any node shape; a11y on both surfaces (labels, aria-pressed, aria-live, motion-reduce, dir).
   - database-reviewer agent: 0007 correctness (forward-only, re-runnable-from-zero via migrate.ts),
     RLS on the new columns + appeal_suggestions, CHECK constraints hold, no N+1.
   - code-reviewer agent + /quality-gate + production-audit skill on the full diff.
   - /santa-loop on the rules-engine + appeals changes; docs-lookup (Context7) for json-rules-engine
     operator semantics (esp. in/notIn) / zod / drizzle; the claude-api skill before editing any SDK
     call (opus for authoring/assist, sonnet for the verify judge — exact IDs, no date suffix).

FIX DISCIPLINE (every fix):
- superpowers:systematic-debugging — root cause, not symptom; reproduce, then fix.
- superpowers:test-driven-development for any logic bug — failing test FIRST.
- Minimal diff; immutable patterns; match surrounding style.
- Fix the implementation, not the test. Never disable/skip/weaken a gate. If a gate is wrong, fix the
  gate and NOTE it in the ledger.
- Hardening a guard rail (the authoring gate, the AI-2 guardrail chain, RLS, config validation, rate
  limit, the status/active single-source-of-truth, the audit row) is a DEFECT FIX. Adding a NEW
  capability (a new fact/operator/scope, a new AI feature, removing a guardrail check) is NOT — escalate.
- Never autonomously change the money path OR deterministic rule/appeal semantics; keep every LLM
  surface additive + human-in-the-loop; keep the deterministic fallback intact.

AFTER FIXING THIS ITERATION (update the ledger — the loop's memory):
- Regression re-run: gates 1–6.
- PRODUCT_CHANGED = `git status --porcelain` shows any product-source change (EXCLUDING the ledger +
  docs-sync files).
- Update docs/ai-deploy-readiness.md: iteration_counter += 1; if PRODUCT_CHANGED, change_iteration_counter
  += 1; match defects by stable `key` (recur_count += 1 on reappearance); DoD ticks carry {iteration,
  head_sha} and CLEAR on any product change (a tick whose head_sha != HEAD is STALE); a CLEAN PASS =
  gates 1–7, ZERO findings, PRODUCT_CHANGED == false → consecutive_clean_passes += 1 (+ set
  last_clean_head_sha = HEAD); any change/red resets it to 0.
- Print: iteration N — swept [gates], found [K], fixed [K], still-red [list], open HIGH/CRITICAL [list],
  consecutive_clean_passes = X, EXIT DECISION.

=== EXIT DECISION (read from the LEDGER, not memory) ===
- CONTINUE if: any gate red, OR any HIGH/CRITICAL open, OR any DoD tick missing/STALE, OR
  consecutive_clean_passes < 2. Under /loop, ScheduleWakeup for the next iteration; standalone, start it.
- STOP — DEPLOY-READY when, at the CURRENT HEAD: every gate green, every DoD item ticked with head_sha ==
  HEAD, zero HIGH/CRITICAL open, consecutive_clean_passes >= 2. Do the TERMINAL ACTION and END THE TURN
  WITHOUT SCHEDULING. PRECEDENCE: DEPLOY-READY wins over the iteration cap if both fire together.
- STOP — ESCALATE (end turn, no schedule) if a SAFETY CAP trips: a defect's recur_count reaches 3, OR
  change_iteration_counter reaches 12, OR a fix would require touching the money path / deterministic
  rule/appeal semantics / adding a feature / relaxing a compliance gate. Write the blocker + analysis
  to the ledger and hand back to the human.

DEPLOY-READY DoD (ledger checklist — every item ticked with head_sha == current HEAD to STOP):
[ ] root pnpm typecheck green; web typecheck + `next build` green
[ ] root pnpm lint + web next lint clean; prettier clean on changed files
[ ] pnpm test (unit) green — ALL packages; coverage ≥80%; 100% on pseudonymize/postprocess-ar/sha256;
    real branch coverage on the AI-3 gate (author.ts) AND the AI-2 guardrail chain (appeal-guardrails.ts);
    payer-golden green; no regression vs the main baseline
[ ] pnpm test:int green; migrations 0000–0007 apply from a clean DB; RLS enforced on every table incl.
    the new `rules` columns + `appeal_suggestions`; llm_calls append-only STILL enforced after 0007
[ ] AI-3 lifecycle proven: draft/rejected NEVER executes; approve RE-GATES + loads into the scrubber;
    status/active a single source of truth (no approved-but-inactive drift)
[ ] AI-2 additive proven: the deterministic template is complete with NO LLM text; a guardrail failure
    falls back to template-only (SUPPRESSED, not blank); no invented digit/date/code, no raw [SLOT_N]
    ever reaches the UI; appeal_suggestions stores METADATA ONLY (no prose)
[ ] money-path integrity + deterministic rule/appeal semantics RE-VERIFIED unchanged — verified, not modified
[ ] E2E/a11y green OR chrome-devtools smoke: settings authoring AND appeals composer AND the app shell
    work EN+AR RTL × light/dark, reduced-motion, WCAG AA, zero console errors, digit law honored
[ ] config states distinguishable: AI-off graceful (deterministic path, no network call) AND
    AI-on-but-unconfigured fails LOUD (distinct from off) — on BOTH surfaces
[ ] kill switches fail CLOSED (authorRule → manual authoring; assistAppeal → template-only) at every caller
[ ] audit: llm_calls row per authorRule AND per assistAppeal call; HASHES ONLY, no PHI/raw text; PHI-leak
    guard covers both paths; AI-2 pseudonymization applied pre-call + free text excluded (asserted)
[ ] AI-3 gate is the moat: shape → dry-run → golden, stops at first failure; weight clamped [1,100];
    registry the single source of truth; in/notIn resolved (finding #1); AI-3 UI surfaces action
    failures + all draft-error states + has aria-live (findings #3–#5)
[ ] AI-2 guardrail chain proven: slot-presence + assertNoInventedNumbers + glossary + second-model
    verify (suppress on low score) + postprocess-ar + detokenize LAST; ZDR/inference_geo control wired
    or fixture-only documented (finding #6)
[ ] billable endpoints (draftRuleAction, assist-appeal action) have server-enforced RBAC + a per-(tenant,
    actor) rate limit BEFORE the model call + zod input validation (finding #8 noted)
[ ] @taweed/ai + apps/web server modules marked `server-only`; @anthropic-ai/sdk / drizzle / node:crypto
    never enter a client chunk
[ ] i18n key parity en.json ↔ ar.json for all keys incl. the settings.* + appeals.* AI keys; missing-
    message behaviour fails loud
[ ] FixtureProvider is the only provider in CI (no API key for `pnpm test`); raw client + runner NOT
    exported from packages/ai
[ ] reviewers run with no open HIGH/CRITICAL — on BOTH the AI-2/AI-3 additions AND a full-product sweep:
    typescript + react + security + healthcare + silent-failure + database + code-reviewer; /quality-gate
    + production-audit + /security-scan clean
[ ] no secrets committed; ANTHROPIC key only from env; no money-path/semantics touch; live pseudonymized-
    PHI AI-2 flag stays OFF pending BLK-AI-1 + BLK-AI-2
[ ] git diff main...HEAD reviewed end-to-end; no debug logs / stray console.* / TODO regressions

TERMINAL ACTION (only on STOP — DEPLOY-READY). HUMAN-GATED: an autonomous loop must NOT force-push or
merge to main by itself. Do a–d, then STOP for a human.
a. Docs sync: update docs/handoff.md (AI-2/AI-3 hardened + deploy-ready; the SME-edit-tracking metric;
   repo map incl. the two new surfaces + migration 0007); sync docs/blocker.md (BLK-AI-1/BLK-AI-2 gate
   live AI-2 pseudonymized-PHI calls; BLK-9 note on AR rule/appeal text; none block the fixture path);
   rewrite docs/NEXT_STEP_PROMPT.md to point at PROMPT 3 (AI-4) of §9; update the Obsidian brain
   ~/Desktop/ObsidianVault/Projects/Taweed (NPHIES).md "Build progress". Leave the ledger as the trail.
b. superpowers:verification-before-completion, then /checkpoint.
c. Commit everything on ai-phase-2-3 (conventional commits) and push the BRANCH (no force):
   `git push -u origin ai-phase-2-3`. Open a PR into main with the DEPLOY-READY report as the body.
d. Print the final report and STOP-FOR-HUMAN-MERGE (do NOT reschedule, merge, or force-push). Include
   the merge+back-up ritual for the operator: capture OLD = pre-merge main tip BEFORE merging
   (`set OLD (git rev-parse origin/main)`); SQUASH-merge if the "back-up one commit behind main"
   invariant is wanted; then `git branch -f back-up $OLD && git push -f origin back-up`; THEN
   `git push origin main`; and REFUSE the ritual if origin/main advanced past START_MAIN since the loop
   began.

Blockers: the fixture/synthetic path + deterministic fallback pass every gate with NO blocker. BLK-AI-1
(counsel) + BLK-AI-2 (ZDR org) gate any LIVE pseudonymized-PHI AI-2 call — keep the per-feature flag
OFF until both are recorded cleared in docs/blocker.md. BLK-9 (SME sign-off) gates any Arabic rule
message or appeal reaching a real clinic. The loop does not merge to main — a human does, after review.
```

---

## Notes

- **PROMPT 2 is a full LLM layer with a deterministic floor — that shapes the loop.** AI-3 proposes a
  scrubber-rule DRAFT gated by shape → dry-run → golden and human approval; AI-2 suggests appeal
  paragraphs on top of a deterministic template that is complete on its own. The loop hardens the guard
  rails so no model output reaches production un-gated, and never edits the deterministic core.
- **Two moat surfaces to keep honest:** the AI-3 authoring gate (`rules-engine/author.ts`) and the AI-2
  guardrail chain (`packages/ai/appeal-guardrails.ts`). Both must fail CLOSED — an un-gated rule never
  executes, an unverified suggestion never renders; both prove it with tests. The money path and the
  deterministic rule/appeal semantics stay untouched (re-verified, escalated if buggy).
- **Durable ledger is the loop's memory:** iteration counters, the clean-pass streak + last_clean_head_sha,
  per-DoD tick provenance, the defect log with stable keys + recur_count. Every termination decision
  reads the ledger, not recollection.
- **Termination is explicit and bounded:** two consecutive full (gates 1–7) zero-change clean passes
  with all DoD ticks fresh. SAFETY CAPS (recur_count 3, 12 change-making iterations, or a fix that would
  breach the money path / deterministic semantics / add a feature / relax a gate) force ESCALATE.
- **Terminal action is human-gated:** the loop commits, pushes the branch, and opens a PR — it does NOT
  merge to main or force-push `back-up`. A human reviews and runs the merge+back-up ritual.
- **PHI + blockers:** AI-3 hardens on the fixture path (its input carries no claim fields). AI-2 sends
  pseudonymized context — fixture-path hardening needs no blocker, but any LIVE call stays gated by
  BLK-AI-1 + BLK-AI-2, and any AR text to a clinic by BLK-9. Keep the live flag OFF; verify the fixture
  path + deterministic fallback.
- **Findings folded from the audit (verified where noted):** (1) `in`/`notIn` — HIGH, a "gender is
  female" rule fires for male claims via substring match; (2) authored-rule `status`/`active` dual
  source of truth; (3–5) the AI-3 approval UI swallows action failures, misses draft-error states, and
  lacks `aria-live`; (6) AI-2 ZDR/`inference_geo` asserted in comments but not set on the request; (7)
  "PHI-free by construction" is really by-policy for free-text inputs — pseudonymization + free-text
  exclusion is the real AI-2 control; (8) the billing rate limit is per-process/in-memory; (9) the
  golden regression corpus is only 2 cases, plus a dead `? 0 : 0` ternary and a vacuous
  "+ custom operators" clause. Re-run every gate against the live HEAD — the observed green baseline was
  captured while the build was still in flight.
- **Tool roster mapped to gates:** CLI (pnpm/rtk/docker/gh), MCP (chrome-devtools for the two UIs,
  Context7/docs-lookup for json-rules-engine operator truth + SDK IDs), agents (build/type/security/
  healthcare/silent-failure/react/database/code reviewers, e2e-runner), skills (systematic-debugging,
  TDD, test-coverage, run/verify, security-scan, production-audit, quality-gate,
  verification-before-completion, checkpoint, santa-loop).
