# Resume — PROMPT 2 (AI-2 appeal assist + AI-3 rule authoring)

> Written mid-session (2026-07-06) because the session is near its limit. Picking up
> `docs/04_agentic_retrofit_plan.md` §9 **PROMPT 2**. Both features are BUILT and
> GREEN; what remains is UI browser-verify, multi-lens review, docs sync, and the git
> merge ritual. Branch: **`ai-phase-2-3`** (in-place, per §9 invariant 1). NOT yet
> committed. `main` untouched.

## State at handoff (all verified this session)

- **Unit: 334/334 green** (baseline was 284). **Integration: 31/31 green** (baseline 24).
- **Root + web typecheck: clean.** **`pnpm lint`: 0 errors** (2 pre-existing `no-control-regex`
  unused-disable *warnings* in files I did NOT touch — leave them).
- Migration **0007 applies cleanly** against local Postgres (verified via the integration run).
- Local Postgres is UP (`docker compose up -d` already done; `docker compose exec` hangs on this
  machine — the daemon is flaky — but the container is port-mapped and tests connect via
  `localhost:5432`). `chrome-devtools` / Playwright cannot run locally (Node 20.2.0) — CI covers E2E+a11y.

## What was built

### AI-3 — NL → ScrubRule authoring (COMPLETE)
The deterministic **gate** is the safety core: `shape → engine dry-run → golden-corpus regression`.
Nothing an LLM emits executes until it passes the gate AND a human approves.

- `packages/rules-engine/src/registry.ts` — single source of truth: `AUTHORABLE_FACT_KEYS`,
  `SCRUB_OPERATORS`, array/numeric fact sets, type guards. (`CLAIM_FACT_KEYS` is `satisfies keyof ClaimFacts`.)
- `packages/rules-engine/src/golden.ts` — extracted `PAYER_GOLDEN_CASES` + `goldenFacts` so the
  golden TEST and the authoring GATE pin behaviour against the same corpus.
- `packages/rules-engine/src/author.ts` — `validateDraftShape`, `draftToScrubRule`, `dryRunRule`,
  `checkGoldenRegression`, `validateAuthoredRule` (the full gate). `AuthoredConditionNode` group
  variant has optional `all`/`any` so the bounded zod schema is assignable to it.
- `packages/ai/src/schemas/scrubRuleDraft.ts` — bounded, **non-recursive** zod (structured outputs
  reject recursion), `z.strictObject` everywhere (disambiguates leaf vs group + `additionalProperties:false`),
  `z.enum` on the registry lists.
- `packages/ai/src/features/authorRule.ts` — Opus via the existing audited `runStructured`; SFDA-safe
  system prompt; returns `{draft, model, promptSha256}` for provenance.
- `packages/db/drizzle/0007_authored_rules_and_appeal_suggestions.sql` + `packages/db/src/schema.ts`
  — `rules` table EXTENDED (rule_key, name, field, weight, payer_id, authored_by, prompt_sha256,
  model, status draft|approved|rejected, rationale, created_by/at) + unique `(tenant,rule_key,version)`;
  `appeal_suggestions` table added (RLS). Both in `TENANT_SCOPED_TABLES`.
- `apps/web/lib/rules-data.ts` — `loadApprovedAuthoredRulesTx`/`loadApprovedAuthoredRules`,
  `listAuthoredRules`, `persistDraftRule` (upsert, status='draft', active=false), `setRuleStatus`,
  `getAuthoredRule`, `authoredRowToScrubRule`, `getTenantPayers`.
- `apps/web/lib/data.ts` — `getScrubRows` now runs `SCRUBBER_RULES` **+ approved authored rules**
  (the payoff: approved rules execute in the live scrubber).
- `apps/web/lib/actions/author-rule.ts` — `draftRuleAction` (RBAC settings full|rules, rate-limited,
  generate → gate → persist-disabled; AiDisabled→manual fallback, AiConfig→misconfigured), plus
  `approveRuleAction` (RE-gates against current library before flipping), `rejectRuleAction`. Audited.
