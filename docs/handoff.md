# Handoff — start here (next session)

> Entry point for a new Claude Code session picking up Taweed. Read this, then run the
> next-step prompt (`docs/NEXT_STEP_PROMPT.md`). Blocker register + a per-blocker unblock prompt:
> `docs/blocker.md`. Written 2026-07-04; last refreshed 2026-07-16 (newest entries at the end of the
> log below: the real-tester bug-fix pass + the 2026-07-16 docs-only follow-ups — blocker.md,
> review.md AI-4 eval sync, and deferred.md/DEF-1 — are all merged and pushed to `origin/main`, CI
> green). Earlier context (kept for history): 2026-07-10 (**the EXECUTE UI tail — A2
> first-run corridor + A3 free-audit/owner reports — is now BUILT** on branch `execute-ui-tail`, in
> this directory, not yet merged to `main`; see the new bullet in "Where the project stands" below
> and `docs/NEXT_STEP_PROMPT.md` for what comes after). Earlier the same day: **a full 6-pass
> code-quality audit sweep done and merged to local `main`** — bug hunt, security, API/action
> auth-checks, dependency CVEs/abandonment, WCAG AA accessibility, and a codebase-minimap weakness
> sweep; see `docs/audit.md` for the consolidated runbook + all findings/fixes. That sweep was an
> orthogonal code-quality initiative, NOT product work. **PROMPT 3 = AI-4 vision EOB/PDF extraction
> remains BUILT** on branch `ai-phase-4` (merged to `main` before the audit sweep) — synthetic-only,
> dual-gated, additive, fail-closed. This closes out `docs/04_agentic_retrofit_plan.md` §9 entirely:
> AI-0 through AI-4 are all built and merged, confirmed again 2026-07-10 — **there is no PROMPT 4 in
> that plan and none was added.** The real-data headline (BLK-1/2/9) remains independently pending.
> **A working Claude API key is already filled in at `apps/web/.env.local` (`ANTHROPIC_API_KEY`,
> added 2026-07-10) and ready to use — the key itself is not reproduced here since this file is
> committed to git. `TAWEED_AI_ENABLED` and all per-feature AI flags remain OFF; the user wants to
> test manually before enabling anything.**
> **2026-07-10, later the same day: the B6 field-mapping panel is BUILT, MERGED, and PUSHED to
> `origin/main`** (commit `80b1698` on `b6-field-mapping-panel`, merge `ff2e438` `--no-ff` into
> `main`, feature branch deleted post-merge). This was the last remaining buildable EXECUTE Tier 3
> item (`docs/superpowers/plans/execute-phase.md`) — the EXECUTE build plan's buildable scope is now
> fully complete. `back-up` re-pointed to the pre-merge main tip (`a851d4d`) and force-pushed BEFORE
> `main` was pushed; verified `back-up` sits exactly one commit behind `main` post-push. Full unit
> suite (861/861) + typecheck re-verified on the merged `main` tip before pushing. See the bullet in
> "Where the project stands" below, and the "⚠ MONEY-PATH CHANGES — EXTRA SCRUTINY REQUESTED" callout
> there for what shipped and why it got extra review.
> **2026-07-10, still later the same day: the AI-4 real-data-gaps unit (synthetic-EOB→PDF rasterizer
> + adjustment/withholding bucket) is BUILT, MERGED, and PUSHED to `origin/main`** (merge `00c7dfe`,
> `back-up` ritual completed, `ai4-real-data-gaps` deleted post-merge, CI green on the pushed tip).
> Closes both AI-4 real-data-*enablement* gaps `docs/NEXT_STEP_PROMPT.md` flagged after B6. Unit 902/902,
> integration 42/42, typecheck/lint/build all green; multi-lens review + adversarial verify run
> (6/6 confirmed findings fixed), plus a dedicated two-round money-path adversarial pass on the new
> 5-bucket arithmetic validator (4 real gaps found and fixed — see the bullet in "Where the project
> stands" below and its "⚠ MONEY-PATH CHANGES — EXTRA SCRUTINY REQUESTED" callout).
> **2026-07-10, still later the same day: doc-sync correction, no code change.** The Scrubber
> `<tr role="button">` a11y item `docs/NEXT_STEP_PROMPT.md` pointed at as the last pickable item was
> already fixed by the WCAG AA audit sweep (commit `516e72d`); `docs/review.md` §2.11 just never said
> so. Corrected in place, reconfirmed via a passing `scrubber-table.test.tsx` (7/7). There is now no
> self-contained buildable unit left at all — see the new bullet in "Where the project stands" and
> `docs/NEXT_STEP_PROMPT.md`.
> **2026-07-16: first real-tester bug-fix pass — 5 confirmed defects fixed, 2 investigated and
> found already-correct, all verified live against the real Anthropic API and a real Postgres
> instance (not fixtures).** A tester on Docker/Windows filed a bug list (screenshots) after
> following README + `docs/review.md`; §1.11's automated suite was run first (confirmed green —
> the fixtures/mocks never exercised any of these), then every item was reproduced and root-caused
> live via chrome-devtools MCP before fixing. See the bullet in "Where the project stands" below
> for the full breakdown. **Two real, previously-undetected product bugs were the actual root
> cause of the "AI is always off" reports** — not a config/docs gap as first hypothesized — caught
> only because this was the first time AI-1 and AI-4 were driven against the live API with a real
> key instead of the fixture provider used everywhere in CI and prior manual passes. Unit
> **1007/1007** (up from 902), integration **42/42**, typecheck/lint/build all green. **Now merged
> and pushed to `origin/main`** (`034c2ed`), followed by a git-workflow doc sync (`92e7dfb`) and a
> pnpm-lock regen for the pinned pnpm 11.13.0 (`a5c6d9e`); CI green on the pushed tip.
> **2026-07-16, docs-only follow-ups (no product code changed), both pushed to `origin/main` with CI
> green:** (1) **`docs/blocker.md` reconstructed and force-added to git** (`git add -f`; it was
> historically gitignored/local-only, so `BLK-*` references dangled in a fresh clone) — sourced from
> `04_agentic_retrofit_plan.md §8` + `review.md §2.14`; marks **BLK-AI-2 partial** (technical
> `ANTHROPIC_API_KEY` added → live calls on synthetic/PHI-free inputs only; ZDR + DPA still open).
> `review.md`'s AI-4 eval notes (§1.11, §1.8 Step 3b, §2.9, §2.11, §2.12, §2.14) were synced to say
> both former blockers on a live `AI_EVALS_LIVE=1` scored pass are gone (rasterizer built 2026-07-10
> + key configured) — only manual execution + review of the 98%/95% accuracy remains (commit
> `9fecdcd`). (2) **`docs/deferred.md` created** — a `DEF-*` registry of deliberately-parked build
> decisions; first entry **DEF-1** (text-layer-first EOB extraction routing) parked after a cost
> calculation (negligible savings at pre-pilot volume; no compliance benefit as designed; not the
> highest-value next step) with revisit triggers; cross-linked from `review.md`, `handoff.md` (this
> doc's must-read index), and `blocker.md` (commit `552dbcb`). No test/typecheck deltas — docs only.
> **2026-07-17: FHIR R4 validator full audit — DONE, pushed (`main` = `0c8f800`).** `packages/fhir`'s
> base-R4 validator gained full nested-element SHALL checks (was 7-8 top-level fields only); a real
> `ClaimResponse.outcome` semantics bug (denial-amount-keyed instead of processing-status-keyed)
> found and fixed beyond cardinality gaps. NPHIES-profile stub confirmed correctly untouched
> (boundary research: public conformance page is license-gated-too, no exception).
> **2026-07-17, same day: both queued next-step items done in parallel (no file overlap), pushed.**
> (1) The `eob-to-normalized.ts:184` twin of the outcome-semantics bug — investigated first (did not
> assume it matched the CSV path blind): traced the AI-4 EOB-OCR pipeline and confirmed a failed/
> inconsistent extraction is rejected in `eob-review.ts` *before* the normalizer ever runs, so there
> is no reachable processing-error signal on this path either — same fix, `outcome` is unconditionally
> `"complete"`. (2) Owner-report discoverability — a second header link ("Build the owner report") on
> `/analytics` next to the existing audit-report CTA, real (non-machine-translated) Arabic label, new
> component test, live-verified via chrome-devtools MCP across EN/AR × light/dark (a mid-session dev-
> server restart was needed — a corrupted `.next` webpack chunk manifest from prior hot-reload churn,
> same known class of issue noted elsewhere in this file, fixed by `rm -rf apps/web/.next` + restart).
> See the new bullet in "Where the project stands" and `docs/NEXT_STEP_PROMPT.md` for what's next.
> **2026-07-17, `/autopilot` pass, same day: `docs/review.md` gap-filled + entire §1.8 walkthrough
> live-driven via chrome-devtools MCP, Sonnet 5 throughout (no GLM).** Zero product code defects
> found; one self-inflicted environmental issue (shared dev DB wiped by this session's own earlier
> integration-test runs, not re-seeded) fixed via re-seed. 3 parallel Sonnet reviewers (architecture/
> correctness, security, quality) — all ACCEPT, round 1. Full breakdown in "Where the project
> stands" below.
> **2026-07-18: AI-4 eval scoring bug fully fixed + real numbers, plus a 6-domain KSA compliance
> audit — DONE, pushed (`main` = `ee9c9e5`).** The live scored eval initially reported near-zero
> accuracy from a corpus-rendering bug (ground-truth `claimId`/`patientRef`/`serviceDate` never
> printed into the actual PDF the model sees); fixed at the source plus a matching-key fix in
> `scoring.ts`. Real 40-item × 2-tier run: Sonnet 96.6% overall / 100% amounts (meets both
> documented targets), Opus 87.1% overall / 100% amounts. Separately, a 6-domain KSA regulatory
> compliance sweep (SFDA, SAMA, business registration, SDAIA, NPHIES vendor terms, PDPL) found no
> confirmed non-compliant gap; new items queued in `docs/HUMAN_CONFIRMATION_NEEDED.md` §G. Full
> breakdown in "Where the project stands" below; branch-scoping is the next buildable item per
> `docs/NEXT_STEP_PROMPT.md`.
> **2026-07-18, same day, size-diversity follow-up: grew the corpus 40→44 items (9→11 scenarios),
> caught and fixed a REAL production bug.** Two new scenarios stress-test the size extremes
> (`minimalSingleLine`: 1 claim/1 line; `denseLargeRemittance`: 8 claims × 6 lines, a real 4-page
> PDF). The large one immediately reproduced a genuine `extractEob.ts` failure: Claude Sonnet 5 runs
> adaptive thinking on by default, drawing from the same `max_tokens: 8192` ceiling as the response
> — on this document, thinking left too little room and the JSON output truncated mid-string
> (`stop_reason: "max_tokens"`), a hard parse failure, not a scoring artifact. Confirmed via a live
> isolated repro; fixed in production code (`maxTokens` → `32768`). Re-ran the full 44-item × 2-tier
> corpus clean: **Sonnet 98.1% overall / 100% amounts** (exceeds both targets by a wider margin than
> the 40-item run), **Opus 83.5% overall / 99.9% amounts** (codes weaker at scale). Two new manual
> walkthrough fixtures (`eob-3-minimal-single-line`, `eob-4-dense-large-remittance`) added to
> `docs/test-fixtures/` per this repo's fixture-location convention. Full breakdown in "Where the
> project stands" below.
> **2026-07-18, later the same day: full branch-scoping (design-brief §7) landed for Appeals +
> Recovery — Ingest stays a deliberate non-story.** Orchestrated via the GLM hub-spoke
> orchestrator (2 sequential `glm-code` spokes, one per story — sequential, not parallel, since
> both touch `apps/web/test/data.test.ts`), hub-verified with fresh evidence at every stage
> (tsc, full workspace `vitest run`, `lint`, `build`, chrome-devtools MCP live drive-through
> EN+AR), then 3 parallel Sonnet reviewers (architecture/correctness, security, quality) — all
> three ACCEPTED, 3 non-blocking nits fixed inline. `getAppealables`/`getRecovery` gained an
> optional `branchId` param (parameterized, RLS-safe); Recovery's three surfaces (money,
> pipeline rows, win-rate/median-days aggregate — the last one converted from a bare
> `FROM appeals` to the same join chain `appealPipelineRows` already used) move together, proven
> live: Recovered SAR 66,275→20,512, win rate 66.7%→67.1%, Won 25 of 160→25 of 53 for one real
> seeded branch; command-bar's global money indicator confirmed unfiltered throughout. A real
> regression was caught and fixed during the hub's own full-suite run (not by either spoke): 4
> sibling test files (`recovery-page-dark-contrast`, `recovery-pipeline-action-row-aria-label`,
> `recovery-pipeline-actions-header`, `recovery-pipeline-row-cap-badge`) each separately mock
> `@/lib/data` for the Recovery page and broke once it started calling `getBranches`/
> `resolveBranchId` unconditionally — fixed with the same 2-line mock addition across all four.
> Ingest intentionally NOT touched (`eob_extractions` has no `branch_id` column, no derivable
> join path — a schema decision, not a story, per the spec's own recommendation). **A reviewer
> flagged (then the hub independently disproved) a false-positive finding:** the architecture
> reviewer noted `appeals/page.tsx` has no `isVisible()` RBAC gate despite reading PHI, unlike
> `recovery/page.tsx`'s explicit check — but `rbac.ts`'s own `MATRIX` shows `appeals` is never
> `"hidden"` for ANY role (owner/finance/rcm/clinician/admin all get some visible capability
> level), unlike `recovery` where clinician IS `"hidden"` — so no gate is needed there by design;
> the write-side is separately gated via `authorizeAction("appeals", ...)` in
> `lib/actions/{appeals,assist-appeal}.ts`. Verified before writing this note, not left as an
> open question. 12 files changed, 304 insertions / 34 deletions. Full workspace suite
> 1083/1083 (0 fail, 3 skipped pre-existing). **Not committed** — awaiting the user's go-ahead
> per the standing merge/push gate. See the new bullet in "Where the project stands" below and
> `docs/NEXT_STEP_PROMPT.md` for what comes after.
> **2026-07-18, later still: `/audit-workflow`'s item 1 (bug hunt) run + committed + pushed
> (`ce2c7b5`).** 4 GLM find-only spokes surfaced 4 confirmed bugs (a TOCTOU double-recovery race in
> `markAppealOutcome`, a silent zero-fold on missing FHIR amounts in `normalize.ts`, a clinician
> dead-end CTA, a duplicate-CSV-header Select collision) + 1 carried-over still-open item from the
> 2026-07-08 sweep (`InMemoryObjectStore` missing its production guard). All 5 fixed and
> hub-verified (tsc clean, unit+integration **1092/1092**, lint baseline, build green). All
> scattered audit bookkeeping files (`bugs.md`/`secure.md`/`audit.md`/`minimap.md`) consolidated
> into `docs/audit docs/` (force-added to stay tracked despite the directory-level `.gitignore`).
> **Items 2-8 of the 9-item queue are PAUSED — GLM 5h quota hit 100% mid-item-1** (2 fix spokes
> died silently right at their report-writing step, code already complete — verified via `git
> diff`, not re-fired). Resume once a confirmed reset lands. Item 9 (production readiness) is
> gated off entirely — not public-facing yet, tracked in `docs/audit docs/audit.md`.

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
- **AI phase — AI-4 DONE (synthetic-only, dual-gated), built 2026-07-08 (PROMPT 3), branch
  `ai-phase-4`.** `ClaudeVisionOcrAdapter` (sonnet-first, escalates to opus on validator failure OR
  a thrown call — both failure modes, not just one), behind the `EobExtractionAdapter` seam in
  `@taweed/ingest`. Deterministic validators (`packages/ai/src/eob-validators.ts`): cross-claim-total
  arithmetic, PDF-text-layer match, denial-code enum defense-in-depth. Migration `0009` adds
  `eob_extractions` (RLS ENABLE+FORCE, tenant-isolated, `pending_review`/`approved`/`rejected`).
  New Ingest-page "Review queue" tab: every extraction is human-reviewed/corrected before anything
  reaches a real claim record; approving **re-runs the arithmetic validator on the human-edited
  values** so an edit can't silently break the totals. Eval harness scaffolded (`packages/ai/evals/`)
  but **has never scored a real pass** — the synthetic corpus (`test/synthetic-eob`) generates
  ground-truth + an HTML template only; rasterizing to an actual PDF is a documented
  `TODO(ai-route)`, not yet built. **AI-4 is the one feature that breaks the "PHI-free by
  construction" property the rest of the AI layer holds** (a real PDF would carry genuine PHI with
  no way to redact it pre-call) — that's exactly why it's scoped to synthetic PDFs only pending the
  BLK-AI-1/3/4 route decision + counsel sign-off, not a flag to flip casually. Verified: unit
  444/444 + integration 37/37 green, root+web typecheck/lint clean, `apps/web` production build
  green (a real risk given `pdf-parse`/`@napi-rs/canvas`'s native binary — needed an explicit
  webpack `externals` fix beyond `serverExternalPackages` alone). Multi-lens review
  (typescript/security/healthcare) run with adversarial verification; findings fixed — escalation
  now triggers on a thrown call not just a failed validator, `textLayer` now actually reaches the
  adapter end-to-end, the extraction timeout raised to 90s for PDF+vision, the reviewer UI now
  surfaces validator findings instead of discarding them, and approve re-validates arithmetic on
  edited values. Also ran a taste-skill design audit against `.claude/rules/ecc/web/design-quality.md`
  (code-level only — local Playwright/chrome-devtools is blocked on this machine's Node 20.2.0):
  the frontend was already a disciplined token-based system, not templated slop; three small fixes
  landed (a missing focus ring on a keyboard-operable Scrubber row, two chart files' duplicated
  SVG-only hex colors centralized into `apps/web/lib/chart-colors.ts`, and the one stray literal
  emoji found anywhere in shipped product code — a `⚠` in the i18n missing-message fallback string
  — removed). `docs/review.md` rewritten across both halves (testing guide + technical review) to
  cover AI-4, the Settings-tab use cases, and how to add Scrubber/Appeals test claims without
  re-seeding.
- **Two known real-data-enablement gaps for AI-4** (tracked, not blockers on today's synthetic
  build): the synthetic-EOB→PDF rasterizer doesn't exist yet, so the eval harness's 98%/95%
  accuracy thresholds are aspirational, unproven; and the extraction schema's 4-bucket money model
  (billed/paid/patient-share/rejected) has no adjustment/withholding case, so a real remittance with
  a contractual write-off wouldn't cross-total and could get stuck permanently un-approvable. See
  `docs/review.md` §2.11 and the AI-4 row in `docs/04_agentic_retrofit_plan.md` §6.
- **Code-quality audit sweep — DONE, merged to local `main` (2026-07-10), orthogonal to product
  work.** 6 passes, each: parallel finder/mapper agents by area → adversarial verify (default-to-
  refute) → every CONFIRMED finding fixed with a regression test → full typecheck+lint+unit+
  integration+build re-run before commit. See `docs/audit.md`'s "Audit history at a glance" table
  for the full index. Summary: **bug hunt** (21 fixed, `docs/bugs.md`) → **security** (10 fixed,
  `docs/secure.md`) → **API/server-action auth-checks** (15 fixed, inline) → **dependencies** (10
  CVE advisories → 0, `docs/deps.md`) → **WCAG AA accessibility** (25 fixed across all 9 routes ×
  EN/AR × light/dark, `docs/a11y.md`) → **codebase minimap** (14 of 30 candidate weaknesses fixed,
  `docs/minimap.md` — gitignored/local-only, the only pass whose doc isn't committed). Current
  totals after all 6 passes: unit **708/708**, integration **42/42**, root+web typecheck clean,
  lint 0 errors, `apps/web` production build green.
- **EXECUTE UI tail — A2 + A3 — DONE (synthetic data), built 2026-07-10 on branch `execute-ui-tail`
  (in this dir, NOT yet merged to `main`).** The two product units independently pending since
  before the AI phase started, per `docs/superpowers/plans/execute-phase.md` Tier 3:
  - **A2 first-run corridor** — a tenant with no captured `recovery_baselines` row (EXECUTE B8) is
    routed to `/onboarding` instead of its normal landing module (`apps/web/lib/onboarding.ts`'s
    `isOnboarded`, wired into `apps/web/app/[locale]/page.tsx` and the onboarding page's own bounce-
    out check). Four steps in a chromeless route group (`(onboarding)`, no Rail/CommandBar): locale
    + theme (reuses `LocaleToggle`/`ThemeToggle`), branch confirm (`Switch` toggles, not persisted —
    a self-act ritual, not a data write), upload (reuses `IngestPanel` unmodified, now with an
    additive optional `onIngestSuccess` callback prop), and a step-4 handoff that captures the
    baseline (`completeOnboarding` server action, idempotent, rate-limited, audited) and shows a
    resolved money-at-risk hero with a **user-actuated** CTA into Denial Analytics (deliberately not
    an auto-redirect — avoids an unannounced WCAG 3.2.5 context change). Seeded demo tenants already
    have a baseline (`scripts/seed.ts` calls `captureBaseline` per tenant), so **no existing demo
    account sees the corridor** — see `docs/review.md`'s new "Step 0" for how to trigger it
    manually. An **owner** account's dropzone attempt inside the corridor still hits the existing
    `ingestBundle` RBAC gate (`ingest` is `hidden` for owner) and surfaces its real "not authorized"
    error — deliberate, undocumented RBAC is NOT touched by this unit; that's why the corridor's
    "Do this with me" white-glove CTA (a `mailto:` link) is the owner's primary path, not the
    dropzone.
  - **A3 free-audit report + owner report** — two new bilingual, print/PDF-able report pages, built
    entirely from existing `@taweed/analytics` rollups (no new money math): `getAuditReportData` and
    `getOwnerReportData` (`apps/web/lib/data.ts`) compose `moneyScope`/`denialRateDim`/`reasonPareto`/
    `recoverability`/`trend`/`getLatestBaseline` plus three new pure derivations in
    `apps/web/lib/report-data.ts` (`recoverableSplit`, `projectedRecoveryRange` — a conservative
    15-35% modeled band, badged `MOCK`, until a tenant has its own resolved-appeal history —
    `aggregateTopPayers`). Pages: `/analytics/audit-report` (no extra RBAC gate, mirrors the parent
    Analytics page which `rbac.ts` never hides) and `/recovery/owner-report` (RBAC-gated same as
    Recovery, hidden for clinician). PDF export is the browser's own print-to-PDF (`window.print()` +
    `print:` Tailwind variants added to `apps/web/app/[locale]/(app)/layout.tsx` to hide the Rail/
    CommandBar) — **not** a server-side PDF pipeline, a deliberate scope call (no local browser to
    drive a headless render anyway). Overview's existing "Build report" forward card now points at
    the real owner report instead of a placeholder link to `/recovery`; Denial Analytics gained a
    "Build the free-audit report" header action.
  - **Multi-lens review (typescript + security + a11y-architect) run on the diff, findings fixed,
    re-verified green:** a TOCTOU race in `completeOnboarding` (two concurrent calls for the same
    tenant could both observe no baseline and both insert one — no unique constraint on
    `recovery_baselines`) found independently by BOTH the typescript and security reviewers, closed
    with a per-tenant `pg_advisory_xact_lock` held for the transaction; a fire-and-forget
    `completeOnboarding()` call in the corridor (typescript, HIGH) that could silently desync the
    onboarding gate from the UI on a server error — now awaited, error-handled, with a visible retry
    affordance; a `useEffect`-to-notify-a-parent anti-pattern in `IngestPanel` (typescript, MEDIUM;
    this repo's own `react/hooks.md` explicitly bans this) — the callback now fires directly in the
    upload's async transition, no ref-guarded effect; no focus management across the corridor's 4
    step transitions including the automatic step-3-to-4 handoff (a11y) — each step's `<h1>` now
    receives focus on mount, and the step-label paragraph is a polite live region; the printed/PDF
    leave-behind report dropped the tenant name entirely (a11y — `ReportShell`'s `print:hidden`
    wrapper enclosed both the tenant-name block and the print button; now only the button is
    screen-only); `.num` was forcing LTR direction onto full Arabic sentences instead of just the
    numeral tokens it's meant for (a11y/RTL — removed from three prose strings); plus two smaller
    a11y fixes taken from the same review (`Progress` now forwards `value`/`max` to Radix so
    `aria-valuenow` is real, not indeterminate; `MoneyFigure`/`CountUp` gained an `animate` prop, set
    `false` in both report documents, so a report's hero figure is correct at first paint rather than
    mid-count-up if `window.print()` fires early). Security review otherwise confirmed clean: RLS/
    tenant-isolation, RBAC (including the deliberate owner-can't-upload interplay above), the mailto
    injection surface, rate-limiting, and audit-log completeness all held up under adversarial read.
  - **Verified after fixes:** unit **769/769** green (up from 708 pre-unit, 763 before the review
    fixes), root+web typecheck clean, lint clean, `apps/web` production build green (new routes
    confirmed in the build output: `/onboarding`, `/analytics/audit-report`, `/recovery/owner-report`).
- **B6 field-mapping panel — DONE (synthetic data), built 2026-07-10, MERGED + PUSHED to
  `origin/main`** (commit `80b1698`, merge `ff2e438`, `back-up` ritual completed). The last remaining
  buildable EXECUTE Tier 3 item (`docs/superpowers/plans/execute-phase.md`): CSV/TSV drops now
  surface a mapping-review step (detected column → canonical field, confidence, per-row override
  `Select`, explicit Confirm required — no auto-proceed on high confidence) before anything is
  written, built on the already-tested `@taweed/ingest` `detectFieldMapping`/`applyMappingOverrides`.
  New pure `csvRowsToClaims` (`packages/ingest/src/csv-to-claims.ts`) converts confirmed rows to
  `NormalizedClaim`s (one CSV row = one claim = one line, a documented scope cut — no multi-row
  claim grouping this pass); new server actions `previewCsvMapping`/`commitCsvMapping`
  (`apps/web/lib/actions/ingest-csv.ts`) mirror `ingestBundle`'s RBAC/rate-limit/audit and its
  first-existing-dimension simplification (no per-row branch/provider/payer/patient creation from
  CSV data — deliberately deferred to the BLK-1 real-partner-ingest track, avoiding an ad hoc
  patient-pseudonymization scheme on a still-synthetic-tagged surface). XLSX still routes through
  the typed `parseXlsx` stub (throws its existing "not wired" error, surfaced as a translated
  message) — no real XLSX parser built, per the unit's own scope. Both locales/themes; new
  `ingest.csvMapping.*` i18n keys (EN + real AR).
  - **Multi-lens review (typescript + security + a11y-architect + healthcare-reviewer) run on the
    diff with adversarial verification; all 19 confirmed findings fixed**, in three sequential fix
    batches (the first single-batch attempt stalled mid-stream twice on a 11-item call — root cause:
    a matcher bug that vacuumed unrelated findings into one oversized batch; fixed by routing on
    basename instead of a naive suffix check, and splitting into smaller batches). Highlights: a
    silent "None"-override no-op (operator clears a wrong auto-mapping in the UI, the wrong mapping
    committed anyway — `applyMappingOverrides` now distinguishes `undefined` "keep auto-detected"
    from explicit `null` "force no column"); stale mapping-panel state surviving a second file drop
    (now keyed on file identity so it remounts); a live-region-born-already-populated a11y bug plus
    focus orphaned on Confirm/Cancel/mapping-panel-mount (focus now moves to the right heading on
    every transition, the announcer region is permanently mounted and only its text changes); a
    file-size/row-count guard added (5 MB / 5,000 rows, no prior precedent in this repo to match);
    the `ingestBundle` dimension-query duplication closed (both paths now call one
    `resolveFirstDimensions` helper); raw exception text no longer leaks to the client on a parse
    failure (fixed machine-readable error codes throughout, matching `ingestBundle`'s own
    fixed-string convention).
  - **⚠ MONEY-PATH CHANGES — EXTRA SCRUTINY REQUESTED.** Per this repo's `defer-money-path-
    comprehensive-docs` instinct (revised 2026-07-10 to fit build-session-on-unreleased-code: extra
    audit + extra tests + fix + prominent doc flag, not a pre-fix human block — see the instinct file
    for the full reasoning), `csv-to-claims.ts`'s money parsing got a dedicated adversarial pass
    beyond the standard review, **after** the standard review's own money-adjacent findings (parseMoney
    accepting locale-comma/hex/scientific-notation input, a zero-value denial row, a fully-denied
    claim mislabeled `"partial"` instead of `"error"`) were already fixed. The extra pass found and
    fixed two more, both empirically demonstrated in a Node REPL before writing the fix:
    **(1)** `MONEY_RE` allowed unlimited decimal digits, so a 3-decimal amount like `"1.005"` hit a
    real JS float64 representation gap — `(1.005).toFixed(2)` evaluates to `"1.00"`, not `"1.01"` —
    silently storing a wrong (rounded-down) amount instead of quarantining; fixed by capping the regex
    at 2 decimal places (SAR/halala's actual precision). **(2)** No upper bound on magnitude, so an
    implausibly large digit string (extra zeros, unit mismatch, hostile input) could reach
    `Number.prototype.toFixed`'s exponential-notation threshold (`(1e21).toFixed(2) === "1e+21"`, not
    a valid decimal literal) instead of being caught as a data-quality problem; fixed with a documented
    `MAX_MONEY_VALUE` ceiling (999,999,999.99 SAR, no existing repo precedent to match). Six new
    regression tests added (`packages/ingest/test/csv-to-claims.test.ts`, "money precision &
    magnitude guards" describe block) plus two tests locking in confirmed-safe edge cases (`-0`
    normalizes to `"0.00"`; an explicit `0.00` total is intentionally accepted, matching `ingestBundle`'s
    own null-only check — not a bug). **Verified end-to-end in the live app via chrome-devtools MCP**,
    not just unit tests: a 5-row CSV with one clean claim, one clean denial, and three money-path
    edge-case rows (3-decimal amount, an oversized digit string, an Arabic-Indic-digit amount)
    produced exactly 2 claims created / 1 denial / SAR 120 at-risk / 3 correctly-reasoned quarantine
    rows in the real `/ingest` page (RCM demo account), confirmed on both EN and AR routes.
  - Verified: unit **861/861** green (up from 850 pre-extra-pass), root+web typecheck clean, lint
    clean (0 errors), `apps/web` production build green.
- **AI-4 real-data-gaps (synthetic-EOB rasterizer + adjustment bucket) — DONE, built 2026-07-10 on
  branch `ai4-real-data-gaps`, MERGED + PUSHED to `origin/main`** (commits `659f023`, `e9ece53`,
  `89e0d3f`, `f5364ca`, `ce23df9`, merge `00c7dfe`, feature branch deleted post-merge, `back-up`
  ritual completed — `back-up` re-pointed to the pre-merge tip `8aa8677` and force-pushed BEFORE
  `main` was pushed, confirmed `back-up` is exactly one merge-edge behind `main` post-push; CI green
  on the pushed tip — lint/typecheck/unit, integration, and E2E+a11y jobs all passed). Closes the two
  AI-4 real-data-*enablement* gaps
  `docs/NEXT_STEP_PROMPT.md` called out after B6 — both buildable on synthetic fixtures, neither
  needs real partner data:
  - **Gap 1 — synthetic-EOB→PDF rasterizer.** `test/synthetic-eob/src/rasterize.ts`: Playwright
    headless Chromium (`page.pdf()`, `@playwright/test` — already a devDependency elsewhere in the
    repo, so this is a new *importer edge*, not a new *package resolution*), rendering the existing
    ground-truth HTML template to a real PDF. Wired into `packages/ai/evals/extractEob.eval.ts`'s
    `PdfRenderer` seam, which previously always threw (`notWiredRenderer`) — the live eval harness
    (`AI_EVALS_LIVE=1`) can now actually run end to end, though a real scored pass against the
    Anthropic API hasn't been run yet (deliberately out of scope for this build). Proven with a
    genuine Chromium launch, not just a green typecheck: decoded PDF byte length 49,633 (`clean`
    scenario) / 52,117 (`arabicHeavy`, RTL), `%PDF-` magic bytes confirmed both times. Guarded to
    skip cleanly (`describe.skipIf`) rather than fail-red in CI's "quality" job, which doesn't
    install Playwright browsers (only the separate `e2e` job does) — probed once at module load.
  - **Gap 2 — adjustment/withholding (5th money) bucket.** `adjustmentHalalas` /
    `totalAdjustmentHalalas` threaded end to end: schema (`packages/ai/src/schemas/eobExtraction.ts`),
    arithmetic validator (`packages/ai/src/eob-validators.ts`), reviewer-edit boundary + the
    approve-revalidates-arithmetic invariant (`apps/web/lib/actions/eob-review.ts` — confirmed still
    holding under the 5-bucket shape), the review-queue UI (`eob-extraction-form.tsx`), eval scoring
    (`packages/ai/evals/scoring.ts`), and a new `contractualAdjustment` synthetic scenario so the
    (now-live) eval harness actually exercises it. A real remittance with a contractual write-off is
    no longer permanently stuck at "reject only" even when the extraction is accurate.
    `apps/web/lib/eob-to-normalized.ts` was deliberately left untouched — no DB column exists for
    the bucket and writing it into `denials` would wrongly mark a non-appealable write-off as
    appealable; a documented `TODO(ai-route)` + two pinning tests in `eob-to-normalized.test.ts` lock
    in today's behavior so a future persistence change is a deliberate diff, not a silent one.
  - **Multi-lens review (typescript + security + healthcare + react) run on the full diff with
    adversarial verification; all 6 confirmed findings fixed** (`f5364ca`): a legacy-row backfill
    (`eob-review-data.ts`'s new `backfillLegacyAdjustmentFields`, so an `eob_extractions` row stored
    before this branch — missing the now-required `adjustmentHalalas` field — doesn't fail
    `EobExtractionSchema.safeParse` and go unopenable in the review queue); a real bug in
    `test/synthetic-eob/src/generate.ts`'s `buildHtmlTemplate` that never applied `spec.digitSet`
    (only `buildTextLayer` did) — meaning `arabicHeavy`/`mixedDigitSets` scenarios were rendering
    Western-only numerals into the PDF the live vision eval actually reads (it rasterizes the HTML
    template, never `textLayer`); a stale doc comment contradicting the now-shipped rasterizer; and a
    documented non-persistence decision + pinning tests for `eob-to-normalized.ts` (see Gap 2 above).
  - **⚠ MONEY-PATH CHANGES — EXTRA SCRUTINY REQUESTED.** Same `defer-money-path-comprehensive-docs`
    instinct as B6: a dedicated adversarial pass ran on the 5-bucket arithmetic validator, beyond the
    standard review, specifically hunting for ways the new bucket could be exploited. It found and
    fixed four real gaps across two rounds (`89e0d3f` then, after a resumed workflow step
    independently re-derived and *generalized* the first fix, `ce23df9`):
    **(1)** `SAR_MONEY_REGEX` (`apps/web/lib/money.ts`) had no upper bound on integer-part digit
    count, so a 16+ digit SAR string could lose precision through `Number(intPart)` and collide at
    float64 (two genuinely different amounts converting to the identical halalas integer), silently
    defeating the validator's `===` cross-total checks — contained today only by an unrelated
    accident (Postgres `numeric(14,2)` rejects the insert before any bad row commits), not by design.
    Fixed by bounding the regex to `^\d{1,12}(\.\d{1,2})?$`, matching `numeric(14,2)`'s actual
    capacity, so the containment is now explicit at the boundary that accepts untrusted input.
    **(2)** `adjustmentHalalas` had no non-negativity constraint, so a hallucinated negative value
    (e.g. billed=500, paid=700, adjustment=-200) sign-cancelled an impossible paid > billed
    relationship and every cross-total identity reported `passed:true` — including
    `validateEobExtractionArithmetic`, the *only* check run for scanned PDFs with no text layer.
    Fixed with a new `non-negative-money` validator finding. **(3), the round-2 generalization:** the
    round-1 fix guarded only `adjustmentHalalas` — but the identical sign-cancellation exploit was
    still open through any of the other four buckets (billed/paid/patientShare/rejected), none of
    which can carry a `min:0` wire constraint either (same structured-output-stripping reason as
    adjustment). Generalized to guard all five line-level buckets, all four claim-level totals, and
    the remittance-level total. **(4)** The cross-total checks themselves had no magnitude bound
    independent of adjustment — any halalas value near/above `2^53` could still float64-collide via
    *any* bucket, with soundness resting entirely on the same accidental DB-column-width backstop as
    (1). Fixed with a `money-magnitude-bound` finding capped at `numeric(14,2)`'s max representable
    value (`999,999,999,999.99` SAR), so the validator's own "a passing report is trustworthy"
    contract is now self-contained rather than borrowed from an unrelated caller. **(5)**
    `halalasToSarDisplay` (`eob-extraction-form.tsx`) unconditionally `Math.max(0, ...)`-clamped every
    SAR display field, so a real negative adjustment surfaced by (2) would render as an inexplicable
    `"0.00"` and produce an undiagnosable "inconsistent" rejection on Approve; made sign-aware
    (mirrors `@taweed/analytics`'s own `toSar`). New regression tests: `apps/web/test/money-sar-regex-
    shared-source.test.ts`, several new `describe` blocks in `packages/ai/test/eob-validators.test.ts`
    (positive + negative cases for every fix above, RED-verified via `git stash` before each fix
    landed), and two cases in `apps/web/test/eob-extraction-form.test.tsx`.
  - Verified: unit **902/902** green (up from 861 pre-this-unit), integration **42/42** green,
    root+web typecheck clean, lint clean (0 errors, 2 pre-existing unrelated warnings), `apps/web`
    production build green — re-verified again on the merged `main` tip before pushing. MERGED to
    `main` and PUSHED to `origin/main`, with the user's explicit go-ahead (merge `00c7dfe`).
- **Next up:** `docs/04_agentic_retrofit_plan.md` §9 (PROMPT 1–3) is fully built — there is no
  PROMPT 4, re-confirmed 2026-07-10. With A2/A3, B6, and now the AI-4 real-data-gaps unit also built,
  the EXECUTE phase's buildable scope AND AI-4's real-data-*enablement* gaps are fully complete;
  only the **real-data headline** remains, gated on BLK-1/2/9 as always, plus AI-4's production
  route as a separate legal/ops track (BLK-AI-1/3/4 — closing the two gaps above makes AI-4
  real-data-*ready*, not real-data-*enabled*; the flag flip is still a separate, human-gated
  decision). Paste-ready: `docs/NEXT_STEP_PROMPT.md`.
- **Doc-sync correction (2026-07-10, later the same day): the Scrubber `<tr role="button">` a11y item
  in `docs/review.md` §2.11 was stale — no code change needed.** `docs/NEXT_STEP_PROMPT.md` pointed at
  it as the one remaining independently-pickable pick-up item, but the WCAG AA accessibility audit
  sweep (commit `516e72d`, `docs/a11y.md` #21) had already fixed it as part of its 25-finding pass;
  `docs/review.md` §2.11 was just never updated to say so. Verified this session: no `role="button"`
  on any `<TR>` in `apps/web/components/modules/scrubber-table.tsx`, native row/cell semantics intact,
  the row's sole interactive control is a nested labeled `<button>`, and
  `apps/web/test/scrubber-table.test.tsx` reconfirms it (7/7 passing). A repo-wide grep sweep across
  `docs/*.md` found one more stale mention (`docs/ai-deploy-readiness.md` line ~60) but that file is
  an immutable per-iteration loop ledger — a historical record, not a live status doc — so it was
  left alone. `docs/review.md` §2.11 corrected in place; `docs/NEXT_STEP_PROMPT.md` rewritten: **no
  self-contained buildable unit remains at all now** — everything left is blocker-gated
  (BLK-1/2/9, BLK-AI-1/3/4), same list as the "Independently pending" bullets above.
- **First real-tester bug-fix pass (2026-07-16), on `main` in this dir.** A tester on Docker/
  Windows followed README + `docs/review.md` and filed a bug list (screenshots): Scrubber AI-1
  "explanation unavailable", Appeal AI-2 suggestions "can't be inserted and edited", Recovery
  "mark won/lost doesn't do anything", "Owner report doesn't exist", EOB PDF AI-4 "always off"
  (two fixtures), dead search bar, and a branch selector that only ever shows "All branches".
  §1.11's automated suite was run first per the tester's own instructions (green — the fixtures/
  mocks never exercised any of these, since they only surface against the real API/UI). Every
  item was then reproduced and root-caused live via chrome-devtools MCP before any fix:
  - **AI-1 (Scrubber explain) — real code bug, not config.** `packages/ai/src/anthropic-1p.ts`
    unconditionally sent `inference_geo: "us"` on every model call; Claude Haiku 4.5 (the only
    model AI-1 routes to, per `models.ts`'s `MODEL_BY_FEATURE`) rejects that parameter with a
    live 400 (`'claude-haiku-4-5-20251001' does not support inference_geo`). This has silently
    broken every AI-1 call since it shipped — prior verification passes only ever exercised the
    fixture/cached provider path, never a real key against the live API. Every other AI feature
    (AI-2/3/4) routes to Opus/Sonnet, which accept the parameter, so only AI-1 was affected —
    consistent with the tester's own report that AI-2 worked while AI-1 didn't. Fixed:
    `supportsInferenceGeo()` gates the param per-model; `@anthropic-ai/sdk` 0.111 also now types
    `inference_geo` natively, so the old wire-spread workaround was removed too. New unit tests
    in `packages/ai/test/anthropic-1p.test.ts` pin the Haiku-rejects/Sonnet-Opus-accept contract.
  - **AI-4 (EOB PDF extraction, both reported fixtures) — real code bug, not config.**
    `apps/web/lib/actions/eob-extract.ts` ran `extractPdfTextLayer(pdfBytes)` (the born-digital
    text-layer check) BEFORE handing the same `pdfBytes` reference to the vision adapter.
    `pdf-parse`'s pdfjs-dist internals detach the underlying `ArrayBuffer` of whatever typed
    array they're given as a memory optimization — proven with an isolated repro (byte length
    50554 → 0 after the old call order, stays 50554 with a copy) — so by the time the adapter
    base64-encoded `pdfBytes`, it was empty, and Sonnet + the Opus escalation both failed
    outright with a real API 400 (`"PDF cannot be empty"`), collapsing to a generic
    "could not be processed" with the actual cause never logged (the adapter's own
    never-throw-on-double-failure contract swallows it into a validator report, not a log line).
    Fixed with a one-line `.slice()` copy before the text-layer call.
  - **Recovery "mark won/lost does nothing" — the mutation itself was never broken.** Proven via
    a direct SQL reproduction of `markAppealOutcome`'s own transaction (UPDATE succeeded,
    reverted after). The real bug: `markAppealOutcomeForm` discarded the action's return value,
    so every `{ok:false}` early-return (RBAC denial, invalid input, rate-limit, appeal-not-found)
    produced zero user feedback — a failed click looked identical to a successful no-op. Fixed:
    the wrapper now redirects with `?recoveryError=1` on failure so the page renders an inline
    `role="alert"` banner (reuses the existing `settings.actionFailed` i18n string, no new key).
    5 new tests in `apps/web/test/recovery-form-error-surfacing.test.ts`. No money-guardrail
    logic (`packages/analytics/src/recovery.ts`'s `resolveRecovery`) was touched.
  - **Owner report "doesn't exist" — reachable and correct; a discoverability gap, not a bug.**
    `rbac.ts`'s `recovery: rcm="full"` and the page's own `isVisible` gate both pass for rcm;
    `/en/recovery/owner-report` renders correctly by direct URL. Root cause of the report: rcm's
    default landing page is Analytics (`landingModule("rcm") === "analytics"`), whose only report
    CTA is "Build audit report" → a *different* page; the owner report's only in-app link is a
    card on Overview, which rcm never lands on by default. No code change made (existing
    `owner-report-page.test.ts` already covers the rcm path and passes) — flagged as a follow-up:
    add a second header link on `/analytics` pointing at the owner report, or surface it from the
    Recovery module landing instead. Not done in this pass — needs `analytics/page.tsx` +
    an i18n key, both one line, low risk, next session.
  - **Appeal AI-2 "can't be inserted and edited" — did not reproduce; already correct.**
    `appeals-composer.tsx`'s `insertParagraph` already reads the reviewer-edited textarea value
    (`edited[key] ?? original`), not the stale AI original. 2 new regression tests in
    `apps/web/test/appeals-composer-a11y.test.tsx` pin the edited-vs-original insert behavior so
    a future regression is caught; no product code change.
  - **Dead search bar — real gap, now built.** The command-bar `<input type="search">` had no
    `onChange`/submit handler at all. Now a controlled input; Enter with a query navigates to
    `/scrubber?q=<query>`, which substring-filters its already-loaded claim rows by claim id /
    NPHIES id / payer name (no new search index/API/dependency). New test:
    `apps/web/test/command-bar-search.test.tsx`.
  - **Branch selector ("only ever shows All branches") — real gap, contained scope per user
    decision.** `tenant-switcher.tsx` was a fully static shell (no selection handler at all) —
    the design brief (§7) specs a full multi-select filtering every module, but that's a much
    bigger, money-adjacent change; the user explicitly scoped this pass to: make the switcher
    functional (`?branch=<id>` URL param, updated trigger label), and wire REAL filtering into
    Analytics + Scrubber only (the two pages whose data already keys off `claims.branch_id`).
    Ingest/Appeals/Recovery show the same switcher chrome but are deliberately unfiltered — see
    the scope-cut comment on `getAnalytics` in `lib/data.ts`. `resolveBranchId()` is the security
    boundary: a `?branch=` value that isn't one of the tenant's own (RLS-scoped) branches is
    silently ignored, never trusted as a filter (RLS itself is defense-in-depth underneath
    regardless). Verified live: at-risk SAR went 35,959 (all branches) → 19,524 (Riyadh only);
    the "by branch" cross-branch comparison chart correctly stays unfiltered. New tests:
    `apps/web/test/tenant-switcher-branch-select.test.tsx` (5), plus `resolveBranchId`/
    `getScrubRows`/`getAnalytics` branch-scoping cases added to `apps/web/test/data.test.ts`.
  - **Process note — a orchestrator-spoke incident, caught and recovered, no data lost.** Root
    causes for AI-1/AI-4 were found and fixed directly; the remaining 5 items were parallelized
    across GLM spokes per `~/.claude/orchestrator/PROTOCOL.md`. One spoke (Recovery) ran an
    out-of-scope `git stash pop` that collided with two others running concurrently in the same
    (non-worktree-isolated) working tree, silently reverting the search-bar and appeal-insert-
    edit test files to HEAD. Caught during diff review (not by trusting the spoke's own "done"
    report), reconstructed both from the accepted reports' exact content, and re-verified with a
    full fresh suite once the tree was quiet. Lesson for future waves touching overlapping shell
    files: either isolate concurrent spokes in worktrees, or explicitly forbid `git stash`/
    `git checkout` in every spec (neither was forbidden before this).
  - Verified: unit **1007/1007** green (up from 902 pre-pass, 984 immediately post-baseline —
    the gap is 6 new test files/blocks added across the fixes above), integration **42/42**,
    root+web typecheck clean, lint clean (one pre-existing, unrelated `.claude/workflows/
    multi-lens-review.js` parse error — ECC tooling, not product code, untouched by this pass),
    `apps/web` production build green. Every fix live-verified via chrome-devtools MCP against
    the real running app (not just unit tests) — dev server `.next` cache needed one clean
    rebuild mid-session after heavy hot-reload churn corrupted its webpack chunk manifest
    (`Cannot find module './911.js'`), unrelated to any of the fixes.
  - **Doc fix, same pass:** `docs/review.md` §1.10 ("Testing the NEW AI features") only ever
    documented the non-Docker `apps/web/.env.local` method with no warning that it has zero
    effect inside the Docker container — a real trap for exactly the audience most of
    `docs/review.md` targets (its own §1.3 has Docker users start there via `docker compose up
    -d`). This is the most likely explanation for the tester's setup silently not taking, even
    though it turned out NOT to be the actual root cause of the reported bugs (both were real
    code defects, confirmed by reproducing them from a correctly-configured non-Docker dev
    server). Added an explicit callout cross-referencing README's docker-compose.yml method.
- **FHIR R4 validator full audit — DONE, 2026-07-17, uncommitted.** Orchestrated via Sonnet-5
  hub + `agy` (Antigravity CLI, non-GLM) for research + Opus-pinned audit/review agents (Sonnet
  for the mechanical fix/verify legs) — no GLM anywhere in the pipeline (weekly GLM quota was at
  100%). `packages/fhir/src/validate-r4.ts` previously checked only 7-8 top-level scalar fields
  per resource; it now validates every FHIR R4 SHALL element down to the leaf, including
  conditionally-required nested elements: `Claim.insurance` (1..\*, was completely missing) plus
  per-entry requirements on `careTeam`/`diagnosis`/`procedure`/`item`/`item.detail`/
  `item.detail.subDetail`/`insurance`, and on the `ClaimResponse` side `item`/`adjudication`/
  `detail`/`subDetail`/`total`/`payment`/`insurance`/`processNote`/`error`/`addItem`. 19 new
  RED-then-GREEN test cases in `packages/fhir/test/validate-r4.test.ts`. Research sourced the live
  `hl7.org/fhir/R4/claim.profile.json` StructureDefinition directly (not the HTML page) via `agy`;
  one research call (ClaimResponse cardinalities) hit agy's own 5-minute timeout and was retried
  successfully. **Real bug found beyond cardinality:** `ClaimResponse.outcome` was derived from
  denial amount (`totalRejected > 0 ? "partial"/"error" : "complete"`), but FHIR R4's
  `RemittanceOutcome` value set only encodes *processing* status — a cleanly-adjudicated-but-denied
  claim is `"complete"`, not `"error"`/`"partial"`. Fixed in `packages/ingest/src/csv-to-claims.ts`
  and propagated through `test/synthetic-fhir/src/scenarios.ts` (all 9 denial scenarios) plus 3
  test files that had the wrong semantics hard-coded as assertions. **Flagged, not fixed (separate
  follow-up needed):** `apps/web/lib/eob-to-normalized.ts:184` has the identical outcome-mapping
  bug on the EOB-OCR path (`apps/web/test/eob-to-normalized.test.ts:166` still asserts the wrong
  value) — out of this pass's scope (audit only covered `packages/ingest`+`packages/normalizer`).
  NPHIES-profile boundary was explicitly researched (is the public
  `portal.nphies.sa/ig/conformance.html` page usable to hand-roll profile validation, separate
  from the licensed `nphies-fs#1.0.0` IG package?) — verdict **LICENSE-GATED-TOO** (the public page
  has zero profile schemas, only generic SHALL/SHOULD terminology + IP declarations); `packages/
  fhir/src/nphies-profile.ts`'s creds-gated stub was confirmed untouched (empty diff) by the Opus
  reviewer, verdict **ACCEPT**. Process note: a workflow-script bug meant the agy-sourced spec text
  reached 3 of 4 audit agents as literal `undefined` — they self-corrected by cross-verifying
  directly against the installed `@medplum/fhirtypes` `.d.ts` files (itself R4-StructureDefinition-
  generated) instead of guessing, and the Opus reviewer independently re-verified every citation
  against that same primary source before accepting; worth knowing, not worth redoing. Also:
  two parallel `Fix`-phase agents both touched the same `packages/fhir` area — one detected the
  concurrent write mid-task and correctly did not clobber it (only added a missing fixture field
  elsewhere), but this was a coordination gap that happened to converge safely rather than one
  that was structurally prevented — worth worktree-isolating or sequencing overlapping-file fix
  agents in future waves. Verified: **452 suites / 1075 tests, 1072 pass, 0 fail, 3 skipped** (unit
  + integration, against the repo's own `docker compose` Postgres). 9 files changed, 461
  insertions / 27 deletions. **Committed and pushed** (`main` = `66342be`, doc-sync follow-up
  `0c8f800`) — see "Git workflow & safety" below for the full ritual, including a fast-forward onto
  3 concurrent docs-only commits from `origin/main` and a by-hand-resolved conflict in this file's
  own top blockquote.
- **Both queued `docs/NEXT_STEP_PROMPT.md` items done in one pass, 2026-07-17 (no file overlap, ran
  in parallel — the prior pass's collision lesson applied this time by construction, not luck):**
  - **EOB-outcome-bug twin, fixed properly, not copy-pasted blind.** Before touching
    `apps/web/lib/eob-to-normalized.ts:184`, traced the AI-4 EOB-OCR pipeline
    (`packages/ai/src/features/extractEob.ts`, `packages/ai/src/eob-validators.ts`) and its caller
    `apps/web/lib/actions/eob-review.ts` to check whether this path — unlike the CSV path — ever
    carries a genuine processing-error signal that should legitimately map to FHIR `"error"`.
    Confirmed empirically: `eob-review.ts` rejects a failed/inconsistent extraction *before*
    `buildNormalizedClaimsFromEob` is ever called, so no failed extraction reaches the normalizer —
    same conclusion as the CSV path, `outcome` is unconditionally `"complete"`. Fixed +
    `apps/web/test/eob-to-normalized.test.ts:166` updated; `test/synthetic-eob/src/scenarios.ts`
    checked and confirmed clean (it only emits wire-shaped money data, never encodes an `outcome`
    field, unlike `test/synthetic-fhir/src/scenarios.ts` which did and was already fixed). Confirmed
    via advisor + grep that `denialRateDim` keys off the `denials` table, not `outcome` — this fix
    cannot regress denial-rate/at-risk analytics.
  - **Owner-report discoverability, fixed** (this file's carried-forward item, finally picked up
    after two sessions untouched). A second header action on `/analytics`
    (`apps/web/app/[locale]/(app)/analytics/page.tsx`) — "Build the owner report" → same
    `Link`/`Button` pattern as the existing "Build the free-audit report" CTA. Real (non-machine-
    translated) Arabic label reusing the existing "تقرير المالك" term from `overview.buildReport`,
    not a fresh translation. New RTL component test rendering the real `AnalyticsPage` server
    component. Deliberately **not** RBAC-gated on the new link itself — matches the existing
    ungated `Overview` `ForwardCard` to the same route, and the owner-report page already enforces
    RBAC server-side; adding client-side gating here would be inconsistent scope creep.
    **Live-verified via chrome-devtools MCP** across all four EN/AR × light/dark combinations —
    correct locale-prefixed URLs, proper RTL mirroring, good contrast both themes, click-through to
    the real page confirmed. A stale, corrupted `.next` webpack chunk manifest (same known class of
    issue as a prior session's note) blocked the first verify attempt on `/analytics` — fixed with
    `rm -rf apps/web/.next` + a clean dev-server restart, unrelated to the code change itself.
  - Verified together: **454 suites / 1076 tests, 1073 pass, 0 fail, 3 skipped** (2 new suites/tests
    vs. the prior 452/1075/1072 baseline, no regression), typecheck clean, lint at the same one
    pre-existing unrelated `.claude/workflows/multi-lens-review.js` error, `pnpm --filter
    @taweed/web build` green. `docs/review.md`'s Analytics walkthrough (Step 2) updated to describe
    both header links now present.
- **`/autopilot` pass, 2026-07-17, same day: `docs/review.md` gap-filled for two shipped-but-
  undocumented features, then the ENTIRE §1.8 walkthrough live-driven via chrome-devtools MCP
  (Sonnet 5 throughout, no GLM — weekly quota at 100%).** Added `### Step 4a — Command-bar
  search` (Enter navigates to `/scrubber?q=<query>`, substring-filters by claim id/NPHIES id/
  payer name) and branch-selector "what to verify" bullets on Step 2 + Step 4 (real filtering on
  Analytics + Scrubber only, by design; Ingest/Appeals/Recovery deliberately unfiltered; invalid
  `?branch=` silently ignored). Both verified against real code/tests before writing, not
  assumed. **Full drive-through, Steps 1-9 + the two new ones:** Ingest exercised end-to-end with
  the real `/api/sample-bundle` output (uploaded via a temporarily-unhidden file input, since the
  dropzone's real `<input type="file">` needed a DOM workaround for chrome-devtools' `uid`-based
  `upload_file`) — "1 claims, 1 denials detected, SAR 408 at risk," 0 quarantined, confirming
  today's earlier FHIR R4 validator fix works live, not just in tests. Search + branch filters
  combine correctly (`?q=` preserved across a branch pick) and re-verified in Arabic. Recovery's
  "Mark won" moves money correctly (Recovered SAR increased by exactly the claim amount) — a
  "Won 25 of 160" → "Won 25 of 161" heading shift initially looked like a possible off-by-one but
  was traced to source (`recovery/page.tsx`'s `shownOfTotal`, a truncation indicator, not a
  status counter) and confirmed correct, not a bug. Tenant isolation (Step 9) reconfirmed live —
  signing into the other tenant shows completely different figures/branches, zero leakage. AR +
  dark-theme spot-checked on Scrubber with an active filter (per plan: full EN/light everywhere,
  targeted AR/dark on the money-path modules + the two brand-new features, not blind 4× coverage).
  **One real issue found, self-inflicted and environmental, not a product bug:** the login
  account picker rendered empty (`<ul>` with 0 children) — root-caused to this session's own
  earlier Verify-phase agents having run the full `vitest run` (including the destructive
  "integration" project) against this same shared dev Postgres without re-seeding after, per
  `docs/review.md`'s own documented warning. Fixed with `pnpm --filter @taweed/web seed`; **the
  hub's own later gate run repeated the same wipe and was re-seeded again immediately after** —
  a process lesson for future sessions running integration tests against a live interactive dev
  DB. **Zero code defects found in the live walkthrough itself.** Validated: 3 parallel Sonnet
  reviewers (architecture/correctness, security, quality) — **all ACCEPT, round 1.** Security
  review independently re-verified (not taken on faith) that the new Analytics→owner-report link
  matches the existing ungated Overview-card precedent, and that the real RBAC gate
  (`isVisible(session.role, "recovery")`, server-side) on the owner-report page itself is
  untouched. Architecture review independently traced `eob-review.ts` to confirm no failed
  extraction can reach the outcome-fix call site. Gates fresh before validation: typecheck clean,
  full suite 454/1076/1073/0/3 (same as above), lint at baseline, production build green.
- **2026-07-18: AI-4 live eval actually run for the first time — real bug found + fixed, plus a
  more consequential scoring bug found and FULLY FIXED (2026-07-18, same session, on explicit user
  instruction to not stop at "needs a design decision").** `packages/ai/evals/extractEob.eval.ts`'s
  `AI_EVALS_LIVE=1` run was first blocked by a one-line bug: its `env: {...}` object passed to
  `extractEob()` fully shadowed `process.env`, so `ANTHROPIC_API_KEY` was never seen even though
  it was genuinely set — same bug in `explainFlag.eval.ts`. Fixed both by spreading
  `...process.env` first. The file's hardcoded `120_000`ms per-tier test timeout also proved too
  short for 40 sequential real API calls (~10-15s each) and was bumped to `900_000`. **The deeper
  root cause, now fixed at the source:** `test/synthetic-eob/src/generate.ts`'s `buildHtmlTemplate`
  (what's actually rasterized into the PDF the vision model sees) never rendered `patientRef`,
  `serviceDate`, or the internal `claimId` — only `buildTextLayer` (a separate ground-truth
  representation, used for a different production cross-check, never fed to the vision model) had
  them. The model correctly couldn't produce fields it could never see; `scoring.ts`'s
  claim-matching (keyed by the invisible `claimId`) then cascaded every nested score to ~0.
  **Fix:** `buildHtmlTemplate` now renders a per-claim identity block (mirroring
  `buildTextLayer`'s existing bilingual EN/AR content) so the document genuinely contains what the
  ground truth expects; `scoring.ts`'s claim-matching now keys on `nphiesClaimId` (falling back to
  `claimId`) — the always-legible identity, matching the exact fallback pattern already used in
  production (`eob-to-normalized.ts`/`assist-appeal.ts`'s `nphiesClaimId ?? claimId`). One test
  fixture (`eval-scoring.test.ts`'s hallucinated-claim case) updated to match the new, correct
  semantics — it previously only varied `claimId`, which the new matching key no longer treats as
  the discriminator. **Verified progressively:** 3-item real run → 97.0% overall / 100% amounts /
  0 hallucinated; 5-item → consistent; then the complete real 40-item × 2-tier corpus (real
  Anthropic API, ~978s wall time): **Sonnet 96.6% overall / 100% amounts (meets/exceeds both
  documented targets, 98%/95%), 0 hallucinated claims** — `packages/ai/evals/.output/
  extractEob-sonnet.json`. **Opus 87.1% overall / 100% amounts** (codes 183/375 vs Sonnet's
  343/375 — a genuine model-behavior difference on code-field formatting, not a scoring bug, noted
  as a minor follow-up in `docs/NEXT_STEP_PROMPT.md`, not blocking). **AI-4 is confirmed working
  well — this was a broken measurement the whole time, never a broken feature.** All unit tests
  green (`eval-scoring.test.ts` 11/11, `test/synthetic-eob` 20/20), typecheck clean.
- **2026-07-18, same day, size-diversity follow-up: two new fixtures caught a REAL production bug
  in `extractEob.ts`, not just an eval artifact.** User asked for fixtures "of different sizes so
  tests are made thoroughly and nothing breaks" — added `minimalSingleLine` (1 claim/1 line) and
  `denseLargeRemittance` (8 claims × 6 lines = 48 lines, confirmed a genuine 4-page PDF via
  `file`) to `test/synthetic-eob/src/scenarios.ts`; `CORPUS_SIZE` bumped 40→44 (11 scenarios × 4
  reps) to keep even coverage. First live re-run hit a real failure on the large scenario:
  `Error: Failed to parse structured output ... Unterminated string in JSON`. **Root-caused via an
  isolated repro** (`anthropic.messages.create` directly against
  `docs/test-fixtures/eob-4-dense-large-remittance.pdf`, bypassing the audit/pool machinery):
  `stop_reason: "max_tokens"`, with `output_tokens_details.thinking_tokens: 3148` of the
  `max_tokens: 8192` ceiling — **Claude Sonnet 5 runs adaptive thinking ON BY DEFAULT** (confirmed
  via `platform.claude.com` docs: "Requests without a thinking field run with adaptive thinking,"
  and the thinking budget draws from the *same* `max_tokens` pool as the response, a behavior
  change from the prior Sonnet 4.6 generation). Only ~5044 tokens were left for a JSON payload that
  needed over 10x that, so the response was truncated mid-string — a hard extraction failure, not
  a low score; a real design-partner remittance bundling many claims would hit the identical wall.
  **Fixed in production code**: `packages/ai/src/features/extractEob.ts`'s `maxTokens: 8192` →
  `EXTRACT_EOB_MAX_TOKENS = 32_768` (verified via the same repro: `stop_reason: "end_turn"`, ~11k
  tokens used, 3x headroom; 128k is Sonnet 5's actual max output ceiling per the platform docs, so
  32,768 leaves large additional margin for an even bigger real document). Full 44-item × 2-tier
  live re-run, both tests passing clean (~1434s wall time): **Sonnet 98.1% overall / 100% amounts,
  0 hallucinated — exceeds both documented targets by a wider margin than the 40-item run.** **Opus
  83.5% overall / 99.9% amounts** — codes weaker at the larger scale (360/924 vs Sonnet's 888/924),
  consistent with the earlier 40-item finding, not a new issue. Two background `vitest` runs were
  unexpectedly killed mid-corpus before this one (no code-related cause found — DB/disk/memory all
  healthy, orphaned `Eval Tenant` rows + 45 stray `llm_calls` audit rows from the real, if wasted,
  API spend were cleaned up before the successful retry); tracked with both a background-task
  completion signal and an independent `Monitor` log-tail as a second channel, which is what caught
  the final clean run's real numbers. Per the user's explicit instruction, two new EOB PDF fixtures
  (`eob-3-minimal-single-line`, `eob-4-dense-large-remittance`, generated via
  `test/synthetic-eob`'s own generator + rasterizer, same convention as the existing eob-1/eob-2
  pair) now live in `docs/test-fixtures/` as Fixtures 7-8, documented in `docs/review.md` §1.14.
  Unit suite grew to 22/22 in `test/synthetic-eob` (2 new scenario tests), 1033/1033 overall;
  typecheck/lint clean on every touched file.
- **2026-07-18, same day: KSA regulatory compliance audit — 6 parallel Opus agents (agy +
  WebSearch, primary-source-verified), zero GLM.** Covers SFDA medical-device classification,
  business/vendor registration, SAMA payment-services licensing, SDAIA AI-specific law, NPHIES
  vendor legal/liability terms, and a PDPL freshness check — none previously covered in
  `docs/HUMAN_CONFIRMATION_NEEDED.md`/`docs/blocker.md` except PDPL itself (sharpened, not
  replaced). **No confirmed NON-COMPLIANT gap found anywhere in the product.** Highlights: SFDA
  SaMD exclusion for all 4 AI features confirmed against SFDA's own MDS-G027 guidance (downloaded
  + text-extracted directly, not a vendor summary) — administrative/billing software, not a
  medical device, verdict holds even on AI-2's closest-call scrutiny. SAMA payment-licensing
  confirmed out of scope (the success-fee revenue model never touches a regulated payment
  activity under Payments Law Article 6). SDAIA AI law confirmed non-binding/voluntary only — no
  dedicated KSA AI law exists yet. Two genuinely new, previously-untracked findings: the NPHIES
  portal's Terms & Conditions (`nphies.sa/terms-and-conditions`) is a real binding agreement with
  a liability waiver, an indemnity clause favoring NPHIES, and a suspend-without-notice right
  (verified by direct fetch of the live page) — now a counsel-review item; and SDAIA's 72-hour
  breach-notification requirement (no materiality threshold, no exemptions) was never captured
  anywhere in the docs — now a runbook item. PDPL's existing C1 entry corrected (no SDAIA
  adequacy list actually exists — the old wording was ambiguous) and sharpened (Executive
  Regulations confirmed finalized and in ACTIVE enforcement since 14 Sept 2024, not a future risk
  — 48 SDAIA violation decisions across 2025-2026). Business-registration findings all fork on
  **founder nationality**, which no doc states — flagged as the single highest-value thing the
  user must self-disclose. Emails 2 (NPHIES onboarding) and 6 (KSA counsel) extended in place with
  the new questions (bilingual, matching the file's existing format) rather than duplicated — see
  `docs/HUMAN_CONFIRMATION_NEEDED.md` §G for the full 14-item breakdown.
- **2026-07-18, later the same day: design-brief §7 branch-scoping landed for Appeals + Recovery
  (Story A + B), Ingest deliberately left as a non-story.** Orchestrated via the GLM hub-spoke
  orchestrator: 2 sequential `glm-code` spokes (Story A: Appeals, Story B: Recovery — run
  sequentially, not in parallel, since both touch `apps/web/test/data.test.ts`'s shared
  `fakeDb()`/`executedQueries` test infra), each hub-verified independently before the next
  started. `getAppealables(tenantId, limit, branchId?)` (`apps/web/lib/appeals-data.ts`) adds a
  parameterized `AND c.branch_id = ${branchId}` inside its existing `WHERE NOT EXISTS(...)`.
  `getRecovery(tenantId, branchId?)` (`apps/web/lib/data.ts`) moves THREE surfaces together: money
  (`moneyScope(db,{branchIds})` vs the cached `getMoneyScope`, same split `getAnalytics` uses),
  `appealPipelineRows(db, 200, branchId)`, and the win-rate/median-days aggregate — converted from
  a bare `FROM appeals` to the same `appeals a JOIN denials d JOIN claim_lines cl JOIN claims c`
  chain `appealPipelineRows` already used (safe: every FK in that chain is NOT NULL, confirmed
  against `packages/db/src/schema.ts`, so the new INNER JOINs cannot silently drop a row).
  `getOwnerReportData`'s own `appealPipelineRows(db)` call stays untouched (single-arg,
  unfiltered), forever. Both `appeals/page.tsx` and `recovery/page.tsx` resolve `?branch=` via the
  existing `getBranches`+`resolveBranchId` pattern (same security boundary Scrubber/Analytics
  already use) before passing it downstream — never the raw param. `tenant-switcher.tsx` and
  `getAnalytics`'s scope-cut doc-comments narrowed: only Ingest remains unfiltered now (no
  `branch_id` column on `eob_extractions`, no derivable join path — a schema decision per the
  spec, not part of this task). Live-verified via chrome-devtools MCP, both EN + AR, both
  filtered/unfiltered states: Appeals queue 100→79 denials for a real seeded branch; Recovery's
  ROI header + pipeline table moved together (Recovered SAR 66,275→20,512, win rate 66.7%→67.1%,
  Won 25 of 160→25 of 53); the command-bar's own global money indicator stayed unchanged
  throughout (confirmed correct, not a bug — it's fed by the layout's separate unfiltered
  `getMoneyScope` call). A real regression was caught by the hub's own full-workspace `vitest run`
  (neither spoke ran the full suite, only their own scoped files) — 4 sibling test files
  (`recovery-page-dark-contrast.test.tsx`, `recovery-pipeline-action-row-aria-label.test.tsx`,
  `recovery-pipeline-actions-header.test.tsx`, `recovery-pipeline-row-cap-badge.test.tsx`) each
  separately mock `@/lib/data` for the Recovery page and broke once it started calling
  `getBranches`/`resolveBranchId` unconditionally; fixed with the same 2-line mock-factory
  addition across all four. 3 parallel Sonnet reviewers (architecture/correctness, security,
  quality) ran against the full diff — **all three ACCEPTED**; 3 non-blocking nits from the
  quality pass (duplicated test-helper, an inaccurate drizzle-internals comment, a copy-paste
  comment drift) fixed inline before this sync. **A reviewer false-positive, checked and
  disproved, not a real gap:** the architecture reviewer flagged `appeals/page.tsx` as missing an
  `isVisible()` RBAC gate unlike `recovery/page.tsx` — but `rbac.ts`'s `MATRIX` shows `appeals` is
  never `"hidden"` for any role (unlike `recovery`, where clinician is), so no gate applies there
  by design; the write-side is separately gated via `authorizeAction("appeals", ...)`. Gates:
  `pnpm tsc --noEmit` clean; full workspace
  `pnpm vitest run` **1083/1083** (0 fail, 3 skipped, pre-existing skips); `pnpm lint` at the known
  pre-existing baseline (1 unrelated ECC-tooling error + 2 warnings); `pnpm --filter @taweed/web
  build` succeeds, all routes compile. 12 files changed, 304 insertions / 34 deletions. **Not
  committed** — awaiting the user's explicit go-ahead per the standing merge/push gate.
- **2026-07-18, later still: `/audit-workflow` item 1 (bug hunt) — 5 real bugs found and fixed,
  committed + pushed (`ce2c7b5`).** Full detail in `docs/audit docs/bugs.md`. Highlights:
  `apps/web/lib/actions/recovery.ts`'s `markAppealOutcome` gained `SELECT ... FOR UPDATE OF d` to
  close a real TOCTOU double-recovery race (proven against real Postgres in new
  `packages/db/test/recovery-toctou-race.int.test.ts`); `packages/normalizer/src/normalize.ts`'s
  `total_amount`/`line_amount` now throw instead of silently folding a missing FHIR
  `Claim.total`/`item.net` to `"0.00"`; `overview`/`analytics` pages no longer offer clinician a
  "Build owner report" CTA that 404s; `csv-mapping-panel.tsx`'s field-mapping Select no longer
  collapses duplicate CSV header names into one unreachable option;
  `packages/platform/src/object-store.ts`'s `InMemoryObjectStore` gained the same production guard
  `DevPassthroughKms` already had (closes a tracked follow-up from the 2026-07-08 sweep). All
  audit bookkeeping (`bugs.md`/`secure.md`/`audit.md`/`minimap.md`) consolidated into
  `docs/audit docs/`. **Items 2-8 of the 9-item `/audit-workflow` queue are PAUSED — GLM 5h quota
  hit 100% mid-item-1.** Gates: tsc clean, `DATABASE_URL=... npx vitest run` **1092/1092** (0 fail,
  3 skipped pre-existing), lint at known baseline, `pnpm --filter @taweed/web build` green.
- Roadmap: CREATE ✅ → IMPLEMENT ✅ → **EXECUTE (buildable pass ✅ · UI tail A2/A3 ✅ · B6 field-mapping panel ✅ · headline pending real data)** → **AI phase (AI-0 ✅ · AI-1 ✅ · AI-2 ✅ · AI-3 ✅ · AI-4 ✅ + real-data-gaps closed ✅ · AI-5 deferred)** → DEPLOY.

## Can you start now?

**The buildable half of EXECUTE is fully DONE on synthetic data** (E2E/a11y/Lighthouse in CI, first-run corridor, free-audit + owner report, landing, the B6 field-mapping panel, real-data scaffolding B5–B8, typed DEPLOY swaps). **The headline** (recovered-SAR on a real clinic) is human-gated — see `docs/blocker.md` (needs B1 design-partner data + B2 real codes + B9 SME sign-off).

Soft caveats:

- Run `pnpm install` first (`node_modules` not committed).
- **Local-only (gitignored), on the owner's device, NOT in a fresh clone:** `design/` (UI source assets), `docs/NEXT_STEP_PROMPT.md`, `docs/blocker.md`, `docs/superpowers/`, `docs/screenshots/`, and root `ECC_GUIDE.md`. Start on the owner's machine, or copy them over. (`docs/STEP_SUMMARY.md` removed 2026-07-20 — stale 2026-07-05 snapshot, fully superseded by this file.)
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
- `packages/fhir` — R4 parse + full base-R4 validate down to every SHALL leaf element (`@medplum/fhirtypes` for types only; audited + hardened 2026-07-17, was top-level-only before); `validateAgainstNphiesProfile()` is a creds-gated stub, boundary confirmed license-gated-too (real IG validation = B6).
- `packages/normalizer` — FHIR pair → canonical rows, denials exploded.
- `packages/db` — **Drizzle** schema + migrations **through `0009`**, **RLS (FORCE + non-superuser `taweed_app` role)**, `withSession` → `withTenant` (auth-derived tenant), `insertNormalizedClaim`. **EXECUTE:** `0004` adds `claims.data_origin` (CHECK synthetic|production) + nullable real signal columns; `0005` adds `recovery_baselines`. **AI-0:** `0006` adds `llm_calls` (append-only LLM audit, hashes only), `flag_explanations` (AI-1 dedupe cache), `tenant_ai_settings` (per-tenant AI kill switch). **AI-2/AI-3:** `0007` adds `appeal_suggestions` + rule-authoring columns; `0008` backfills `rules.status` as the single source of rule liveness. **AI-4:** `0009` adds `eob_extractions` (`pending_review`/`approved`/`rejected`, mutable — not append-only like `llm_calls`). All tenant-scoped tables RLS ENABLE+FORCE + tenant_isolation policy. *(The custom migrate runner applies all `drizzle/*.sql` sorted.)*
- `packages/audit` — **BUILT.** Append-only PHI audit log; tenant from the active RLS GUC; PHI-leak guard. Written on every PHI read/write/export.
- `packages/rules-engine` — **BUILT.** `json-rules-engine` scrubber, **15 rules-as-data**, golden-set harness; `ScrubResult` traces every flag to a named rule + the failed field. **EXECUTE:** `project.ts` (`projectClaimFacts` real/synthetic split + the B5 production guard; `ClaimFacts` real signals widened to `| null`); `select.ts` (`selectRulesForClaim` — payer/tenant scope + version resolution, B7); the 3 payer rules carry explicit `payerId` metadata.
- `packages/appeals` — **BUILT.** Deterministic **bilingual EN/AR** appeal letters, document checklist, human-in-the-loop, **never auto-submits**.
- `packages/analytics` — **BUILT.** Rollups over canonical rows: denial rate, at-risk / recovered SAR, Pareto, trend. **EXECUTE:** `resolveRecovery` (recovered-exceeds-appealed guardrail, §8.5), `captureBaseline`/`getLatestBaseline` (onboarding baseline), `recoverability`/`recoverabilityByPayerReason` (recovered-outcome feedback loop, B7/B8).
- `packages/ingest` — **BUILT (EXECUTE B6 + AI-4).** Real-data intake: `parseDelimited` (dependency-free RFC-4180 CSV/TSV), `detectFieldMapping`/`applyMappingOverrides` (column→field with confidence + override), `resolveDimension(s)` (per-tenant find-or-create from partner data). `parseXlsx` is a typed adapter stub (inject SheetJS at DEPLOY). **AI-4:** `pdf-text-layer.ts` (`extractPdfTextLayer` — born-digital PDF text extraction via `pdf-parse`/`pdfjs-dist`, self-polyfills `@napi-rs/canvas`'s DOMMatrix/ImageData/Path2D globals since pnpm's strict isolation breaks pdfjs-dist's own polyfill lookup), `eob-extraction-adapter.ts` (the `EobExtractionAdapter` seam + `extractEobFromPdf`, forwards `{hiRes, textLayer}` opts through to the concrete adapter).
- `packages/ai` — **BUILT (AI-0 through AI-4).** The only package that talks to an LLM. `provider.ts` (`LlmProvider`/`LlmClient` narrow swap surface, now with a per-request `timeoutMs` override), `anthropic-1p.ts` (`@anthropic-ai/sdk` `messages.parse` + `zodOutputFormat`, 30s default timeout overridable per-call, extracted+tested response mapping, `INFERENCE_GEO="us"` pinned on every call), `fixture.ts` (record/replay for CI), `run.ts` (audited runner — 3-layer kill switch, short transactions around the network call, audit on every attempt incl. failures), `audit.ts` (`writeLlmCall` hashes-only + PHI-leak guard), `pseudonymize.ts` + `postprocess-ar.ts` (pure, 100% covered), `config.ts`/`errors.ts` (kill switches + `AiDisabledError`), `schemas/{flagExplanation,scrubRuleDraft,eobExtraction}.ts`, `features/{explainFlag,assistAppeal,authorRule,extractEob}.ts` (AI-1 through AI-4), `eob-validators.ts` (AI-4's deterministic cross-total/text-layer/enum gate), `adapters/claude-vision-ocr.ts` (AI-4's sonnet→opus escalation adapter). `evals/` (live smoke evals + AI-4's `extractEob.eval.ts` scaffold, `AI_EVALS_LIVE=1` only — its `PdfRenderer` seam is now wired to a real Playwright rasterizer (`test/synthetic-eob/src/rasterize.ts`), see the AI-4 real-data-gaps entry above; a real scored pass against the Anthropic API still hasn't been run). `eob-validators.ts` now models 5 money buckets per line (billed/paid/patient-share/rejected/adjustment). Exports feature fns + gates + pure helpers ONLY — never the provider client or the runner.
- `packages/platform` — **BUILT (EXECUTE C, typed swaps).** `ObjectStore` + `InMemoryObjectStore` (per-tenant keyed) + `S3ObjectStoreConfig` (`me-riyadh-1`, SSE); `TenantKms` + `DevPassthroughKms` (dev stub, NOT real crypto, cross-tenant decrypt refused); `ksaOidcConfigFromEnv` + `KsaOidcConfig` (BLK-7 swap, fails closed). Dev impls now; real KSA-region clients at DEPLOY.
- `infra/` — **BUILT (EXECUTE C, skeleton).** Terraform pinned to Oracle Cloud Riyadh `me-riyadh-1` (Postgres + S3-compatible store + per-tenant KMS), resources commented until BLK-8 creds; NOT applied. `*.tfstate*`/`*.tfvars`/`*.pem`/`*.key` gitignored.
- `apps/web` — **BUILT.** Next 15 App Router. Design tokens (`globals.css`) → Tailwind + hand-built shadcn/Radix primitives → EN/AR RTL (`next-intl`, logical properties, `dir` on `<html>`) → light/dark → Auth.js **dev credentials** (gated dev-only; `TODO(ksa-oidc)` swap = B7) → app-level RBAC (owner/finance/rcm/clinician/admin), **server-enforced** in server actions → three-zone shell + persistent dual money indicator with count-up. Five module surfaces: Ingest, Denial Analytics, Scrubber, Appeal Generator, Recovery.
  - Seams: `apps/web/lib/{db,auth,session,rbac,authz,audit,data,appeals-data}.ts`, `lib/actions/*` (server actions), `components/{ui,shell,charts,money,modules}`, `i18n/*`, `messages/{en,ar}.json`.
- `test/synthetic-fhir` — deterministic R4 bundle generator (9 scenarios).
- CI: `.github/workflows/ci.yml` (lint + typecheck + unit + integration w/ Postgres service + **`e2e` job** — Playwright + a11y against a seeded Postgres, EXECUTE A1).
- `apps/web` **EXECUTE additions:** marketing landing at `/[locale]` for logged-out visitors (`components/marketing/landing.tsx`, A4); `playwright.config.ts` + `tests/e2e/*` (smoke/a11y/money-arc, A1); `lib/data.ts` uses `projectClaimFacts` + `selectRulesForClaim`; `lib/actions/recovery.ts` uses `resolveRecovery`; `lib/utils.ts` `cn()` teaches tailwind-merge the custom fontSize scale (app-wide hero-size fix). **AI-1 additions:** `lib/actions/explain-flag.ts` (server action → `@taweed/ai` `explainFlag`, re-derives prompt from `SCRUBBER_RULES`, RBAC-gated, catches `AiDisabledError` → deterministic); `components/modules/flag-explainer.tsx` (additive bilingual popover); `lib/data.ts` `ScrubRow` carries `ruleVersions`; `@taweed/ai` added to deps + `transpilePackages`; EN/AR scrubber i18n keys. **AI-2/AI-3 additions:** `components/modules/appeals-composer.tsx` (AI-2 "Suggest" panel), `components/modules/rule-authoring.tsx` + the authored-rule library (AI-3 Draft/Gate/Approve flow), Settings "Author" tab. **AI-4 additions:** `lib/actions/{eob-extract,eob-review}.ts` (upload entrypoint + approve/reject, approve re-validates arithmetic on edited values), `lib/eob-review-data.ts` + `lib/eob-to-normalized.ts`, `components/modules/eob-review-queue.tsx` + `components/modules/eob-review/{confidence-badge,eob-extraction-form}.tsx`, a second "Review queue" tab on the Ingest page; `next.config.mjs` gained `serverExternalPackages` + explicit webpack `externals` for `pdf-parse`/`pdfjs-dist`/`@napi-rs/canvas`'s native binary. `lib/chart-colors.ts` (new, 2026-07-08 design-audit fix — shared SVG-safe hex for Pareto/TrendLine, was duplicated in two files). **EXECUTE UI tail (A2/A3) additions, 2026-07-10:** `app/[locale]/(onboarding)/{layout,onboarding/page}.tsx` (chromeless first-run corridor route), `components/modules/onboarding-corridor.tsx`, `lib/onboarding.ts` (`isOnboarded`), `lib/actions/onboarding.ts` (`completeOnboarding`); `app/[locale]/(app)/analytics/audit-report/page.tsx` + `app/[locale]/(app)/recovery/owner-report/page.tsx`, `components/modules/{report-shell,audit-report-document,owner-report-document}.tsx`, `lib/report-data.ts` (`recoverableSplit`/`projectedRecoveryRange`/`aggregateTopPayers`), `lib/data.ts` gained `getAuditReportData`/`getOwnerReportData` + a shared `appealPipelineRows` helper (extracted from `getRecovery`); `components/modules/ingest-panel.tsx` gained an additive optional `onIngestSuccess` prop; `app/[locale]/(app)/layout.tsx` gained `print:hidden`/`print:` wrappers for the two new report pages. **AI-4 real-data-gaps additions, 2026-07-10:** `eob-review.ts`'s `EditedLine`/`EditedClaim` gained `adjustmentSar`/`totalAdjustmentSar`; `eob-extraction-form.tsx` gained the matching 5th `MoneyField` per line/claim (sign-aware `halalasToSarDisplay`, see the money-path callout above); `eob-review-data.ts` gained `backfillLegacyAdjustmentFields` (pre-Gap-2 `eob_extractions` rows backfill to `adjustmentHalalas: 0` on read); `apps/web/lib/money.ts`'s `SAR_MONEY_REGEX` gained a 12-digit integer-part bound (money-path fix). **Branch-scoping additions, 2026-07-18 (design-brief §7, Appeals + Recovery):** `lib/appeals-data.ts`'s `getAppealables` and `lib/data.ts`'s `getRecovery`/`appealPipelineRows` all gained an optional `branchId` param (parameterized, RLS-safe, resolved via the existing `getBranches`+`resolveBranchId` pair); `app/[locale]/(app)/{appeals,recovery}/page.tsx` both resolve `?branch=` before passing it through. Only Ingest remains unfiltered (no `branch_id` column on `eob_extractions`, a schema decision, not a story).

## Must-read before building

- `docs/NEXT_STEP_PROMPT.md` — the **EXECUTE** prompt (local only).
- `docs/blocker.md` — blocker register + a paste-ready unblock prompt per blocker (local only).
- `docs/deferred.md` — `DEF-*` registry of deliberately-parked build decisions (optimizations/features we've *chosen not to build yet*, each with rationale + revisit trigger). Distinct from `blocker.md` (external gates) and `review.md` §2.11 (issues in existing code). Current entry: **DEF-1** text-layer-first extraction routing (parked 2026-07-16 — see the calculation there).
- `docs/02_product_build_plan.md` §2/§7/§8 · `docs/03_design_brief.md` (UI system) · `ECC_GUIDE.md` (tooling, at repo root, local only).
- `docs/superpowers/CREATE_review_followups.md` — **now CLOSED** in migration `0003` (auth-derived `tenant_id`, composite same-tenant FKs, money precision). Kept for history (local only).

**Standing rules for `docs/NEXT_STEP_PROMPT.md` rewrites (committed here, since that file itself is
gitignored and could in principle be regenerated from scratch without a prior copy to read from —
this is the durable anchor):**
1. **Docs sync on completion is mandatory, not optional, and not just `handoff.md`** — `handoff.md` +
   `review.md` (if the unit changes anything §2.9–§2.12 describes) + rewriting
   `docs/NEXT_STEP_PROMPT.md` itself for the step after + the Obsidian brain note, before commit →
   merge → `back-up` ritual → push (push always gated on the user's explicit go-ahead).
2. **The LAST LINE of the final report to the user** (after all workflows/agents finish, not buried
   mid-summary) **must state whether `docs/NEXT_STEP_PROMPT.md` exists and whether it has a blocker
   that fully prevents completion of its actual next buildable task** — distinct from adjacent
   blocker-gated items that aren't that task.
3. **Any UI-touching unit gets a chrome-devtools MCP live-verification pass**, not just unit/
   component tests — drive the actual affected page(s), EN/AR + both themes where relevant — capped
   at **3 open tabs at a time** (`list_pages`/`close_page`, close before opening the next).

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

- **The app lives on `main` in this dir** (`~/Desktop/web apps/taweed`). IMPLEMENT was built in a worktree (`worktree-create-data-pipeline`, merged to `44e0e13` + deleted). The **EXECUTE buildable pass** was built on branch `execute-phase` and **merged to `main`**. **AI-4 (PROMPT 3)** was built in-place on branch `ai-phase-4` and has been **merged to local `main`** (merge commit `78b7801`, 2026-07-08). The 6-pass **audit sweep** (2026-07-08 through 2026-07-10) was committed directly on `main` in-place. **The EXECUTE UI tail (A2 + A3) was built on branch `execute-ui-tail`, merged into `main` (merge commit `bcb980c`) and PUSHED to `origin/main`, 2026-07-10** — `git branch -d execute-ui-tail` after the merge (fully merged, no data loss). **Correction to this file's own prior claim:** the "local `main` 12 commits ahead of `origin/main`, last pushed tip `9813fc6`" note carried since the audit sweep was **stale** — `git fetch` before this merge showed `origin/main` was already at `62d0beb` (0 ahead/0 behind local `main` at that point), so whatever pushed the audit-sweep commits did so without this file being updated to say so. Lesson: trust `git fetch` + `git rev-list --left-right --count origin/main...main` over a doc's claimed commit-ahead count before any push/merge decision.
- **Backup-branch rule — `back-up` is the pre-advance `main` tip (restore point).** Before any push that advances `main`, snapshot the current (soon-to-be-previous) **pushed** `main` tip onto `back-up`. **As of this writing (after the 2026-07-16 first-real-tester bug-fix pass push), `back-up` = `a072d0c`** (the pre-commit `main`/`origin/main` tip — the `.gitattributes` LF-line-endings commit, confirmed via `git fetch` immediately before pushing) **and `main`/`origin/main` = `034c2ed`** (`fix: resolve first real-tester bug pass (AI-1, AI-4, Recovery, search, branch filter)`, a plain commit on `main` directly, no merge — this pass wasn't built on a feature branch). `back-up` is a direct git-graph ancestor of `main` (confirmed via `git merge-base --is-ancestor origin/back-up origin/main`), one commit behind, matching the ritual's intent. Local `pnpm typecheck`/`pnpm test`/`pnpm test:int`/`pnpm lint`/`pnpm build` all confirmed green on the pushed tip before pushing (no CI run separately checked post-push as of this note).
- As of this writing (after the AI-4 real-data-gaps push, superseded by the entry above): `back-up` = `8aa8677` (the pre-merge `main`/`origin/main` tip, confirmed via `git fetch` immediately before the merge) and `main`/`origin/main` = `00c7dfe` (the merge commit carrying the rasterizer + adjustment bucket). `back-up` is a direct git-graph ancestor of `main` (one merge-edge behind, confirmed via `git log -1 <merge>^1`), matching the ritual's intent. CI (lint/typecheck/unit, integration, E2E+a11y) confirmed green on the pushed tip. (B6's own push, `ff2e438` into `bcb980c`'s successor `8aa8677`, also followed this ritual — this line just wasn't re-synced after it; noted here so the note doesn't go stale again.)
- **As of this writing (after the FHIR R4 validator audit push, 2026-07-17), `back-up` = `e771a58`**
  (the pre-push `main`/`origin/main` tip — the 3 docs-only commits synced earlier the same session,
  confirmed via `git fetch` immediately before pushing) **and `main`/`origin/main` = `66342be`**
  (`fix: full FHIR R4 SHALL-element validation + ClaimResponse.outcome semantics`, a plain commit on
  `main` directly, no merge branch — local `main` fast-forwarded cleanly to `origin/main`'s 3
  concurrent docs commits first, one real conflict in `docs/handoff.md`'s top blockquote resolved by
  hand, before this commit landed on top). `back-up` is a direct git-graph ancestor of `main` (one
  commit behind, confirmed via `git merge-base --is-ancestor back-up main`), matching the ritual's
  intent. `git push -f origin back-up` was blocked once by the Claude Code auto-mode safety
  classifier (force-push flagged); the user gave explicit real-time go-ahead and it succeeded on
  retry — standing policy per `CLAUDE.md` (ask in the moment, no written bypass). Local
  `pnpm typecheck`/full `vitest run` (unit+integration against the local Postgres container, 452
  suites / 1075 tests, 1072 pass / 0 fail / 3 skipped)/`pnpm --filter @taweed/web build` all
  confirmed green on the pushed tip before pushing (no CI run separately checked post-push as of
  this note).
- **As of this writing (after the `/autopilot` full-walkthrough-audit push, 2026-07-17, same day),
  `back-up` = `0c8f800`** (the pre-push `main`/`origin/main` tip — the FHIR-audit git-workflow
  doc-sync commit) **and `main`/`origin/main` = `e0ffaa5`** (`fix: EOB outcome-semantics twin +
  Owner-report discoverability link`, a plain commit on `main` directly, no merge branch, no
  divergence from `origin/main` to reconcile this time). `back-up` is a direct git-graph ancestor
  of `main` (confirmed via `git merge-base --is-ancestor back-up main`), one commit behind,
  matching the ritual's intent. `git push -f origin back-up` succeeded on the first attempt this
  time (no classifier block). Full `vitest run` (454 suites / 1076 tests, 1073 pass / 0 fail / 3
  skipped), typecheck, lint (baseline), and `pnpm --filter @taweed/web build` all confirmed green
  on the pushed tip before pushing — plus 3 parallel Sonnet reviewers (architecture/correctness,
  security, quality), all ACCEPT round 1, before the commit was made at all.
- **As of this writing (after the branch-scoping push, 2026-07-18, later the same day),
  `back-up` = `83b3347`** (the pre-push `main`/`origin/main` tip — the `extractEob` maxTokens
  git-workflow doc-sync commit) **and `main`/`origin/main` = `f1cc96e`**
  (`feat: branch-scoping (design-brief §7) for Appeals + Recovery`, a plain commit on `main`
  directly, no merge branch, no divergence from `origin/main` to reconcile). `back-up` is a direct
  git-graph ancestor of `main`, one commit behind, matching the ritual's intent.
  `git push -f origin back-up` was blocked once by the Claude Code auto-mode safety classifier
  (force-push flagged); the user gave explicit real-time go-ahead and it succeeded on retry —
  same standing policy as the 2026-07-17 entry above. Full `vitest run` (1083/1083, 0 fail, 3
  skipped pre-existing), typecheck, lint (known baseline), and
  `pnpm --filter @taweed/web build` all confirmed green on the pushed tip before pushing — plus 3
  parallel Sonnet reviewers (architecture/correctness, security, quality), all ACCEPT round 1,
  before the commit was made.

  ```bash
  git branch -f back-up main        # snapshot the current main tip (the 'old' commit)
  git push -f origin back-up         # mirror the backup to origin
  # ...now commit/merge the new work onto main...
  git push origin main               # main advances; back-up stays one commit behind
  # restore if a push goes bad:
  git reset --hard back-up           # (or inspect first: git checkout back-up)
  ```

- **As of this writing (after the AI-4 eval-fix + KSA-compliance-audit push, 2026-07-18),
  `back-up` = `7d70a60`** (the pre-push `main`/`origin/main` tip — the prior session's
  `e0ffaa5`-push doc-sync commit) **and `main`/`origin/main` = `ee9c9e5`**
  (`fix: AI-4 eval scoring bug (corpus never rendered claim identity) + KSA compliance audit`, a
  plain commit on `main` directly, no merge branch, no divergence from `origin/main` to reconcile —
  `git fetch` immediately before pushing showed 0 behind/1 ahead). **Self-correction mid-ritual:**
  the first `git branch -f back-up` was run *after* committing, from `main`'s new tip, so it
  briefly pointed `back-up` at the same commit as the new `main` (a no-op restore point) instead of
  the prior tip — caught before the follow-up doc commit, `back-up` re-pointed to `7d70a60` and
  force-pushed again; confirmed one commit behind `main` (`git merge-base --is-ancestor back-up
  main`) before writing this note. `git push -f origin back-up` was blocked once by the classifier
  on the first (corrected) push; the user gave explicit real-time go-ahead and it succeeded on
  retry — same standing policy as every prior instance (ask in the moment, no written bypass).
  Local `pnpm typecheck` / full `pnpm test` (157 suites / 1031 tests, all pass) / `pnpm test:int`
  (9 suites / 42 tests, all pass, DB re-seeded after per the destructive-test convention) /
  `pnpm lint` (clean on every file this pass touched — one pre-existing, gitignored, untracked
  tooling-script parse error unrelated to this diff, not fixed as out of scope) /
  `pnpm --filter @taweed/web build` all confirmed green on the pushed tip before pushing.

- **As of this writing (after the size-diversity fixtures / extractEob maxTokens-fix push,
  2026-07-18, same day), `back-up` = `82bf051`** (the pre-push `main`/`origin/main` tip — the
  prior push's own doc-sync commit) **and `main`/`origin/main` = `121806f`**
  (`fix: extractEob maxTokens truncation on large documents + size-diversity test fixtures`, a
  plain commit on `main` directly, no merge branch, no divergence — `git fetch` immediately before
  pushing showed 0 behind/1 ahead). `back-up` confirmed one commit behind `main`. `git push -f
  origin back-up` succeeded on the first attempt this time (no classifier block) — the user's
  request that triggered this push explicitly pre-authorized "commit and push and if needed force
  push backup," so no separate real-time go-ahead was needed. Local `pnpm typecheck` / full `pnpm
  test` (157 suites / 1033 tests, all pass) / `pnpm test:int` (9 suites / 42 tests, all pass, DB
  re-seeded after) / `pnpm lint` (clean on every file this pass touched) / `pnpm --filter
  @taweed/web build`, PLUS the real 44-item × 2-tier live `AI_EVALS_LIVE=1` eval itself (both
  tests passing clean post-fix), all confirmed green on the pushed tip before pushing.

- **As of this writing (after the audit-workflow item-1 bug-fix push, 2026-07-18, later the same
  day), `back-up` = `e1c58e1`** (the pre-push `main`/`origin/main` tip — the branch-scoping
  git-workflow doc-sync commit, confirmed via `git fetch` immediately before pushing, 0
  behind/1 ahead) **and `main`/`origin/main` = `ce2c7b5`** (`fix: audit-workflow item 1 — 5 real
  bugs found+fixed`, a plain commit on `main` directly, no merge branch). `back-up` confirmed one
  commit behind `main`. `git push -f origin back-up` succeeded on the first attempt (no classifier
  block this time). Full `DATABASE_URL=... npx vitest run` (repo root, unit+integration) —
  **1092/1092, 0 fail, 3 skipped** — typecheck, lint (known baseline), and
  `pnpm --filter @taweed/web build` all confirmed green on the pushed tip before pushing. See
  `docs/audit docs/bugs.md` and `docs/audit docs/audit.md` for the full findings/fix detail — this
  was `/audit-workflow` item 1 of a 9-item queue (item 9 skipped, not public-facing yet); **items
  2-8 are PAUSED, GLM 5h quota hit 100% mid-item-1** — resume once a confirmed reset lands (see
  `resume.md` at repo root if this session is picking back up from that pause).

- **As of this writing (after the audit-workflow items 2-5 pushes, 2026-07-18, later the same
  session — GLM quota reset + upgraded Lite→Pro mid-pause), `back-up` = `f4a3217`** (the pre-push
  `main`/`origin/main` tip — item 4's dependency-audit doc commit) **and `main`/`origin/main` =
  `80d854e`** (`fix: audit-workflow item 5 — 3 WCAG AA findings in tenant-switcher branch
  selector`, a plain commit on `main` directly, no merge branch). `back-up` confirmed one commit
  behind `main`; `git push -f origin back-up` succeeded on the first attempt (no classifier block).
  This entry covers 4 pushes that landed without an intermediate `back-up` sync each time (items
  2-4 were docs-only/read-only passes, low risk; item 5 is the first with real source changes
  since the item-1 entry above, so `back-up` is caught up now):
  - Item 2 (security, 4 parallel GLM finders) — `1948c5c`, 0 confirmed findings, read-only.
  - Item 3 (API/server-action auth-check, 1 GLM finder) — `3723cad`, 0 confirmed across 22
    entrypoints, read-only.
  - Item 4 (dependency CVEs, agy 3-agent research) — `f4a3217`, 0 confirmed current
    vulnerabilities; agy's 4 "active CVE" claims all independently verified wrong (real CVEs
    misapplied to the wrong installed version) — see `docs/audit docs/deps.md` pass #17.
  - Item 5 (WCAG AA, 1 GLM finder + hub live chrome-devtools verify + 1 GLM fixer) — `80d854e`, 3
    confirmed findings in the new branch-scoping `tenant-switcher.tsx`, all fixed and
    hub-live-reverified (real accessible-name tree + real computed-style contrast) — see
    `docs/audit docs/a11y.md` pass #18.
  Gates confirmed green on `80d854e` before pushing: typecheck (root + `apps/web`) clean; full
  unit suite **1053/1053** (158 files); `apps/web` production build green. Integration suite not
  re-run for item 5 (UI-only fix, no DB/backend code touched — re-wiping the shared local Postgres
  would be disproportionate; items 2-4 were read-only, no gates needed beyond what each pass
  documents).

- **As of this writing (after the audit-workflow items 6-8 pushes, 2026-07-18, completing the
  9-item queue — item 9 stays skipped per the standing not-public-facing gate), `back-up` =
  `39560b8`** (the pre-push `main`/`origin/main` tip — item 7's fix commit) **and
  `main`/`origin/main` = `050565f`** (`docs: audit-workflow item 8 (UI anti-slop) — 0 confirmed
  findings`, a plain commit on `main` directly, no merge branch). `back-up` confirmed one commit
  behind `main`; `git push -f origin back-up` succeeded on the first attempt (no classifier
  block). This entry covers 3 pushes:
  - Item 6 (codebase minimap, 1 GLM re-map spoke + 1 GLM fix spoke) — `de37531`: new Docker
    subsystem documented; backlog cross-checked (0 resolved, 2 sharpened); 1 safe fix landed
    (duplicated branch-scope block → `resolveBranchScope` helper); 1 candidate (Dockerfile COPY
    list) deliberately deferred as unverifiable on this host (`docker build` hangs here).
  - Item 7 (ponytail over-engineering, hub-run + 1 GLM fix spoke) — `39560b8`: 1 dead field
    removed (`LlmProvider.capabilities`, never read at runtime, -39 lines); 1 candidate REJECTED
    (2 EOB-extraction fallback-ladder adapter stubs — same deliberate external-blocker-gated
    pattern as `packages/platform`, an Explore agent had wrongly flagged them as dead).
  - Item 8 (UI anti-slop, 1 GLM finder + hub grep spot-check) — `050565f`: 0 confirmed findings
    out of 8 AI-SaaS-template tells across the landing page, login page, and 3 dashboard pages.
  Gates confirmed green on `050565f` before pushing: typecheck clean; full unit suite **1051/1051**
  (2 fewer than item 5's count — the 2 dead-field test blocks item 7 correctly removed); `apps/web`
  production build green. See `docs/audit docs/{minimap,ponytail-debt,ui-slop}.md` (minimap/
  ponytail-debt/ui-slop are gitignored, local-only) and `audit.md` passes #19-21 for full detail.
  **This completes all 9 queued items** (1-8 done, 9 skipped) — item 10 (final `audit.md` summary)
  follows this same push.

- **As of this writing (after the CI-failure catch + fix + item-10 summary pushes, 2026-07-18 into
  2026-07-19, same session), `back-up` = `1ef7b72`** (the lint-fix commit itself) **and
  `main`/`origin/main` = `4bdf920`** (`docs: audit-workflow item 10 — queue completion summary`).
  **Real CI failure caught this window**: item 7's fix (`39560b8`) shipped a real
  `@typescript-eslint/no-unused-vars` error (`createAnthropicProvider` imported but unused after
  its only consuming test block was deleted) — missed locally because the known
  `.claude/**`-untracked-harness lint noise crowded out the real error in the same `pnpm lint`
  output, and lint wasn't re-run after item 7's fix (typecheck/tests/build were, lint was assumed
  clean from the established baseline). **Caught via a CI-failure email the user forwarded**, not
  by the hub's own verification — fixed same session (`1ef7b72`), re-verified in isolation
  (`eslint packages/ai/test/anthropic-1p.test.ts` clean, root typecheck clean, the specific test
  file 10/10), pushed. **CI confirmed green** on both the fix commit and every commit after it
  (`a796b65`, `4bdf920`) via `gh api .../actions/runs` polling before this `back-up` sync — not
  assumed from local gates alone this time. `back-up` confirmed one commit behind `main` (an
  earlier self-correction was needed mid-sync: a `git branch -f back-up` was first run from `main`'s
  own new tip, briefly pointing `back-up` at the same commit as `main` — caught and re-pointed to
  the correct one-behind commit before push, same class of mistake this file's own 2026-07-18 AI-4
  entry already documents). Lesson recorded in `docs/audit docs/audit.md`'s Learnings: **never skip
  `pnpm lint` after any spoke fix touching source, even when local output "looks like the usual
  baseline" — read the whole output, don't pattern-match.**
  This closes out the full 2026-07-18 `/audit-workflow` 9-item queue (items 1-8 done, 9 skipped
  per the standing gate, item 10 this summary) — genuinely done, CI-verified, nothing pending.

- **Isolated feature work** (e.g. EXECUTE): create a fresh worktree + branch (`superpowers:using-git-worktrees`), build, merge to `main`, then delete the worktree + branch. NOTE: gitignored local docs (`docs/NEXT_STEP_PROMPT.md`, `docs/blocker.md`, `design/`, …) do **not** sync between a worktree and `main` — edit them directly in whichever dir you read from.

- **As of this writing (user-reported production bug fix, 2026-07-19), `main`/`origin/main` =
  `c554e1c`** (`fix: Recovery/EOB/rule-authoring/branch-switcher stale UI after client action`).
  The user tested a real Docker production build on a separate Windows machine and reported 3
  symptoms (Recovery totals not auto-refreshing after mark-won, laggy/unreliable branch switching,
  an appeal draft not appearing without touching a filter first) — see `docs/audit docs/bugs.md`
  passes #22-23 for the full investigation trail. Two real, distinct bugs were found and fixed this
  session:
  - **The real root cause of the "no auto-refresh" family (bugs.md finding #24):** not
    Server-Actions-specific, not Docker-specific, not the `revalidatePath` target — a client-side
    RSC re-render gap in this exact Next 15.5.20/React 18.3.1 production build. The mutation +
    `revalidatePath` are 100% correct server-side (confirmed via `curl` immediately after a
    mark-won showing the fresh total every time, and via Link-based navigation always showing
    fresh data) — but `router.refresh()` (Recovery, EOB review queue, rule authoring) and
    `router.push()` for a same-route query-param change (the branch switcher) all issue a genuine
    200/no-cache RSC fetch that React silently never applies to the DOM. No console error, no
    rejected promise. Fixed pragmatically at all 4 call sites by forcing a **hard navigation**
    (`window.location.reload()`/`.href`) instead of relying on the broken soft-update path — this
    is blunter than the ideal seamless update but is what's actually proven reliable, every time,
    against a rebuilt production server (local and Docker) via chrome-devtools MCP, across EN/AR
    and light/dark. The real fix is the deferred React 19 upgrade (`deps.md` already flags this);
    revisit these 4 sites once that lands.
  - **A compounding, separate React 18 bug:** `useTransition`'s `startTransition(async () => {...})`
    pattern is off-label on React 18 (async transition callbacks are a React 19 feature) — it left
    the Recovery mark-won/lost buttons stuck permanently disabled/pending, independent of the
    RSC-apply gap above. Fixed by dropping `useTransition` for plain local `useState` pending flags.
  - **Bug 3 (appeal draft not appearing) — confirmed resolved, not a separate bug:** re-tested
    directly (first-click load, rapid row-switching) and it never reproduced against the current
    build, which already has the earlier concurrent-queries-on-shared-client fix
    (`data.ts`, bugs.md finding #22) applied. No code change needed for this one.
  Gates confirmed green on `c554e1c` before pushing: typecheck (root) clean; `pnpm lint` clean (the
  only 2 warnings + 1 error are in untracked `.claude/**` harness scripts, same known-noise pattern
  as prior passes — zero issues in `apps/web`/`packages/*`); full unit suite **1049/1049** (158
  files); integration suite **43/43** against a real re-seeded Postgres (destructive — DB was
  re-seeded after, per §1.5/§1.11 of `docs/review.md`); `apps/web` production build green (local
  and a full `docker compose build --no-cache` + `up -d --force-recreate`, verified live via
  chrome-devtools MCP against both). Also ran the full `docs/review.md` Part 1 walkthrough:
  login/logout + role picker, all 7 modules (Overview, Analytics + branch filter, Ingest + Review
  queue, Scrubber + detail panel, Appeals + draft load/switch, Recovery + outcomes, Settings +
  Author tab), EN/AR, light/dark, and tenant isolation (Al Salama Dental Group vs. Noor Polyclinic
  — confirmed fully separate data) — all clean.

- **First real production deployment, to Vercel + Neon Postgres (2026-07-24).** Taweed is now
  genuinely live at `https://taweed.vercel.app` — synthetic-data demo, dev-auth intentional
  (real KSA-resident OIDC and the business blockers in `blocker.md` remain out of scope for this
  deploy). Hit and fixed a real production bug along the way: `@napi-rs/canvas`/`pdf-parse`
  MODULE_NOT_FOUND on the deployed Ingest upload route. Root cause was NOT a Next.js Output File
  Tracing gap (the first, plausible-looking fix attempt) — it was pnpm's strict per-package
  `node_modules` isolation: those two packages were only declared in `packages/ingest`'s own
  `package.json`, so `apps/web`'s compiled runtime had no resolvable symlink to them at all. Fixed
  by declaring both as direct `apps/web` dependencies too (see `docs/audit docs/audit.md` pass #26
  for the full diagnostic trail, including the temporary diagnostic route used to get ground truth
  from the live deployed function's filesystem). CI caught a real, pre-existing `next-auth`/
  `@auth/core` CVE trio (2 critical, 1 high) on the first push — fixed by bumping to the actual
  patched prerelease (`5.0.0-beta.32`), full-tree `pnpm audit` clean, CI green, live sign-in
  re-verified post-fix.

- **Production-hardening pass, 2026-07-24 (same day, follow-on `/autopilot` loop).** Explicit user
  scope: caching, async background jobs, load testing, seeding reliability root-cause, and
  `seed-prod.ts` proof — real auth and the business blockers (`BLK-7`/`8`/`9`) explicitly excluded.
  All 5 stories landed:
  1. **Caching** — `apps/web/lib/data.ts`'s 5 analytics bundle functions now wrapped in
     `unstable_cache` (Next's Data Cache), tenant-scoped keys + tags (`apps/web/lib/cache-tags.ts`),
     `revalidateTag` wired into every write path that changes claims/denials/appeals data. A
     cross-tenant cache-leak test (`apps/web/test/data-cache.test.ts`) was deliberately verified to
     actually fail when the tenant-scoping is removed, not just pass by construction.
  2. **Async background jobs** — `extractEobPdfAction` (`apps/web/lib/actions/eob-extract.ts`) now
     inserts a `processing` row and returns fast; the heavy PDF-parse + AI-extraction work runs in
     `after()` (`next/server`), transitioning the row to `pending_review`/`failed`. A 10-minute
     stale-row reaper guards against a killed process leaving a row stuck at `processing` forever.
  3. **Load testing** — `scripts/load-test.ts` (autocannon) actually run against the real
     production URL: zero errors/timeouts across 3 scenarios, real latency numbers captured in
     `docs/load-test-report.md`. Honest finding recorded there: the cache's effect isn't visible in
     end-to-end HTTP latency at this load (dominated by Hobby-tier cold-start/network overhead, not
     query time) — the unit test's call-count assertions are the real proof the cache works, not
     this load test.
  4. **Seeding reliability root-cause** — the reported "hangs 5/5 times against Neon" could NOT be
     reproduced under current conditions, despite two real, live-monitored (`pg_stat_activity`
     polled every 2s throughout) attempts against the actual production DB with a full
     backup-and-restore-verified safety net in place first. `packages/db/src/client.ts`'s
     `getPool()` now sets TCP `keepAlive` anyway as cheap, zero-downside defensive hardening — but
     this is explicitly NOT a confirmed root-cause fix; the comment above it says so honestly. See
     `docs/audit docs/minimap.md`'s updated entry for the full evidence trail.
  5. **`seed-prod.ts` proof** — actually run successfully end-to-end against the real hosted Neon
     DB (the same run that investigated item 4), exact parity confirmed: `tenants=2 claims=1196
     denials=520 appeals=416 rules=30 users=10`.
  **Also found and fixed along the way (not one of the 5 named stories, but necessary to unblock
  4/5):** `TAWEED_APP_PASSWORD` in Vercel read back as an empty string via `vercel env pull`/CLI —
  a genuine CLI limitation on "Sensitive"-flagged vars, not an actual outage (the live app was
  working fine on whatever the real value was). Rotated to a new known value (`ALTER ROLE` +
  Vercel env update + redeploy), saved to the gitignored Secrets vault. Also caught and fixed a
  moderate CVE (`uuid` buffer-bounds-check, GHSA-w5hq-g745-h8pq) introduced transitively by the new
  `autocannon` devDependency, via a `pnpm-workspace.yaml` override to `hyperid@^4.0.0` (which
  dropped the vulnerable `uuid` dep entirely) rather than leaving it unaddressed under the
  CI-gate's high/critical-only threshold. Full gates green throughout (typecheck ×2, lint, unit
  1124/1124, integration 43/43, real `apps/web` build), Phase 4 validation (3 parallel reviewers —
  architecture/correctness, security, code quality) run against the full diff before merge. New
  onboarding doc `summary.md` written at repo root for a new engineering partner joining the
  project — read that first if this is your first time here, then this file.
