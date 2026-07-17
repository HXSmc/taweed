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
> **2026-07-17: FHIR R4 validator full audit — DONE.** `packages/fhir`'s base-R4
> validator gained full nested-element SHALL checks (was 7-8 top-level fields only); a real
> `ClaimResponse.outcome` semantics bug (denial-amount-keyed instead of processing-status-keyed)
> found and fixed beyond cardinality gaps. NPHIES-profile stub confirmed correctly untouched
> (boundary research: public conformance page is license-gated-too, no exception). See the new
> bullet in "Where the project stands" and `docs/NEXT_STEP_PROMPT.md` for the follow-up item.

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
  insertions / 27 deletions. **Not committed** — awaiting the user's go-ahead.
- Roadmap: CREATE ✅ → IMPLEMENT ✅ → **EXECUTE (buildable pass ✅ · UI tail A2/A3 ✅ · B6 field-mapping panel ✅ · headline pending real data)** → **AI phase (AI-0 ✅ · AI-1 ✅ · AI-2 ✅ · AI-3 ✅ · AI-4 ✅ + real-data-gaps closed ✅ · AI-5 deferred)** → DEPLOY.

## Can you start now?

**The buildable half of EXECUTE is fully DONE on synthetic data** (E2E/a11y/Lighthouse in CI, first-run corridor, free-audit + owner report, landing, the B6 field-mapping panel, real-data scaffolding B5–B8, typed DEPLOY swaps). **The headline** (recovered-SAR on a real clinic) is human-gated — see `docs/blocker.md` (needs B1 design-partner data + B2 real codes + B9 SME sign-off).

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
- `apps/web` **EXECUTE additions:** marketing landing at `/[locale]` for logged-out visitors (`components/marketing/landing.tsx`, A4); `playwright.config.ts` + `tests/e2e/*` (smoke/a11y/money-arc, A1); `lib/data.ts` uses `projectClaimFacts` + `selectRulesForClaim`; `lib/actions/recovery.ts` uses `resolveRecovery`; `lib/utils.ts` `cn()` teaches tailwind-merge the custom fontSize scale (app-wide hero-size fix). **AI-1 additions:** `lib/actions/explain-flag.ts` (server action → `@taweed/ai` `explainFlag`, re-derives prompt from `SCRUBBER_RULES`, RBAC-gated, catches `AiDisabledError` → deterministic); `components/modules/flag-explainer.tsx` (additive bilingual popover); `lib/data.ts` `ScrubRow` carries `ruleVersions`; `@taweed/ai` added to deps + `transpilePackages`; EN/AR scrubber i18n keys. **AI-2/AI-3 additions:** `components/modules/appeals-composer.tsx` (AI-2 "Suggest" panel), `components/modules/rule-authoring.tsx` + the authored-rule library (AI-3 Draft/Gate/Approve flow), Settings "Author" tab. **AI-4 additions:** `lib/actions/{eob-extract,eob-review}.ts` (upload entrypoint + approve/reject, approve re-validates arithmetic on edited values), `lib/eob-review-data.ts` + `lib/eob-to-normalized.ts`, `components/modules/eob-review-queue.tsx` + `components/modules/eob-review/{confidence-badge,eob-extraction-form}.tsx`, a second "Review queue" tab on the Ingest page; `next.config.mjs` gained `serverExternalPackages` + explicit webpack `externals` for `pdf-parse`/`pdfjs-dist`/`@napi-rs/canvas`'s native binary. `lib/chart-colors.ts` (new, 2026-07-08 design-audit fix — shared SVG-safe hex for Pareto/TrendLine, was duplicated in two files). **EXECUTE UI tail (A2/A3) additions, 2026-07-10:** `app/[locale]/(onboarding)/{layout,onboarding/page}.tsx` (chromeless first-run corridor route), `components/modules/onboarding-corridor.tsx`, `lib/onboarding.ts` (`isOnboarded`), `lib/actions/onboarding.ts` (`completeOnboarding`); `app/[locale]/(app)/analytics/audit-report/page.tsx` + `app/[locale]/(app)/recovery/owner-report/page.tsx`, `components/modules/{report-shell,audit-report-document,owner-report-document}.tsx`, `lib/report-data.ts` (`recoverableSplit`/`projectedRecoveryRange`/`aggregateTopPayers`), `lib/data.ts` gained `getAuditReportData`/`getOwnerReportData` + a shared `appealPipelineRows` helper (extracted from `getRecovery`); `components/modules/ingest-panel.tsx` gained an additive optional `onIngestSuccess` prop; `app/[locale]/(app)/layout.tsx` gained `print:hidden`/`print:` wrappers for the two new report pages. **AI-4 real-data-gaps additions, 2026-07-10:** `eob-review.ts`'s `EditedLine`/`EditedClaim` gained `adjustmentSar`/`totalAdjustmentSar`; `eob-extraction-form.tsx` gained the matching 5th `MoneyField` per line/claim (sign-aware `halalasToSarDisplay`, see the money-path callout above); `eob-review-data.ts` gained `backfillLegacyAdjustmentFields` (pre-Gap-2 `eob_extractions` rows backfill to `adjustmentHalalas: 0` on read); `apps/web/lib/money.ts`'s `SAR_MONEY_REGEX` gained a 12-digit integer-part bound (money-path fix).

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

  ```bash
  git branch -f back-up main        # snapshot the current main tip (the 'old' commit)
  git push -f origin back-up         # mirror the backup to origin
  # ...now commit/merge the new work onto main...
  git push origin main               # main advances; back-up stays one commit behind
  # restore if a push goes bad:
  git reset --hard back-up           # (or inspect first: git checkout back-up)
  ```

- **Isolated feature work** (e.g. EXECUTE): create a fresh worktree + branch (`superpowers:using-git-worktrees`), build, merge to `main`, then delete the worktree + branch. NOTE: gitignored local docs (`docs/NEXT_STEP_PROMPT.md`, `docs/blocker.md`, `design/`, …) do **not** sync between a worktree and `main` — edit them directly in whichever dir you read from.