- `apps/web/components/modules/rule-authoring.tsx` — draft flow, readable condition-tree renderer,
  gate verdict (pass / blocked-at-stage + errors), approve/reject, authored-rule list. Both locales/themes,
  reduced-motion, a11y (aria-pressed/region, sr-only labels).
- Wired into `apps/web/app/[locale]/(app)/settings/page.tsx` as an "Author" tab (rcm/owner/admin only).
- i18n keys added to `apps/web/messages/{en,ar}.json` `settings`.
- Tests: `packages/rules-engine/test/{registry,author}.test.ts` (+ golden test refactored to shared corpus),
  `packages/ai/test/authorRule.test.ts` (unit kill-switch + schema), `packages/ai/test/authorRule.int.test.ts`
  (audited path over RLS: purpose='author_rule', AR digit-law, provenance, tenant kill switch, provider-exception audit).

### AI-2 — additive EN/AR appeal assist (COMPLETE)
Structural anti-hallucination: **the model never sees or writes a real number** — every amount/date/code
is a digit-free slot token; any literal digit in the output = invented → suppress (fail closed to template).

- `packages/shared/src/glossary.ts` — bilingual NPHIES/appeal term map + `glossaryPromptLines`.
- `packages/shared/src/edit-distance.ts` — `levenshtein` (SME-edit metric). + tests.
- `packages/ai/src/appeal-guardrails.ts` (PURE, exhaustively tested) — `buildFactSlots` (digit-free tokens),
  `slotLegend`, `assertNoInventedNumbers` (Western+Arabic-Indic+Extended digit scan after stripping known
  tokens), `unknownSlots`, `detokenizeSlots`, `checkParagraphs`. Also defines `AppealSuggestion` locally
  (structurally identical to `@taweed/appeals` — avoids a cross-package dep).
- `packages/ai/src/schemas/appealAssist.ts` — `AppealAssistSchema` (paragraphs_en/ar) + `AppealVerifySchema`
  (judge scores). Both `z.strictObject`.
- `packages/ai/src/features/assistAppeal.ts` — the full chain: pseudonymize member id (AI-0
  `pseudonymize`) → build fact slots → **generate** (Opus) → **deterministic paragraph gate**
  (no invented numbers / unknown slots / empty) → **second-model verify** (Sonnet judge, threshold 60) →
  **detokenize** (real values) → **AR post-process** (full digit+bidi law on AR; digit-only on EN). Free
  text (clinicalNote) EXCLUDED by default. Both model calls audited. Returns `{ok, suggestion, verifyScore,
  model, charsEn, charsAr}` or `{ok:false, suppressed, reason}`. **Ordering fix landed:** detokenize BEFORE
  AR post-process (else bidi marks break slot tokens) — the one bug found + fixed in AI-2 int.
- `packages/appeals/src/types.ts` — `AppealDraft.suggestedParagraphs?` + `AppealSuggestion` (additive).
- `apps/web/lib/appeals-data.ts` — `recordSuggestion`, `recordSuppressedSuggestion`,
  `updateSuggestionOutcome` (metadata only, RLS).
- `apps/web/lib/actions/assist-appeal.ts` — `assistAppealAction` (RBAC appeals full|approve|review|evidence,
  rate-limited, records suggestion/suppressed row), `recordSuggestionEditAction`.
- `apps/web/components/modules/appeals-composer.tsx` — additive DRAFT-block panel: Suggest → editable
  per-paragraph blocks → Insert (appends to body, records `levenshtein` edit distance + outcome) / Discard.
  Graceful disabled/suppressed/unavailable states. i18n keys added to `appeals`.
- Tests: `packages/ai/test/appeal-guardrails.test.ts` (the safety core — invented-number EN+AR, unknown-slot,
  detokenize, checkParagraphs fail-closed), `packages/ai/test/assistAppeal.test.ts` (unit kill-switch),
  `packages/ai/test/assistAppeal.int.test.ts` (2 audited calls, detokenized output with real values,
  suppression on invented number [verify skipped], suppression on low verify, tenant kill switch),
  `packages/shared/test/edit-distance.test.ts`.

## Key design decisions (so a reviewer doesn't relitigate)
- Existing `anthropic-1p.ts` + `runStructured` handle Opus/Sonnet structured output unchanged
  (`messages.parse` + `zodOutputFormat`, no `thinking` param) — **no new SDK code**. config.ts +
  migration 0006 already reserved `appeal`/`authorRule` purposes.
- Gate lives in `@taweed/rules-engine` (the authority on rule validity); `@taweed/ai` only generates.
- `golden` regression matters most for a **version bump of an existing rule id**; a brand-new key almost
  always passes (documented in author.ts).
- AI-2 uses AI-0 `pseudonymize` for the member id (its `[MEMBER_ID_1]` token is stripped before the
  digit check); fact slots are a separate digit-free scheme. Free text is never sent.

## REMAINING before merge (do these next, in order)

1. **chrome-devtools MCP verify** the two new UI surfaces (settings→Author tab; appeals composer AI panel)
   — EN + AR RTL × light/dark, a11y, reduced-motion, §4.3 digit law. (Local Playwright blocked by Node
   20.2.0 — the AI-1 pass verified via the cached/no-key path; do the same or rely on CI E2E+a11y. If you
   can't drive a browser, say so explicitly and lean on the CI `e2e` job.)
2. **Multi-lens review** on the diff: `typescript-reviewer` + `security-reviewer` + `healthcare-reviewer`
   (LLM/PHI boundary). `/santa-loop` on the rules-engine + appeals changes. Fix CRITICAL/HIGH; adversarially
   verify findings before acting. Watch especially: PHI never reaching the model (AI-2 slot/pseudonymize),
   money-path untouched, RBAC server-enforced, audit-on-every-call.
3. **`superpowers:verification-before-completion`** — re-run `pnpm typecheck`, `pnpm lint`, unit + integration
   (need `docker compose up -d` + `DATABASE_URL=postgres://taweed:taweed@localhost:5432/taweed`), `pnpm build`.
4. **Docs sync (§9 invariant 2, mandatory):** update `docs/handoff.md` (AI-2/AI-3 status, new surfaces,
   SME-edit metric, repo map: packages/ai new files, migration 0007, appeal_suggestions, rules extension);
   `docs/blocker.md` (BLK-AI-1/2 gate live pseudonymized-PHI calls; BLK-9 note on AR letters);
   rewrite `docs/NEXT_STEP_PROMPT.md` → PROMPT 3 (AI-4 vision extraction); update
   `docs/04_agentic_retrofit_plan.md` §6 phase table (AI-2 ✅ AI-3 ✅); Obsidian brain
   `~/Desktop/ObsidianVault/Projects/Taweed (NPHIES).md` "Build progress".
5. **Git ritual (§9 invariant 3, EXACT order):** commit on `ai-phase-2-3` (conventional commits) →
   merge into `main` in THIS dir → `OLD=<main tip before merge>; git branch -f back-up $OLD &&
   git push -f origin back-up` → then `git push origin main`. Verify `back-up` is exactly one behind `main`.

## Blockers honored in code
- Live pseudonymized-PHI calls stay OFF (per-feature env flag) until BLK-AI-1 (counsel) + BLK-AI-2 (ZDR org)
  are recorded cleared in `docs/blocker.md`. Synthetic-data operation is unrestricted. BLK-9 gates any AR
  letter reaching a real clinic. All three features fail CLOSED (kill switches: global env + per-feature env
  + per-tenant DB flag → `AiDisabledError` → deterministic fallback).

## Env quirks (recap)
- pnpm at `~/.local/bin`; fish shell but the RTK re-exec runs zsh → avoid fish `for..end`; use `env VAR=val`
  prefix. RTK compresses test/tsc/eslint stdout → write JSON/txt to a file and parse. `timeout` binary is
  NOT on PATH here. Node v20.2.0 → Next 15.
- Test JSON parse helper used all session:
  `node -e "const r=require('<file>'); console.log(r.numPassedTests+'/'+r.numTotalTests, r.numFailedTests)"`.
