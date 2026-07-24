# Audit runbook — Taweed

> Living reference for repeat audit passes (bugs, security, authz, deps, a11y, mapping, ponytail,
> UI-slop, prod-readiness). Read this first before launching a new audit workflow — it exists to
> make the next pass faster, not to re-derive repo layout/tooling from scratch every time. Update
> it (§Learnings) after each pass.
>
> **Location note (2026-07-18): all audit bookkeeping files now live in `docs/audit docs/`**
> (`audit.md` — this file, `bugs.md`, `secure.md`, `minimap.md`, and any future
> `ponytail-debt.md`/`ui-slop.md`/`prod-readiness.md`), consolidated per explicit user instruction
> from previously scattered locations (`docs/audit.md`, `docs/bugs.md`, `docs/secure.md`,
> `docs/minimap.md`, plus a separately-gitignored root `/bugs.md`/`/secure.md` pair from a
> 2026-07-10/14 incremental pass — see pass #7/#8/#13 below and the "convention conflict" note,
> now resolved by this consolidation). **`docs/audit docs/` is gitignored as a directory
> (`.gitignore`), but `audit.md`/`bugs.md`/`secure.md` are force-added (`git add -f`) so they stay
> tracked in git** — same pattern this repo already uses for `docs/blocker.md`. `minimap.md` stays
> genuinely untracked (always was, per its own convention below — a snapshot, not a findings
> ledger).

## Audit history at a glance

| # | Pass | Date | Output | Confirmed / found | Verification |
|---|---|---|---|---|---|
| 1 | Bug hunt | 2026-07-08 | `bugs.md` | 21 confirmed, 1 refuted (of 22) | unit 483/483, int 37/37, build green |
| 2 | Security (injection/authn/secrets/access) | 2026-07-08 | `secure.md` | 10 confirmed + 1 confirmed-clean | unit 533/533, int 42/42, build green |
| 3 | API/server-action auth-check audit | 2026-07-08 | (fixed inline, no dedicated doc) | 15 missing-auth-check findings, all fixed | typecheck/lint/tests green |
| 4 | Dependency audit (CVEs, abandonment, license) | 2026-07-08 | `docs/deps.md` | 10 advisories → 0; several floor-hygiene + watch-items | unit/int green, build green |
| 5 | WCAG AA accessibility audit | 2026-07-09/10 | `docs/a11y.md` | 25 confirmed and fixed | unit 668/668, int 42/42, build green |
| 6 | Codebase minimap (subsystems/connections/weaknesses) | 2026-07-10 (~02:18) | `minimap.md` (gitignored, local-only) | 14 of 30 candidates confirmed+fixed, 16 deferred | unit 708/708, int 42/42, build green |
| 7 | Incremental re-run: bug hunt | 2026-07-10 (~20:00) | `bugs.md` (root, gitignored at the time) | 10 confirmed, 1 refuted (of 11) | unit 919/919, root+web typecheck green |
| 8 | Incremental re-run: security | 2026-07-10 (~21:56) | `secure.md` (root, gitignored at the time) | 3 confirmed, 2 refuted (of 5) | unit 928/928, prod build green |
| 9 | Incremental re-run: API/server-action auth-check | 2026-07-10 (~22:33) | (no dedicated file — 0 findings) | 0 findings across all 22 entrypoints (prior sweep's 15 fixes hold, no regressions) | — |
| 10 | Incremental re-run: dependency audit | 2026-07-10 (~22:33) | (no dedicated file) | 0 CVEs (807 deps); 15 safe patch/minor bumps applied; 14 majors + next-auth governance risk flagged | unit 933/933, typecheck green |
| 11 | Incremental re-run: WCAG AA | 2026-07-10 (~23:00) | `docs/a11y.md` (updated in place, findings #23-24) | 2 confirmed+fixed; both prior "Considered" loose ends closed clean via live re-check | unit 933/933, typecheck green |
| 12 | Incremental re-run: codebase minimap | 2026-07-10/11 (~23:30) | `minimap.md` (overwritten — superseded pass #6's stale snapshot) | 24 weaknesses found (9 fixed safe-tier; 15 flagged for planning) | unit 977+/977+, typecheck green |
| 13 | Incremental re-run: diff-scoped bugs + security (CSP/CI/Docker) | 2026-07-14 | `bugs.md` + `secure.md` (root, gitignored at the time) | **0 confirmed, 0 refuted** — clean pass; Dockerfile-runs-as-root noted FYI | unit 982/982, typecheck green, lint clean (CI) |
| 14 | **Full `/audit-workflow` queue via GLM hub-spoke orchestrator, item 1 (bugs)** | 2026-07-18 | `bugs.md` | 4 confirmed + 1 carried-over (5 total), all fixed | item 1 DONE: tsc clean, unit+int 1092/1092, lint baseline, build green. |
| 15 | **Same queue, item 2 (security)** — 4 parallel GLM finders by area (injection/authn/secrets/access-control), diff-scoped since pass #13 + full sweep | 2026-07-18 | `secure.md` | **0 confirmed, 28 considered-and-refuted** — clean pass; branch-scoping IDOR verified safe; one human-sign-off item flagged (`listDemoAccounts` guard reversal, sound tradeoff) | read-only, no fix phase needed; GLM 5h at 6% after (Pro-tier quota, upgraded from Lite this same day) |
| 16 | **Same queue, item 3 (API/server-action auth-check)** — 1 GLM finder, exhaustive per-export enumeration | 2026-07-18 | (no dedicated file, matches pass #3/#9 convention) | **0 confirmed across 22 entrypoints** (2 routes + 17 gated actions + 3 deliberate no-check) — 3rd consecutive clean result for this exact re-audit (after #3's original 15 fixes, #9's 0-finding re-check) | read-only, no fix phase needed |
| 17 | **Same queue, item 4 (dependency CVEs)** — agy 3-agent research + hub independent NVD/GHSA verification | 2026-07-18 | `deps.md` (moved from `docs/deps.md` into `docs/audit docs/`) | **0 confirmed current vulnerabilities** (matches `pnpm audit`'s clean 812-dep read); agy's 4 "active CVE" + 1 abandoned-package claims all independently verified WRONG (real CVEs, misapplied versions, or a nonexistent dependency) — 2 genuine future-upgrade landmines captured (vitest→v4 needs ≥4.1.6, react→v19 needs ≥19.2.1, a CISA-KEV pre-auth RCE below that) | hub verified every claim directly against NVD/GHSA before writing anything; no fix needed |
| 18 | **Same queue, item 5 (WCAG AA)** — 1 GLM code-level finder + hub live chrome-devtools verification, 1 GLM fixer | 2026-07-18 | `a11y.md` (moved from `docs/a11y.md` into `docs/audit docs/`) | **3 confirmed findings**, all in the new branch-scoping `tenant-switcher.tsx` (accessible-name loss below `sm`, `menuitem`+`aria-current` instead of `menuitemradio`+`aria-checked`, dark-theme contrast fail same root cause as finding #5) — all 3 fixed + hub-live-reverified via chrome-devtools (real a11y tree + computed-style contrast) | typecheck clean, unit 1053/1053, build green; int suite not re-run (UI-only fix, destructive DB wipe disproportionate) |
| 19 | **Same queue, item 6 (codebase minimap)** — 1 GLM targeted re-map spoke + 1 GLM fix spoke (W-1 only, W-2 deferred) | 2026-07-18 | `minimap.md` (moved from `docs/minimap.md` into `docs/audit docs/`, stays untracked/local) | New Docker subsystem added (0 CI validation + 2 destructive-default env flags flagged); branch-scoping/`validate-r4.ts` descriptions patched; backlog cross-checked (0 resolved, 2 sharpened, 1 got a complementary guard); **1 safe-tier fix landed** (duplicated branch-scope block → `resolveBranchScope` helper); **1 candidate (Dockerfile COPY list) deliberately deferred** — unverifiable on this host (`docker build` hangs), correctly caught before being marked fixed | typecheck clean, unit 1053/1053, build green |
| 20 | **Same queue, item 7 (ponytail over-engineering)** — hub-run `/ponytail-audit` (native plugin, per skill instruction — not spoke-delegated) + 1 GLM fix spoke | 2026-07-18 | `ponytail-debt.md` (new, gitignored) | 2 raw candidates; **1 REJECTED** (2 EOB-extraction fallback-ladder adapter stubs — hub caught these as the same deliberate external-blocker-gated pattern as `packages/platform`, explicitly excluded from scope, an Explore agent had wrongly flagged them); **1 confirmed + fixed** (dead `capabilities` field on `LlmProvider`, never read at runtime) | typecheck clean, unit 1051/1051 (2 fewer — dead tests correctly removed), build green |
| 21 | **Same queue, item 8 (UI anti-slop)** — 1 GLM finder + hub independent grep spot-check | 2026-07-18 | `ui-slop.md` (new, gitignored) | **0 confirmed findings out of 8 AI-SaaS-template tells**, checked against the marketing landing page, login page, and 3 spot-checked dashboard pages — genuinely clean, design already actively follows the repo's own `design-quality.md` rules | read-only, no fix phase needed |
| 22 | User-reported live production Docker repro (3 symptoms: Recovery no-auto-refresh, laggy branch switch, appeal draft not appearing) | 2026-07-19 | `bugs.md` | 1 confirmed+fixed (concurrent-queries-on-shared-client race, finding #22); finding #23's fix did not hold — see pass #23 | unit 1049/1049 (mid-pass), typecheck green — finding #23 superseded before final verification completed |
| 23 | Continued investigation — corrects pass #22 finding #23 (client-side RSC-apply gap, real root cause) | 2026-07-19 | `bugs.md` | 1 confirmed+fixed across 4 call sites (finding #24: Recovery, branch switcher, EOB review, rule authoring all forced to hard navigation); bug (3) confirmed resolved by pass #22's fix, no separate bug | unit 1049/1049, typecheck green, verified live via chrome-devtools against rebuilt local production server |
| 24 | **Item 0 (NEW), idea pressure-test** — hub-run, Paul Graham YC-evaluator frame, per explicit user request | 2026-07-21 | `idea-pressure-test.md` (new, gitignored) | **Verdict: WEAK, not pivot-required** — core value prop (do clinics actually feel/pay for this) still empirically unproven (`HUMAN_CONFIRMATION_NEEDED.md` A1/A2), and the fastest path to proving it (a real free-audit design partner) is itself blocked on CR formation, not yet started. Investment order inverted (built before validated), not a bad idea. Mitigation is a business action already identified in the docs (land CR + first design partner), not a code fix — loop paused pending either landing. | n/a — judgment task, no code gate |
| 25 | **Full `/audit-workflow` re-run, items 1-8, incremental/diff-scoped since a796b65** — 4 parallel GLM find-only spokes (bugs+security+auth+deps combined, WCAG, minimap+UI-slop, ponytail — ponytail routed to GLM this run per explicit user correction, no longer hub-run) + 1 GLM fix spoke + hub-run agy dependency research | 2026-07-21 | `bugs.md`, `secure.md`, `a11y.md`, `deps.md`, `minimap.md`, `ponytail-debt.md`, `ui-slop.md` | **1 confirmed+fixed** (finding #25: missing `catch` in new `recovery-outcome-actions.tsx`, RPC-rejection surfaced no operator error — parity fix matching sibling components). Items 2/3/6/7/8 came back 0 new findings (clean, diff-scoped). Item 4: `pnpm audit` clean, brace-expansion CVE confirmed resolved, real May-2026 Next.js advisories confirmed inapplicable (installed 15.5.20 above every patched ceiling) — **1 agy fabrication caught and refuted** (a claimed "new 2026-07-21 disclosure" that doesn't exist in the real GitHub advisories API, same failure pattern as pass #17). Item 9 (production readiness): still gated, `BLK-7`/`BLK-8` both open, re-confirmed not public-facing. | tsc clean, unit **1050/1050**, lint matches known `.claude/**` baseline exactly (0 tracked files confirmed), build green (all locale routes prerendered); int suite not re-run (UI-only fix, same proportionality call as pass #18) |
| 26 | **Full `/audit-workflow` re-run, incremental/diff-scoped since 96e14fa (first real Vercel deploy landed this pass)** — 1 GLM combined find spoke (bugs+security+auth+ponytail+UI-slop over the scoped diff only), item 4 reused Phase-4-verified CVE checks (no new agy dispatch — same-session evidence), item 9 gate re-evaluated fresh against `docs/blocker.md` | 2026-07-24 | `minimap.md` (new subsystem #10), gate note below | **0 new confirmed findings.** Scope: this session's uncommitted deploy-fix diff (already independently reviewed 3× — architecture/correctness, security, code-quality — as this task's own Phase 4; 1 real bug found there and fixed: `seed-prod.ts` was using a test helper's hardcoded weak DB password instead of an env-overridable one) + the `aae37c7` eval-suite-extension commit (13 new files under `packages/ai/evals/`, read in full, 3 candidates considered and refuted with file:line evidence) + confirmed the `f8b39e2` Next 15.5.21 bump is genuinely installed, nothing downgrades it. Item 4: **incomplete at the time this pass was first marked done** — only checked the 2 newly-added deps (`@napi-rs/canvas@0.1.80`, patched past the only known low-severity issue ≤0.1.65; `pdf-parse@2.4.5`, no known CVEs), reusing Phase 4's already-verified evidence rather than re-running a full-tree `pnpm audit`. That gap let a real, pre-existing issue through: CI's own `pnpm audit --audit-level=high` gate (not this audit pass) caught 3 unpatched advisories on `next-auth@5.0.0-beta.31`/`@auth/core` (2 critical, 1 high) minutes later on the actual push. Fixed same session (bump to `5.0.0-beta.32`, the current real patched release), full-tree `pnpm audit` now clean, verified via a real live sign-in against production post-fix. **Lesson recorded below: a scoped item-4 check on "the deps I just touched" is not the same claim as "the dependency tree has no high/critical CVEs" — always run a full-tree `pnpm audit` before declaring item 4 done, per pass #17's own "ground it in a real tool run first" rule, which this pass should have followed and didn't until CI forced it.** Item 9: re-confirmed still gated — Vercel/Neon hosting is now genuinely live and public (`taweed.vercel.app`), satisfying the gate's "real domain/hosting live" half for the first time, but `BLK-7` (KSA-resident OIDC) stays 🔴 open by explicit task scope (dev-auth intentional for this synthetic-data deploy) — the gate's AND condition still isn't met, item 9 correctly stays skipped, not stale. | tsc clean; `eslint scripts/seed*.ts packages/ai/evals/` clean; unit `eval-*` suite 69/69 passed; full monorepo QA gates (this task's own Phase 3, run just before this audit pass) — typecheck/lint/unit 1111/1111/int 43/43/build all green |

**Passes #7-#13 (2026-07-10 → 2026-07-14) previously lived at repo root, gitignored, per a
convention conflict now resolved (see the location note at the top of this file) — folded into
this file's history for continuity, content not otherwise altered.**

**Pass #14 (2026-07-18) is the first pass run through the dedicated `/audit-workflow` GLM
hub-spoke skill** (4 parallel find-only spokes by area instead of a broader finder fleet;
find→verify→fix→test with the hub reviewing every diff and running gates itself, GLM doing the
volume). Findings: TOCTOU race in `markAppealOutcome` (a NEW instance of the same risk class
pass #1's finding #15 already partially addressed — that pass added the sibling-sum ceiling guard
but explicitly left "no DB integration test covers this call site" as a tracked follow-up; this
pass closes that follow-up with a real lock); a silent zero-fold in `packages/normalizer`'s
`normalize.ts` (same defect class as pass #1's #3/#11, in a different file/path, untracked until
now); a clinician-facing dead-end CTA (RBAC/UX, new); a duplicate-CSV-header Select collision
(new, low severity). Also confirmed via independent verification that the `InMemoryObjectStore`
production-guard follow-up flagged in pass #1's finding #16 ("noted, not fixed") was STILL open as
of this pass — nobody in passes #2-#13 touched `packages/platform`. Being closed as part of this
pass too (mirrors the already-fixed `DevPassthroughKms` pattern exactly).

## Queue completion summary — 2026-07-18 full `/audit-workflow` run (item 10)

Started paused mid-item-1 on a GLM 5h-quota exhaustion (Lite tier); resumed same day after the
user confirmed both a quota reset AND an account upgrade to GLM Pro, with an explicit instruction
to route all volume strictly to GLM spokes going forward. Items 1-8 completed in order; item 9
skipped per the standing public-facing gate below; this section is item 10.

| Item | Outcome | Findings (confirmed/considered) | Fixed | Gates |
|---|---|---|---|---|
| 1. Bugs | ✅ done | 4 confirmed + 1 carried-over = 5 | 5/5 | unit+int 1092/1092, build green |
| 2. Security | ✅ done, clean | 0 confirmed / 28 considered | n/a | read-only |
| 3. API auth | ✅ done, clean | 0 confirmed / 22 entrypoints checked | n/a | read-only |
| 4. Dependency CVEs | ✅ done, clean | 0 confirmed / 5 agy claims caught wrong | n/a | read-only |
| 5. WCAG AA | ✅ done | 3 confirmed | 3/3 | typecheck, unit 1053/1053, build green |
| 6. Minimap | ✅ done | 5 new weaknesses (2 fix-now, 3 planning) | 1/2 (1 deferred, unverifiable) | typecheck, unit 1053/1053, build green |
| 7. Ponytail | ✅ done | 2 candidates (1 rejected, 1 confirmed) | 1/1 | typecheck, unit 1051/1051, build green |
| 8. UI anti-slop | ✅ done, clean | 0 confirmed / 8 tells checked | n/a | read-only |
| 9. Production readiness | ⏭️ SKIPPED | not public-facing yet — see gate below | — | — |

**Post-hoc catch:** item 7's fix introduced a real CI-breaking lint error (unused import) that
local verification missed (the known `.claude/**` noise masked it) — caught via a CI-failure email
from the user, fixed same session (`1ef7b72`), re-verified in isolation, and recorded as a
Learnings entry above so the underlying gap (skipping `pnpm lint` after a "small" fix) doesn't
recur.

**Total real findings this run: 4 (item 1) + 3 (item 5) + 1 (item 6, W-1) + 1 (item 7) = 9 fixed**,
plus 1 item-6 candidate correctly deferred as unverifiable rather than shipped blind, plus 2
item-7 candidates correctly rejected/scoped (1 as a deliberate stub, plus the dead-field one that
WAS confirmed). Items 2/3/4/8 came back genuinely clean — expected for a codebase already through
20 prior audit passes, not a sign of a shallow run (each pass's own reasoning/evidence is recorded
above, not just a bare "0 findings").

**GLM spend:** all volume routed to GLM (Pro tier after the mid-run upgrade) per explicit user
instruction — zero hub-side (Sonnet/Claude) implementation this run past the pause point; hub did
only planning, spec-writing, live chrome-devtools verification (item 5), independent NVD/GHSA
fact-checking (item 4), and gate-running/review. GLM 5h usage stayed low throughout (6% after the
first wave, well under any warning threshold) thanks to the Pro-tier headroom.

**Next full re-run:** target the same incremental-diff-scoping approach passes #13/#15/#19 used —
re-map/re-audit only what changed since this run's tip (`a796b65` / whatever commit lands item 10's
final push), not a full re-sweep, unless a major feature lands that touches broad surface area.

## Public-facing gate (added 2026-07-18, applies to item 9 — production readiness)

**Decision: NOT public-facing yet — item 9 has NEVER been run, skipped this run per the user's
explicit confirmation.** Reason: no live deployed URL (infra/Terraform not applied — `BLK-8` OCI
Riyadh creds still open), KSA-resident OIDC still blocked (`BLK-7`, dev-only Auth.js credentials
today), pre-revenue/founder-led per `docs/handoff.md`. **Action required: run item 9 once the app
is actually deployed** (real domain/hosting live, real auth provider swapped in) — don't skip it
again once that's true, and don't assume this note is stale without re-checking deployment status
first.

**Re-confirmed 2026-07-21 (item 25 below): still NOT public-facing.** `docs/blocker.md` checked
fresh — `BLK-7` (KSA-resident OIDC) and `BLK-8` (Oracle Riyadh creds) both still 🔴 open, no
deployment landed. Gate decision unchanged; item 9 stays skipped.

**Re-confirmed 2026-07-24 (item 26 above) — status CHANGED, still skipped, but for a narrower
reason now.** The app is now genuinely deployed and publicly reachable at `taweed.vercel.app`
(Vercel + Neon Postgres, real hosting, real RLS-scoped multi-tenant DB) — this satisfies the
gate's "real domain/hosting live" half for the first time. But the gate is an AND, not an OR:
`BLK-7` (KSA-resident OIDC) is still 🔴 open, and this deploy's own task scope EXPLICITLY keeps
auth on the existing `TAWEED_ENABLE_DEV_AUTH` passwordless demo-login path by design (not an
oversight — see this task's own Phase 0 spec) — no real auth provider was swapped in. So item 9
still stays skipped, but future re-runs should know the hosting half is now real: **the trigger to
finally un-skip item 9 is BLK-7 closing (a real OIDC provider landing), not another hosting
change** — Vercel/Neon is not going away, and re-deploying to it again doesn't move this gate
further. Note also: this Vercel/Neon deployment is a separate track from `BLK-8` (Oracle Cloud
Riyadh, `infra/`'s Terraform skeleton) — closing BLK-8 doesn't affect this gate either, since this
demo deploy was never going to use that infra. Only BLK-7 matters for item 9 going forward.

## Queue completion summary — 2026-07-21 incremental `/audit-workflow` run (item 25, item 10 equiv.)

Triggered by explicit user request: add an item-0 idea pressure-test (new), loop-until-clean on
every item, ponytail routed to GLM instead of hub-run (mid-run correction). Ran fully incremental/
diff-scoped since the 2026-07-18 close-out (`a796b65`) — the real diff was small (recovery/
branch-switcher bug fix already self-documented in `bugs.md` #22-24, plus a dependency pin and
routine CI bumps), matching the "next full re-run" note above.

| Item | Outcome | Findings | Fixed | Gates |
|---|---|---|---|---|
| 0. Idea pressure-test (NEW) | ✅ done | Verdict: WEAK (not pivot) — see `idea-pressure-test.md` | n/a — business action, not code | n/a |
| 1. Bugs | ✅ done | 1 confirmed new (finding #25) | 1/1 | — |
| 2. Security | ✅ done, clean | 0 new | n/a | read-only |
| 3. API auth | ✅ done, clean | 0 new | n/a | read-only |
| 4. Dependency CVEs | ✅ done, clean | 0 confirmed new / 1 agy fabrication caught+refuted | n/a | read-only |
| 5. WCAG AA | ✅ done, clean | 0 new | n/a | read-only |
| 6. Minimap | ✅ done | 1 new backlog item (W-6, hard-nav tradeoff) | n/a (tracking only) | — |
| 7. Ponytail | ✅ done, clean (routed to GLM this run) | 0 new | n/a | read-only |
| 8. UI anti-slop | ✅ done, clean | 0 new | n/a | read-only |
| 9. Production readiness | ⏭️ SKIPPED (re-confirmed) | not public-facing yet | — | — |

**Final gates (hub-run, fresh, everything together):** `pnpm tsc -p tsconfig.json --noEmit` clean;
`pnpm vitest run --project unit` — **1050/1050, 0 fail** (under `nvm use 22` — this hub's default
node v20.2.0 cannot collect jsdom@29-based tests at all, `ERR_REQUIRE_ESM`; installing/switching to
node 22 was required to actually run gates rather than trust the spoke's report — see Learnings);
`pnpm lint` — matches the known `.claude/**` baseline exactly (`git ls-files .claude` = 0,
confirmed fresh); `pnpm --filter @taweed/web build` — succeeds, all locale routes prerendered.
Integration suite not re-run (finding #25's fix is UI-only, same proportionality call pass #18
established).

**Corrections made mid-run:** (1) ponytail was originally launched via an Explore subagent per the
skill's then-current wording; the user corrected this live ("ponytail scan should be using GLM
spoke") — the running Explore agent was stopped (`TaskStop`) before it produced a result, the
skill file (`~/.claude/commands/audit-workflow.md` item 7) was edited to remove the
"not spoke-delegated" carve-out, and the scan was re-run as a GLM spoke instead, same run. (2) the
skill's item 0 (idea pressure-test) and the global loop-until-clean rule were both new additions
this run, added per explicit user request before the queue started.

**GLM spend:** all volume routed to GLM per the skill's standing rule (bugs/security/auth/deps
combined spoke, WCAG spoke, minimap+UI-slop spoke, ponytail spoke, one fix spoke) — hub did only
planning, spec-writing, the item-0 judgment task, independent dependency-advisory fact-checking
(item 4, including catching agy's fabrication), and gate-running/review.

## Repo shape (so a finder agent doesn't have to rediscover it)

- **Monorepo:** pnpm workspaces. `packages/{shared,fhir,normalizer,db,audit,rules-engine,appeals,
  analytics,ingest,ai,platform}` (pure logic, no UI) + `apps/web` (Next.js 15 App Router) +
  `test/{synthetic-fhir,synthetic-eob}` (fixture generators).
- **No `src/routes/`** — this is Next.js, not Express. The real "API surface" is:
  - `apps/web/app/**/route.ts` — actual HTTP route handlers (there are only 2: `api/sample-bundle`,
    `api/auth/[...nextauth]`).
  - `apps/web/lib/actions/*.ts` — Next.js Server Actions (`"use server"`), the primary mutation
    surface (appeals, assist-appeal, auth, author-rule, eob-extract, eob-review, explain-flag,
    ingest, recovery). Auth/RBAC is expected to be re-checked **inside every one of these**, not
    just gated in the UI (see `apps/web/lib/authz.ts`, `apps/web/lib/rbac.ts`).
  - Pages live at `apps/web/app/[locale]/(app)/{overview,analytics,scrubber,ingest,appeals,
    recovery,settings}/page.tsx` + `(auth)/login/page.tsx` + the root `[locale]/page.tsx` (landing).
- **The only package allowed to talk to an LLM:** `@taweed/ai`. Never audit for "missing LLM
  guardrails" outside this package — that's by design (see `docs/review.md` §2.6).
- **Tenant isolation:** Postgres RLS (`FORCE ROW LEVEL SECURITY` + non-superuser `taweed_app` role)
  is the real security boundary, not `WHERE tenant_id = ?` in app code. `tenant_id` is always
  auth-derived via `withSession`/`withTenant` (`apps/web/lib/db.ts`), never client-supplied.
- **Money is halalas-as-integers internally, SAR-as-strings on the wire** (`@taweed/analytics`
  `moneyToHalalas`/`toSar`, `HALALAS_PER_SAR=100`). Any "bug" touching money math needs a
  reconciliation test (`at_risk + recovered = total denied`), not just a unit assertion.
- **Data-origin gate:** `claims.data_origin` (`synthetic`|`production`) is the hard PHI gate — a
  `synthetic` tag routes to the demo hash projection; anything else uses real columns and a missing
  real signal is `unevaluable`, never fabricated. Don't flag this pattern as a bug; it's intentional.
- **AI-4 is intentionally NOT PHI-free** — see `docs/review.md` §2.6 item 2 before flagging it as an
  inconsistency with AI-1/2/3's PHI-free posture.
- **Branch-scoping (design-brief §7, 2026-07-18):** Analytics, Scrubber, Appeals, Recovery all have
  real `?branch=<id>` filtering via `resolveBranchId` (RLS-validated); only Ingest doesn't (no
  `branch_id` column on `eob_extractions`, a schema decision, not a bug — don't re-flag).
  `appeals/page.tsx`/`scrubber/page.tsx` correctly have NO `isVisible()` RBAC gate — `rbac.ts`'s
  `MATRIX` never marks either module `"hidden"` for any role. Don't re-flag either without new
  evidence (verified independently twice now, by two different passes).

## Tooling gotchas (burn once, not every audit)

- **RTK hook wraps common shell tools and can break silently.** `rg`/`find` invoked via the Bash
  tool go through an RTK proxy that (a) sometimes fails outright ("search failed: Failed to execute
  command") and (b) rejects compound `find` predicates (`-not`, `-exec` → "rtk find does not
  support compound predicates or actions"). Workarounds: use plain `find . -iname ... | grep -v
  node_modules` instead of `-not -path`; if `rg`/`find` errors opaquely, retry via `command rg`/
  `command find` or fall back to `grep -r`. Don't burn a whole turn assuming zero-match is real —
  confirm the tool actually ran.
- **Test/typecheck stdout gets compressed by the RTK hook.** Write to a file and read it:
  `vitest run --reporter=json --outputFile <path>` (JSON, not summarized), or `tsc ... 2>file`.
- **Env vars don't reliably reach RTK's re-exec'd child** — prefix with `env VAR=val <cmd>`.
- **pnpm lives at `~/.local/bin/pnpm`**, not on PATH.
- **Node is v20.2.0** — below Next 16's floor (intentionally pinned to Next 15), which blocks this
  repo's own local `node_modules/playwright` binary. **This does NOT block `mcp__chrome-devtools__*`
  tools** — they're a separate, externally-driven browser connection and work fine (confirmed
  repeatedly, including 2026-07-18's branch-scoping live verification). Use chrome-devtools MCP for
  any a11y/visual audit that needs a live browser; reserve "code-level pass only, say so
  explicitly" for when chrome-devtools MCP itself is unavailable, not for this Node-version reason.
- **`.next` cache corruption from hot-reload churn recurs** — if chrome-devtools hits a fresh 500
  or "Build Error" on a dev server inherited from a prior session, `kill` it, `rm -rf
  apps/web/.next`, restart, don't debug the code.
- **glm-code spokes do NOT have chrome-devtools MCP (or any Claude-Code-specific MCP) access** —
  that's a hub-only capability. Never put a live-browser-verification acceptance criterion in a
  glm-code spec; the hub does that step itself after the spoke's code fix lands.
- **Docker `docker info`/`ps`/`exec` can hang on this host**; the Postgres container and port work
  fine regardless — probe with `nc -z localhost 5432` instead of trusting `docker compose ps`.
- **Integration tests are destructive** (`pnpm test:int` wipes + re-migrates the shared local DB) —
  re-seed after (`pnpm --filter @taweed/web seed`) before manually clicking through the app again.

## Conventions for audit output files

- `audit.md`, `bugs.md`, `secure.md` (all under `docs/audit docs/`, 2026-07-18) — tracked in git
  via `git add -f` (the directory itself is gitignored) — same pattern as `docs/blocker.md`. One
  entry per **verified** finding only (CONFIRMED, not just plausible) — severity, file:line,
  repro/failure scenario, fix applied, and the test that now guards it.
- `minimap.md` (same directory) stays **genuinely untracked** (a snapshot, not a findings ledger —
  goes stale fast, the fix commits are the durable record).
- This file (`audit.md`) is the one meta-doc that persists across passes — update its §Learnings
  section after every audit run, not just at the very end of a queued batch.

## Learnings (append after each pass — newest on top)

### Pass #26 addendum — item 4 scoped-to-the-diff was not enough, CI caught what it missed (2026-07-24)

- **"Reuse Phase 4's CVE evidence for the deps I just touched" quietly narrowed item 4's actual
  claim from "no CVEs in the dependency tree" to "no CVEs in the 2 packages I added this session"
  — and nobody restated the narrower claim out loud until the gap actually bit.** The pass was
  marked done with 0 findings; three commits later, CI's `pnpm audit --audit-level=high` failed on
  `next-auth`/`@auth/core` — a pre-existing dependency, untouched by this session's diff, that a
  full-tree audit would have caught immediately. Pass #17 already established the right discipline
  ("ground the CVE check in a real tool run first") — this pass cited that precedent for the 2 new
  deps but never actually ran the full-tree `pnpm audit` it names as the gold standard, and the
  gap survived until an external gate (CI) forced it. **Scoping item 4 to "just the new deps" is a
  legitimate time-saver only when paired with an explicit full-tree `pnpm audit --audit-level=high`
  as a final cheap check before declaring the item done — never skip that one command just because
  the interesting/new part of the diff has already been hand-verified.**

### Pass #26 — first real Vercel deploy + incremental audit re-run (2026-07-24)

- **A live production error that persists identically after a "correct-looking" fix (verified
  against real trace-manifest evidence, twice) is a signal the diagnosis is wrong, not that the
  fix needs a third variation.** The `@napi-rs/canvas` MODULE_NOT_FOUND bug got a first fix
  (`outputFileTracingIncludes` in `next.config.mjs`) that looked verified — a real `.nft.json` grep
  showed nonzero trace entries after the change — and still failed identically live across two
  redeploys, one cache-free. The actual root cause (pnpm's per-package `node_modules` isolation
  meant `apps/web` itself had no resolvable symlink to the dependency, regardless of what OFT
  traced) was one layer beneath what the first fix addressed. **"The trace manifest changed" is
  not the same claim as "the runtime require will resolve" — a temporary diagnostic route
  (`fs.readdirSync`/`require.resolve` against the live deployed function, deleted after use) gave
  ground truth in one deploy cycle where two rounds of "looks right locally" guessing hadn't.**
  When a fix is verified-correct-on-paper but the live symptom doesn't move, stop iterating on the
  same fix mechanism and get a direct read of the actual deployed runtime state before trying
  again.
- **Running the wrong local package-manager version can silently corrupt security-relevant
  lockfile state with zero error output.** This machine's default `pnpm` (9.15.0) doesn't match
  this repo's pinned `pnpm@11.13.0` (needs Node ≥22 via corepack; default shell Node is 20.2.0).
  Running `pnpm install` under the wrong version silently stripped `pnpm-workspace.yaml`'s
  `overrides:` CVE-remediation block from `pnpm-lock.yaml` — no error, no warning, just a smaller
  lockfile. Caught only because `git diff --stat pnpm-lock.yaml` was checked before treating the
  install as done, per this file's own standing discipline (see pass #14's git-diff-before-assuming
  lesson, applied here to package-manager output instead of agent output). **Always diff a
  regenerated lockfile before trusting it, even for a routine `pnpm install` — a version mismatch
  can drop content as quietly as a bad agent run can.**
- **Right-sizing an incremental audit pass to a genuinely tiny diff is not corner-cutting when the
  diff was already reviewed by an equal-or-greater-rigor process minutes earlier.** This pass's
  scoped-diff GLM spoke came back with 0 new findings — expected and correct, not a shallow-run
  signal, because this task's own Phase 4 had already run 3 independent parallel reviewers
  (architecture/correctness, security, code-quality) over the exact same diff and found (and fixed)
  the one real issue. Re-running the full 10-item queue from scratch on a 6-file diff over a
  25-pass-audited codebase would have been pure duplication, not thoroughness.
- **A gate re-evaluation can legitimately change "why" something is skipped without changing
  "whether."** Item 9 (production readiness) was skipped in every prior pass because NEITHER half
  of its AND condition (real hosting, real auth) was true. This pass is the first time one half
  (hosting) became genuinely true — worth recording precisely, because a future pass that only
  checks "is item 9 still skipped? yes" without reading why would miss that the remaining blocker
  narrowed from two open items to exactly one (`BLK-7`), which changes what future work should
  actually watch for as the real trigger to finally run item 9.

### Real CI failure caught post-item-7, fixed same session (2026-07-18)

- **Local `pnpm lint`'s known `.claude/**` untracked-harness-file noise can mask a REAL new error in
  a committed file, in the exact same run.** Item 7's fix spoke deleted the
  `describe("createAnthropicProvider capabilities", ...)` block from `anthropic-1p.test.ts` but left
  the now-unused `createAnthropicProvider` import — a real `@typescript-eslint/no-unused-vars`
  error. The hub's own post-fix `pnpm lint` run (done after items 5 and 6, but **skipped after item
  7** — typecheck/tests/build were run instead, lint was assumed clean from the established
  baseline) would have caught this immediately; skipping it let a real CI-breaking error ship.
  Caught only because the user forwarded a CI-failure email. **Never skip `pnpm lint` after ANY
  spoke fix that touches source files, even when the "known baseline" pattern (`.claude/**` noise)
  makes local lint output look unchanged at a glance — that noise is at the TOP of the output and
  can visually crowd out a new, real, committed-file error lower down. Read the whole output, don't
  pattern-match against "it's just the usual 3 problems."**
- **Fixed immediately** (`1ef7b72`): removed the unused import, re-verified
  `eslint packages/ai/test/anthropic-1p.test.ts` clean in isolation, root typecheck clean, the
  specific test file re-run (10/10 pass). Pushed same session.
- **This is exactly the kind of gap the `/audit-workflow` skill's own "Verify fixes with real
  test/gate runs the hub executes" rule exists to catch** — and it still slipped through once,
  proving the rule needs to be followed literally (run every gate, every time) rather than
  proportionally-skipped based on a pattern-matched "this fix is small, probably fine" judgment.
  Scale verification thoroughness to risk, not to how big the diff looks.

### Pass #20 — full `/audit-workflow` run, item 7 ponytail (2026-07-18)

- **The same "deliberate external-blocker stub" exclusion rule this pass was explicitly told to
  respect (`packages/platform`'s KMS/object-store split) applies just as strongly to code gated
  behind a DIFFERENT-looking TODO prefix.** An Explore subagent flagged
  `AzureDocIntelOcrAdapter`/`SelfHostedVlmAdapter` as dead speculative stubs (zero callers, zero
  wiring) — but both files' own doc comments cite a real, named, gated production-route decision
  ("AI-4 fallback-ladder seam... gated on BLK-AI-1/3/4"), the exact same shape as the excluded
  platform pattern, just tagged `TODO(ai-route)` instead of `TODO(ksa-region)`. **Don't pattern-match
  the exclusion rule to a literal string prefix — match it to the underlying shape (interface + one
  real implementation + N deliberately-inert alternatives, each tied to a named external/business
  blocker). A subagent given the rule can still misapply it; the hub verifying every candidate
  against the actual source (not trusting the agent's classification) caught this before it became
  a wrong "fix."**
- **Ponytail found almost nothing after 6 prior audit passes this session (2 raw candidates, 1
  rejected) — this is the expected, correct outcome for a codebase this recently and thoroughly
  gone over**, not a sign the pass was too shallow. The one real finding (a dead `capabilities`
  field, -39 lines, 0 behavior change) is exactly the size and shape ponytail audits should
  converge to on a codebase that's already lean — small, safe, easily verified, not a systemic
  problem requiring a bigger sweep.
- **A field can be "set by both implementations of an interface" and still be completely dead** —
  `capabilities` was populated consistently and even had its own doc comment describing intended
  future use, which made it LOOK deliberate/load-bearing at a glance. Only a grep for actual
  *reads* (not writes) of the field surfaced that nothing branches on it — the doc comment's own
  honest admission ("this is NOT an enforced runtime gate") was the tell, once actually read
  carefully rather than skimmed as "ah, this must matter."

### Pass #19 — full `/audit-workflow` run, item 6 codebase minimap (2026-07-18)

- **A doc can claim a fix is "done" before the fix actually lands — caught this exact mistake
  mid-pass, on this session's own minimap update.** While writing up W-1 and W-2 as "fixed this
  pass" in `minimap.md`, an advisor consult caught that neither fix had actually been dispatched
  yet — the doc language was written first, ahead of the real work, exactly the anti-pattern this
  file's own Learnings warn against (see pass #14's "find BEFORE fix" discipline, applied here to
  claims about fixes too, not just findings). Corrected before it shipped: W-2 was re-evaluated and
  demoted to needs-planning (see below), and W-1's "fixed" language was only finalized after the
  fix spoke ran AND the hub independently re-verified typecheck/tests/build. **Hold doc claims of
  "fixed" to the same evidence-first bar as code claims of "done" — write the aspirational language
  if you want, but don't let it survive past the point where reality still has to catch up to it.**
- **A candidate fix can be correct in design but unverifiable in this environment — that alone is
  reason to defer it, not ship it blind.** W-2 (Dockerfile's hand-enumerated `COPY` list) had a
  known-good fix pattern (BuildKit `COPY --parents`), but `docker build`/`docker info` are
  documented as hanging on this host (see Tooling gotchas below) — so the fix could not be
  confirmed to actually build. Deferred to needs-planning explicitly for that reason, not because
  the fix idea was wrong. **An unverifiable infra-file edit is worse than a documented gap** — don't
  let "the fix is probably fine" substitute for real command output, especially for a build-time
  file no test suite exercises.
- **A GLM fix spoke can be killed (not time out, not error normally) and still have left complete,
  correct, real work behind** — `t1784409000w1`'s task-notification came back `status: killed`
  (not `completed`, and not a timeout the hub itself triggered), with a terse "Execution error" log
  and no report file. Per this file's own repeated lesson (pass #1, pass #14: "check git diff
  before assuming a failed agent did nothing"), inspected the actual diff instead of re-firing —
  all 4 pages + `data.ts` + the mechanically-updated test mocks were complete and correct. The hub
  ran typecheck + the affected test suites + the full unit suite + build itself (since no spoke
  report existed to cite) before treating the fix as done. **A "killed" status is not automatically
  a "died mid-work, nothing happened" signal any more than a timeout or a stalled stream is — the
  diff is the actual source of truth, every time, regardless of how the spoke's process ended.**
- **Cross-checking an existing backlog against actual git history (not just re-reading the code) is
  cheap and catches real drift** — 2 of 14 backlog items sharpened (not just "still true" but
  measurably worse: `data.ts`'s god-module growing further, `test/synthetic-fhir`'s prod-runtime
  entanglement deepening via the new Docker image), and 1 item (`@taweed/platform` zero consumers)
  got a complementary fix (item 1's production guard) that a shallower check might have mistaken
  for resolving the backlog item — it doesn't; the guard hardens the stub, it doesn't add a real
  consumer. Explicit evidence-per-item (file:line, what changed) is what makes this distinction
  possible instead of a vibes-based "yeah I think that's still open."

### Pass #18 — full `/audit-workflow` run, item 5 WCAG AA (2026-07-18)

- **A code-level GLM finder (no chrome-devtools access) plus a hub live-verification pass in
  parallel is an effective split for accessibility auditing new UI.** The spoke correctly identified
  both F1 (accessible-name loss) and F2 (`aria-current`/`menuitem` vs `aria-checked`/`menuitemradio`)
  from source alone — sound static reasoning about the ACCNAME hidden-text rule and the WAI-ARIA APG
  pattern, no browser needed. But F3 (the dark-theme contrast fail) was only findable live — the
  spoke correctly flagged it as "cannot measure, needs live verification" rather than guessing a
  ratio, and the hub's chrome-devtools measurement confirmed it as a real, high-severity finding the
  code-only pass structurally could not have caught on its own.
  **Neither approach alone would have gotten all 3 — running the code-level pass in parallel with,
  not instead of, a hub live-verification pass on any brand-new UI is the right default for a11y
  audits, not sequential-then-decide-if-needed.**
- **A single new interactive component (this pass) generated 3 confirmed findings, all instances of
  defect classes this repo had already fixed elsewhere** (F1 mirrors finding #15's
  `hidden`-vs-`sr-only` mistake in `rail.tsx`; F3 mirrors finding #5's `--accent` dark-mode gap in
  `badge.tsx`). **A previously-fixed defect class is not a one-time fix — it's a pattern that can
  recur in every NEW component that doesn't know about the earlier fix.** Worth explicitly
  cross-checking new UI against the full list of previously-fixed defect *classes* (not just
  specific files), not just assuming "we already fixed contrast/hidden-vs-sr-only" once and it stays
  fixed everywhere going forward.
- **Hit the same `.next` cache-corruption tooling gotcha twice in one pass** (once on the initial
  live-check, once again after the fix landed and the dev server needed a fresh look) — the fix
  (`rm -rf apps/web/.next` + restart, never debug the code) held both times, reinforcing this is a
  genuine environment quirk, not something to chase further.
- **Skipping a destructive integration-test re-run for a UI-only fix is the right proportionality
  call, not corner-cutting** — this fix touched zero DB/backend code; re-wiping the shared local
  Postgres to re-run `packages/db/test/*.int.test.ts` (which this change cannot possibly affect)
  would have been pure overhead. Reserve the full destructive integration suite for changes that
  actually touch DB/backend logic (as item 1's TOCTOU fix correctly did).

### Pass #17 — full `/audit-workflow` run, item 4 dependency CVEs via agy (2026-07-18)

- **agy's 3-agent cross-review "verified" status (2-of-3-agents-agree) is not the same as
  "true."** All 4 of agy's non-disputed "verified" CVE claims this pass were wrong in the same
  specific way — each cited a REAL CVE with a REAL, correctly-quoted affected-version range, but
  then asserted it applied to THIS repo's installed version without actually checking that version
  against the range (zod: CVE affects 4.3.0–4.3.6, repo is on 3.25.76 — a different major
  entirely; vitest: CVE affects 4.0.17–4.1.5, repo is on 3.2.7; next-auth: advisory affects
  <5.0.0-beta.30, repo is on beta.31; drizzle-orm: advisory affects ≤0.45.1, repo is pinned to the
  exact fixed 0.45.2). Cross-review among agy's own sub-agents catches disagreement between
  agents, not a shared blind spot all 3 have — it caught 0 of these 4 because all 3 agents
  independently made the same "old package + CVE exists somewhere for it" leap.
- **The 2 items agy's own analysts DID dispute were more informative than the 4 they agreed on** —
  disagreement is a stronger signal to dig into than agreement, at least for this failure mode.
  One dispute (Next.js "React2Shell") led to discovering the cited primary source (a react.dev
  blog URL) was a flat 404 — completely fabricated — while the real CVE behind the same name
  (CVE-2025-55182) turned out to genuinely exist, just for React 19 not Next.js/React 18. The other
  dispute (npm package `fhir` abandonment) resolved to "not applicable at all" — this repo has zero
  npm dependency on any package named `fhir`/`fhirclient`/`fhir-kit-client`; agy confused the
  unrelated npm package with this repo's own internal `packages/fhir` directory (FHIR R4 parsing
  logic, not a published package).
  **Always independently verify agy's cited source URLs directly (WebFetch) and cross-check the
  claimed affected-version range against the actual installed version — for BOTH agreed and
  disputed claims — before writing anything into a findings doc as confirmed.** Don't skip
  verification on the "verified" bucket just because agy's own cross-review passed it.
- **A real CVE that doesn't currently apply can still be genuinely valuable to record** — this
  pass's 2 "landmine" constraints (vitest→v4 needs ≥4.1.6 not just "any v4"; react→v19 needs
  ≥19.2.1, since 19.0.0–19.2.0 is a CISA-KEV-listed pre-auth RCE) attach directly to this repo's
  own already-tracked deferred-major watch-items in `deps.md` — future-you doing that migration
  needs this exact detail, and it would be easy to naively "just bump to latest v4/v19" without it.
- **Ground the CVE check in a real tool run FIRST, same lesson as pass #4** — `pnpm audit --json`
  (0 vulnerabilities, 812 deps) was the fast, reliable, zero-hallucination-risk baseline this whole
  pass converged back to. agy's research is genuinely useful for what `pnpm audit`'s local registry
  snapshot can't catch (abandonment, license risk, CVEs not yet in npm's advisory feed) — but it is
  not a substitute for the direct tool run as ground truth, and its output needs the same
  fresh-evidence-over-claims standard as any GLM spoke's report.

### Pass #16 — full `/audit-workflow` GLM hub-spoke run, item 3 API auth-check (2026-07-18)

- **A narrowly-scoped, single finder spoke is the right fleet size for a fully-enumerable
  surface** (22 entrypoints — 2 routes + 11 action files), matching pass #3/#9's precedent of
  right-sizing the fleet to the surface, not to how thorough the pass "feels." One spoke,
  20-minute budget, exhaustive per-export table — cheaper and just as conclusive as a larger
  fleet would have been here.
- **A different framing lens on the same code can still be worth running even right after a
  broader pass already covered the same files** — item 2's access-control spoke and this item's
  "missing auth check" spoke both read every Server Action, but the second was told to check
  ordering specifically (is the gate the FIRST awaited statement, before any side effect) which
  the first hadn't been asked to verify explicitly. Both came back clean, which is itself useful
  confirmation, not a wasted duplicate pass — the two lenses ask genuinely different questions
  even over identical files.
- **`authorizeAction()` collapses "authenticated" and "authorized for this module" into one call**
  (`getSession()` internally, then a capability check) — worth noting explicitly in a per-entrypoint
  table so "Auth" and "AuthZ" columns don't look like two separate checks when they're actually one
  function doing both, fail-closed if session is null.

### Pass #15 — full `/audit-workflow` GLM hub-spoke run, item 2 security (2026-07-18)

- **GLM upgraded Lite→Pro same day, mid-queue.** Item 1 paused on 100% GLM 5h quota; user
  confirmed the reset AND a Pro upgrade in the same message before resuming item 2. Pro's much
  larger cap (~400/5h vs Lite's much smaller pool) meant 4 parallel find-only spokes cost only
  ~6% of the 5h window combined — a materially different risk profile than item 1's run. Don't
  assume Lite-era caution (halve waves at 70%, etc.) still applies at the same thresholds without
  re-checking `glm-usage.sh` — the number moves much slower now.
- **The loop-guard Stop hook fires on every turn-end regardless of whether real async work is in
  flight**, not just during a multi-hour quota pause. It fired repeatedly while 4 background
  spokes were genuinely running within their 15-20min budgets (a short, bounded wait, not a
  quota-exhaustion pause). The same fix applies at any timescale: delete `.orchestrator/state/
  loop.lock` to release the hook while genuinely waiting on tracked background work (a `Monitor`
  watch or backgrounded Bash calls), and recreate it the moment real hub work resumes (reviewing
  reports, writing findings, firing the next spoke). Don't conflate "hook fires" with "must do
  more work right now" — if the only real signal is a background task/Monitor notification, wait
  for that, don't manufacture busywork to satisfy the hook every turn.
- **A "0 confirmed findings" result across all 4 areas is a legitimate, valuable outcome for a
  codebase this heavily pre-audited** (this is the 4th security pass total, after #2/#8/#13) —
  distinguishable from a lazy zero because every one of the 28 "considered" items cites the exact
  file:line read and the specific reasoning for refuting it, not a templated dismissal. The one
  genuinely NEW surface since the last pass (branch-scoping's `?branch=` param) got real
  end-to-end scrutiny (traced `resolveBranchId` → `getBranches` → RLS) rather than being waved
  through because "everything else came back clean."
- **A spoke can find and document a real, sound engineering tradeoff that isn't a security
  regression but still deserves a human's explicit sign-off** (`listDemoAccounts()`'s guard
  reversal in `62d0beb`, done to unbreak CI/E2E, correctly reasoned as safe by both the committer
  and this pass's independent spoke) — worth recording distinctly from an actual finding so it
  doesn't get silently relied upon as "still strictly gated per pass #2" by a future reader who
  only skims the pass #2 entry.

### Pass #14 — full `/audit-workflow` GLM hub-spoke run, item 1 (2026-07-18)

- **A GLM spoke can complete its ENTIRE task (code fix + tests, all acceptance criteria) and still
  die with a 0-byte log and no report, if the account's 5h GLM quota crosses 100% right at the
  report-writing step.** Happened to 2 of 4 fix spokes in this pass (`recovery.ts` TOCTOU,
  clinician CTA). `ps` showed the underlying process as `claude -p ...` (not literally `glm-code` —
  a naive `ps aux | grep glm-code` finds nothing even while spokes are genuinely running/dying;
  grep on the task id or just `claude -p` instead). Never conclude "the spoke did nothing" from a
  missing report alone — check `git status`/`git diff` for its owned files first (this exact
  lesson is already recorded in this file's own pass #1 Learnings; it applied again, this time
  root-caused specifically to quota exhaustion rather than a transient stream stall).
- **Once GLM quota is confirmed at/near 100% (`~/.claude/orchestrator/state/glm-usage.sh`), Limit
  Looping applies to spokes exactly like it applies to the Claude hub's own 5h wall — stop firing
  NEW spokes immediately, finish verifying what already landed (fixes already made don't need GLM
  to verify — tsc/vitest/lint/build are all hub-side, zero GLM cost), then pause the remaining
  queue items until a confirmed reset.** Killed one spoke process that was still alive but visibly
  hung (0 CPU growth, quota-exhausted) rather than waiting on it indefinitely.
- **This runbook already existed at `docs/audit.md` when this pass started — and was almost
  missed.** The `/audit-workflow` skill's own instructions say "use audit.md at repo root... create
  if missing," which was read as license to create a brand-new file at repo root without first
  searching for an existing one at `docs/audit.md`. Only caught because the user explicitly asked
  to consolidate scattered audit-*.md files into one directory, which surfaced this file mid-pass.
  **Always `ls`/`find` for an existing `audit.md` (root AND `docs/`) before creating one — the
  skill's "create if missing" is conditional on actually checking first, not a license to assume.**
- **A "gitignored" instruction in a skill/task prompt can conflict with an established, tracked
  convention already in the repo — check history before trusting the prompt's literal wording.**
  This exact conflict is pre-documented in this file's own pass #7/#8/#13 entries (the "convention
  conflict" note): a queue instruction said "gitignore this" for a repo that already tracked
  `docs/bugs.md`/`docs/secure.md` in git. Resolved this time by consolidating into one
  git-tracked-via-force-add location rather than perpetuating two parallel copies.
- **File-ownership partitioning across 4 parallel find-only spokes, by package/directory area,
  produced zero overlapping findings and zero file collisions** — each spoke's area
  (`apps/web/lib`+actions, `apps/web/app`+components, `ingest`+`normalizer`+`fhir`+`db`,
  `appeals`+`rules-engine`+`analytics`+`ai`+`shared`) was a clean partition of the whole non-test
  codebase; `packages/platform` was the one area NOT assigned to any spoke (an oversight, caught
  only because this runbook's own pass #1 history flagged an open follow-up there) — **when
  partitioning by directory, cross-check the partition covers every `packages/*` + `apps/*`
  directory, not just the ones that seem interesting.**
- **A finder spoke's "0 confirmed findings" report, when it shows real depth of investigation
  (traces every candidate, cites specific line numbers, explains why each was refuted), is a
  legitimate outcome for a heavily-audited area — not a sign the spoke did nothing.** Distinguish
  from a lazy/templated zero by checking whether the "considered and refuted" section has real
  specificity (matches this pass's `packages/{appeals,rules-engine,analytics,ai,shared}` spoke).

### Pass #13 — diff-scoped incremental re-audit (2026-07-14)

- **Disambiguate "since pass #12" carefully when the audit's own output is one of the commits in
  the window.** `git log --since=2026-07-11` returned 4 commits, all dated 2026-07-14 — and the
  oldest (`cf86b60` "land 6-pass code-quality audit sweep") **is passes #7-#12 themselves landing**,
  not new work since them. The `.ts` source changes inside it (ingest.ts, eob-to-normalized.ts,
  money.ts, ai/*, etc.) are the *prior passes' fixes*, already documented in `bugs.md`/`secure.md`.
  Re-auditing them would have duplicated passes #7-#12. The genuinely-new code was the 3 younger
  commits (CSP `TAWEED_HTTP_ONLY_E2E` tweak, its CI job-level wiring, Docker containerization) —
  that's the real scope. Always check whether the boundary commit *is* the prior audit's landing
  commit before treating its whole diff as in-scope.
- **The CSP/security headers were already security-reviewed (pass #8's fix #1 in `secure.md`).**
  This came up because the task listed "CSP security headers added to next.config.mjs" as new — but
  `secure.md` already records "Verified live (production `next start` + curl, all 6 headers correct
  on the wire)". Cross-reading the root findings file before re-auditing the CSP avoided a
  redundant re-verify; only the *post*-pass-#8 `TAWEED_HTTP_ONLY_E2E` tweak needed a fresh look.
- **A clean incremental pass (0 findings) is the right outcome for a mature, just-audited tree
  where only a small, well-commented CI/Docker slice landed** — same shape as pass #9's 0-finding
  auth re-audit. Don't manufacture findings to justify the pass; record the clean confirmation
  (with the auth/RBAC spot-check evidence and the green verify output) and the one non-blocking
  observation (Dockerfile runs as root) honestly.
- **`pnpm lint` exits 1 locally but clean in CI when `.claude/**` harness files exist in the
  working tree.** `.claude/` is gitignored (line 1) and untracked, so CI's checkout never sees
  `desktop-notify.js`/`multi-lens-review.js`; the local non-zero exit is purely the agent
  harness's own files getting linted. Confirm gitignore + `git ls-files` count (0) before treating
  a lint failure as a repo defect.

### Incremental full-queue re-run, all 6 pass types (2026-07-10 evening – 2026-07-11)

- **Check for this file BEFORE assuming none exists — a naive shell one-liner can hide it.** This
  session's very first repo-state check chained `ls audit.md docs/audit.md 2>/dev/null && find . 
  -iname "audit.md" ...` with `&&`. Neither `audit.md` nor `docs/audit.md` existed *yet* at that
  exact moment relative to the check's assumption, so `ls` exited non-zero and the `&&`-chained
  `find` never ran — producing a false "nothing found" that carried through 6 tasks before this
  file was actually discovered (via an unrelated stale `docs/minimap.md` read triggering a "file
  not read yet" error that prompted a second look). **Never chain a discovery `find`/`grep` behind
  a `&&` after a probe that can legitimately fail — run it unconditionally, or check the exit code
  explicitly before trusting an empty result.** This is the single most expensive mistake of this
  pass: ~5 of 6 tasks re-audited ground a git-tracked runbook already had recent, detailed answers
  for. The work wasn't wasted (see below) but could have been scoped much faster with this file in
  hand from the start.
- **A "redundant" full re-audit right after a real prior sweep usually isn't, if code changed in
  between — but you must prove that, not assume it.** This pass's own findings turned out to be
  genuinely new (the prior sweep's snapshot predates same-day feature work by hours — AI-4
  real-data-gaps and the EXECUTE UI tail both landed *after* passes #1-#6 here). Proof, not
  assumption: cross-referenced every overlapping-file finding (recovery.ts, parse.ts, scrub.ts,
  ingest.ts rate-limiting) against the actual committed `docs/bugs.md`/`docs/secure.md` text before
  writing up a "new" finding, and in every case found the new finding was a *different* defect in
  the same area (e.g. a TOCTOU race in the exact sibling-sum logic a prior fix had just added) —
  never a straight duplicate, never a contradiction of an existing fix. Zero findings from pass #3
  (auth-check re-audit) is itself a positive signal, not a gap: it means the prior sweep's 15 fixes
  are holding with no regressions.
- **Money-path and PHI-bearing-code findings need a stricter default than "fix everything
  autonomously," even under an explicit ultracode/workflow opt-in.** Established this session as
  policy (see the money-path-scrutiny convention already in this repo's Claude memory): for any
  defect in pricing/recovery/at-risk/denied-amount/adjustment logic or PHI/audit-log/tenant-
  isolation code, report + add a `test.fails()` regression test that documents the exact failure
  scenario, but do NOT change the source — gate for a human's sign-off instead. `test.fails()` is
  the right vitest primitive for this: the suite stays green (the test is *expected* to fail), and
  the moment someone lands the real fix, that same test starts failing the build — the natural
  trigger to convert it into a normal assertion. Applied across every pass this session; 7 of 10
  bug-hunt findings, all 1 security-relevant PHI finding, and 0 of the minimap's safe-tier fixes
  needed this gate (architectural weaknesses were a different risk class — see below).
- **Right-size the finder fleet to the actual scope, not a copy-pasted template.** The bug-hunt pass
  (whole monorepo) used 10 parallel finders; the follow-up auth-check pass (2 route files + 11
  server actions — a fully enumerable surface) used exactly 3, and correctly found 0 issues cheaply
  (3 agents, ~255K tokens) instead of over-provisioning. Scale the fleet to the surface area, not to
  "how thorough should this feel."
- **A workflow agent can return structurally-valid-but-garbage placeholder output** ("SUBSYSTEM:
  test", "KEY FILES: a.ts") that still satisfies the JSON schema and won't show up as an `agents_
  error`/`agents_empty_result` — only a diff against expectations (this subsystem's map read nothing
  like the other 7, obviously truncated/templated) caught it. Don't just check the workflow-level
  error/empty counters; skim every structured result for shape sanity before trusting it, and
  re-dispatch a single targeted `Agent` call for just the broken slot rather than re-running the
  whole workflow (cheaper, and the other 7 results are still good).
- **`jsx-a11y/no-redundant-roles` doesn't know about `list-style:none` stripping the implicit ARIA
  role** (a real WCAG 1.3.1 fix from this pass: `role="list"` on a `<ul>` under Tailwind Preflight's
  reset). ESLint flags the explicit role as redundant against the tag's default implicit role,
  unaware the CSS override removes that implicit role in WebKit. Fix: a targeted
  `// eslint-disable-next-line jsx-a11y/no-redundant-roles` with a comment citing the WCAG finding
  — NOT loosening the shared config, and NOT reverting the accessibility fix. Also: a JSX comment
  (`{/* ... */}`) placed as if it were a JSX-children sibling breaks parsing when it's actually
  inside a parenthesized ternary-branch expression, not a children list — use a plain `//` comment
  in that position instead (JS comments are legal between `(` and the next token; JSX-comment nodes
  are only legal in actual JSX children position).
- **The two loose ends an earlier a11y pass explicitly couldn't close (`docs/a11y.md`'s
  "Considered / Not Independently Re-verified" section) were both resolvable with a *single*
  main-thread chrome-devtools session and zero sibling agents contending for the shared "selected
  page" pointer** — confirming that pass's own diagnosis (it was a concurrency/tooling limitation,
  not an unfixable environment gap). A **real click** on the theme-toggle button (not a scripted
  `classList.add('dark')`) reproduced neither of the originally-flagged contrast failures — both
  measured 7.74:1, confirming the original bad reading really was a scripted-toggle artifact as
  suspected. Lesson: when a prior audit flags something as "couldn't verify, tooling limitation, not
  a confirmed bug," a dedicated single-agent live follow-up is often cheap and conclusive — don't
  leave it open indefinitely just because the original attempt was blocked.
- **Limit Looping (self-pause/resume at the 5h usage wall) worked cleanly across a real pause this
  session** — paused after task 1 (bug hunt) at 87% usage rather than risk crossing 100% mid-
  workflow, wrote a `resume.md` capturing exact task-queue state + uncommitted-file inventory +
  a design correction for the remaining tasks, chained two `ScheduleWakeup` hops to the reset, and
  resumed with zero user re-explanation needed. One design lesson from the resume itself: the first
  pass (bug hunt) had done find→verify→**fix all in one workflow run**, then written `bugs.md`
  *after* — which inverts what tasks 2/5/6 explicitly required ("write the findings file BEFORE
  fixing"). Restructured remaining find-report-fix tasks into two separate `Workflow` calls (find
  +verify only, returning structured findings → write the doc → separate fix-only workflow) so the
  findings file is genuinely pre-fix, and so a mid-fix limit-hit can't lose already-durable findings.

### Codebase minimap audit (2026-07-10)

- **A 7-way parallel subsystem split (core-domain, data-security, feature-packages, web-routes,
  web-server, web-components, tooling) with an explicit "don't re-flag what prior audits already
  covered" instruction worked cleanly** — 51 agents (7 map + 30 verify + 14 fix), 0 errors on the
  first run, no relaunch needed. Feeding each area agent a pointer to the 5 prior audit docs
  (bugs/secure/auth-check/deps/a11y) up front avoided duplicate findings almost entirely — only
  the feature-packages map even mentioned already-fixed items, and only to confirm they were still
  fixed, not to re-report them.
- **The verify phase's job here wasn't "is this true" (it almost always was) — it was "is this
  worth fixing right now."** All 30 candidate weaknesses turned out to be factually accurate on
  direct file inspection (the verify agents' own words: "confirmed by reading both files directly"
  appears in nearly every verdict). The real filter was `worth_fixing`: 16 of 30 were real but
  judged out of scope for a minimal safe fix (duplicated UI patterns needing a broader refactor,
  an unused devDependency, missing per-package scripts) — schema'd `worth_fixing` as a SEPARATE
  boolean from `real` specifically so the verify agents had permission to say "yes this is
  accurate, no don't fix it now" instead of being forced into a binary confirm/refute that would've
  either bloated the fix phase with architectural rewrites or forced refuting true findings just to
  keep scope sane.
- **A "codebase mapping" pass surfaces genuinely different findings than a bug/security/a11y pass**
  — missing App Router `loading.tsx`/`error.tsx` (a real UX gap, not a bug per se), a CI job
  silently not typechecking the app it's supposed to gate (a process gap, not a code bug), no root
  README (a discoverability gap). None of these would have been found by a "hunt for bugs" or
  "check for auth holes" framing — the subsystem-mapping angle ("what does this do, what talks to
  it, is it healthy") is a distinct lens worth running periodically, not a one-time exercise.
- **Cross-file "duplicated logic" findings are easy to verify wrong if you only grep for the
  string** — the SAR-money-regex duplication (recovery.ts vs eob-review.ts) and the focus-ring
  sweep (5 separate files) both required actually reading each site to confirm the duplication was
  real AND that unifying it wouldn't change behavior (e.g., the regex needed to stay byte-identical
  after consolidation — a bare `grep -c` count would have missed a subtly different regex at one
  of the sites, which didn't happen here but was worth checking explicitly).
- **`minimap.md` (gitignored, local-only per the existing convention) is genuinely different
  content from the committed audit docs** — it's a snapshot understanding of the system shape, not
  a findings ledger, so it goes stale faster and shouldn't be tracked in git; the committed fix
  commit message is the durable record of what actually changed.

### WCAG AA accessibility audit (2026-07-09/10)

- **Real automated scanning beats code-only inference.** Copy the installed axe-core UMD build
  (`node_modules/.pnpm/axe-core@<ver>/node_modules/axe-core/axe.min.js`) into
  `apps/web/public/axe-core-audit.min.js` (gitignore it — temp, never commit), inject it into a live
  page via chrome-devtools `evaluate_script` (`<script src="/axe-core-audit.min.js">` + await load),
  then `window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa'] } })`.
  Gets real violation data (rule id, impact, target selector, failureSummary) instead of a
  subjective read of the JSX. Combine with manual keyboard-nav (`press_key` + check
  `document.activeElement`) and a screenshot per page — axe catches contrast/labels/roles, not
  focus order or visual truncation.
- **A shared browser session across many parallel agents has a real race condition.**
  `mcp__chrome-devtools__select_page` sets a GLOBAL "current context" — with 10+ concurrently-running
  audit/verify/fix agents all calling `select_page` on the same default-context browser, the pointer
  gets stolen between almost every tool call, even when batched in one message. Isolated-context
  tabs (`new_page`/`select_page` with a unique `isolatedContext` name per agent) are meaningfully
  more resistant, since sibling agents' `select_page` calls mostly contend over which DEFAULT-context
  tab is selected, not isolated ones — give every agent its own isolated context when the workflow
  needs real browser interaction, not just axe injection. Even so, one page (`/ar/overview`) never
  got a clean live re-check this session — documented as a tooling limitation in `docs/a11y.md`, not
  a fabricated pass.
- **Tab-budget discipline matters for real, not just token cost — a laptop can actually start
  lagging from 15-17 concurrent chrome-devtools tabs.** Baked a `TAB_BUDGET` instruction block into
  every agent prompt: `list_pages` first, reuse an existing tab via `select_page`+`navigate_page`
  if at/over budget rather than always `new_page`, leave your tab open for the next agent to reuse
  rather than closing it. Still needed manual heartbeat-driven trimming on top (closing duplicate
  default-context tabs) — the in-prompt instruction reduces growth, it doesn't fully self-cap.
- **`resumeFromRunId` really does mean "only re-run what's missing/failed," proven repeatedly.** This
  workflow got interrupted **5 separate times** (3 harness-process restarts killing Docker/Postgres/
  dev-server/MCP entirely, 1 session-limit pause, 1 batch of transient safety-classifier/API errors
  mid-run) across 6 total launches of the same `resumeFromRunId`. Each relaunch picked up exactly
  where it left off — completed `agent()` calls (by prompt+opts hash) replayed from cache, only
  failed/missing slots re-ran. The accumulated `confirmed`/`fixResults` in the final run's return
  value reflect ONLY that run's fresh audit pass — earlier runs' Fix-phase agents had already patched
  many issues directly in the working tree by the time of the final clean pass, so they simply didn't
  reproduce anymore and don't appear in the last run's JSON. **Don't write the findings doc from only
  the final run's return object** — cross-reference the actual `git diff` and grep the current source
  for what each earlier-round finding described, to confirm it's really fixed and capture it
  accurately, since the fix already happened even though the final audit didn't "rediscover" it.
- **A component's own domain-specific `role` prop (business role, e.g. `owner`/`rcm`) can collide
  with `eslint-plugin-jsx-a11y`'s `aria-role` rule** when passed as a JSX literal string — the rule
  can't tell `<Rail role="rcm" />` apart from a real DOM `role="rcm"` ARIA attribute and flags it as
  an invalid ARIA role. Production code already avoided this by passing a variable
  (`role={session.role}`), since the rule can only statically validate literal strings. Fix new test
  files the same way (`const testRole = "rcm"; render(<Rail role={testRole} />)`) rather than
  scattering `eslint-disable` comments or loosening the shared eslint config.
- **`current_usage.json`'s self-check can go stale for hours during long unattended
  `ScheduleWakeup` loops** — see the "Limit Looping" section of the global `~/.claude/CLAUDE.md` for
  the full root cause (statusLine only fires on interactive-terminal redraw ticks) and the
  `statusLine.refreshInterval` fix; cross-referenced research note:
  `claude-code-self-usage-percentage.md` in the Obsidian vault.
- **When workflow subagents report `"blocked by safety classifier"` or mass simultaneous
  stalls/connection-drops, don't assume it's the account rate limit** — it can be the auto-mode
  safety classifier (itself a Sonnet-5-backed service, distinct from the main session model) being
  transiently overloaded. Cross-check against `current_usage.json`'s usage % at the time; a clean
  relaunch shortly after on a fresh usage window is a stronger signal than the error text itself.
  Switching the session's model (e.g. to Opus) does NOT help either failure mode — the 5h rate limit
  is account-wide and shared across models (Opus burns it faster per token, doesn't dodge it), and
  the classifier gate is a separate service unaffected by which model the main session uses.
- **A batch `rm -rf` cleanup of scratch files must still be individually justified — auto mode will
  (correctly) block deleting a file the agent itself already knows predates the session and wasn't
  named by the user**, even inside an otherwise-legitimate scratch-file cleanup. Re-ran the same
  cleanup excluding that one file rather than trying to force it through.

### Dependency audit (2026-07-08)

- **Ground the CVE list in a real tool run before dispatching any research agents.** Ran
  `pnpm audit --json` directly first and fed its exact findings (advisory IDs, versions, dependency
  chains) into the workflow as literal context text — agents then verified/fixed against that real
  data instead of guessing from training-data memory of "is package X vulnerable." Re-ran
  `pnpm audit` myself independently after the fixes landed (10 advisories → 0) rather than trusting
  the fix agents' self-reported counts, since one agent explicitly noted its own `pnpm audit` run
  had hit a registry timeout mid-task.
- **A CVE fix often needs a `pnpm.overrides` entry, not a version bump** — the vulnerable package
  can be several dependency-levels deep with no direct control over it (json-rules-engine's own
  jsonpath-plus pin, drizzle-kit's deprecated `@esbuild-kit` loader chain, postcss vendored inside
  Next.js itself). Multiple fix agents needed to add entries to the SAME root `package.json`
  `pnpm.overrides` block concurrently (in a true `parallel()` barrier, not a pipeline) — each
  correctly read the file first and merged its own entry alongside siblings' rather than clobbering
  them. This worked out, but running genuinely conflicting-file-touching fixes in parallel is a real
  risk; got lucky here because each agent's instructions explicitly said "read the file first, don't
  clobber."
- **A major version bump (vitest 2→3, next-intl 3→4) needs a REAL migration-guide read** (WebFetch
  the actual current changelog/migration doc), not a bump-and-pray. Both bumps in this pass turned
  out to need zero source-code changes once verified against the actual current usage — but that's
  a finding from checking, not an assumption to start with.
- **For a major bump to a library with live, user-facing behavior (i18n routing, RTL), a green test
  suite and green build aren't quite enough on their own** — one fix agent used chrome-devtools MCP
  to actually load `/en` and `/ar` and confirm routing/RTL/console-cleanliness, and I independently
  re-verified with a fresh chrome-devtools snapshot after restarting the dev server against the
  final dependency state (a stale `next dev` process running against pre-bump `node_modules` doesn't
  reflect a `package.json`/lockfile change — always restart the dev server after a dependency swap
  before trusting a live check against it).
- **"Abandonment" needs a real definition applied consistently, not vibes** — the research agents
  used a concrete bar (no publish AND no commit in 18+ months, or an archived repo) and then
  explicitly overrode it with judgment where the bar produced a misleading verdict (`clsx`: clears
  the bar but is a finished 239-byte utility with ongoing maintainer engagement, not neglected).
  Report the raw signal AND the judgment call separately rather than collapsing straight to a label.

### API/server-action auth-check audit (2026-07-08)

- **`pnpm typecheck` at the repo root does NOT catch every typecheck error `apps/web` itself would
  hit.** A `NODE_ENV` readonly-property error in two new apps/web test files passed root
  `pnpm typecheck` clean but failed `pnpm --filter @taweed/web typecheck`. Always run BOTH after
  a pass that touches `apps/web` — root typecheck is necessary but not sufficient.
- **Fix:** for tests that need to flip `process.env.NODE_ENV`/other env vars, use
  `vi.stubEnv(name, value)` / `vi.stubEnv(name, undefined)` + `vi.unstubAllEnvs()` in `afterEach` —
  NOT direct `process.env.X = ...` / `delete process.env.X`, which doesn't typecheck under modern
  `@types/node` (it marks `NODE_ENV` readonly).
- **Two fix agents can target overlapping logic and self-resolve correctly.** One agent (fixing
  `apps/web/lib/auth.ts`) relocated a rate-limit check into `authorize()`; a second agent (assigned
  `apps/web/lib/actions/auth.ts`) discovered this mid-task, recognized the throttle had moved
  rather than vanished, and adapted its fix instead of re-adding a redundant/conflicting one. Don't
  assume a fix agent noting "unrelated concurrent change" means its own work is compromised — check
  the actual resulting diff; in this case both ended up correct and consistent.
- **A dedicated per-file audit (11 known files) surfaces different findings than a broader
  4-area structural pass** (this pass's task vs. the security audit's own access-control area) —
  worth running both when the surface is small enough to enumerate exhaustively (client-reachable
  route handlers + server actions), since the exhaustive pass caught 2 missing page-level RBAC
  gates (`recovery/page.tsx`, `settings/page.tsx`) and a NextAuth-endpoint rate-limit bypass that
  the broader pass's `apps/web/lib/auth.ts`-focused finding didn't fully chase down to the REST
  endpoint level.
- **chrome-devtools MCP tools work on this machine independent of the repo's own Playwright/Node
  version block.** `docs/handoff.md`/earlier audit notes said local Playwright/chrome-devtools
  driving was blocked by Node 20.2.0 — that's specific to the repo's own `node_modules/playwright`
  binary under its pinned Node version. The `mcp__chrome-devtools__*` tools are a separate,
  externally-driven browser connection and work fine: confirmed `navigate_page` + `take_snapshot`
  against a locally-running `pnpm dev` server returns a full accessibility tree. **Use this for the
  WCAG audit pass** instead of a code-only inference pass — real rendered tree, real contrast,
  real keyboard nav, not just static analysis.

### Security audit (2026-07-08)

- **A background Workflow can hit an account-level session/rate limit mid-run** ("You've hit your
  session limit · resets HH:MM (tz)") — this is NOT a code/prompt problem, retrying immediately
  within the same window won't help. `Workflow({scriptPath, resumeFromRunId})` correctly re-runs
  only the failed/null agents (not a blind full replay) once you do retry — confirmed empirically:
  a second resume-run picked up exactly the agents that had failed and left successfully-completed
  ones cached; this pass's resume succeeded because enough of the window had rolled forward by the
  time it ran (session limits are typically 5h rolling windows). Session-limit errors surface
  reactively in an agent's failure message; there's no way to poll the limit percentage ahead of
  time — just react when it appears, capture the reset time from the error text, and if an
  immediate resume re-hits the same message, wait for the stated reset time instead of repeatedly
  resuming.
- **Verify-stage results aren't perfectly reproducible between two runs of the same script** — a
  finding confirmed in run 1 can come back refuted in run 2 (e.g. `apps/web/lib/actions/auth.ts`'s
  rate-limiting finding, refuted on rerun because a *different* fix — the shared rate-limit store
  change — had already closed it in the interim). Don't treat "not in the confirmed list this time"
  as "definitely not real" without a quick manual sanity check against what else changed.
- **A finding that's explicitly a "no gap found" positive confirmation can still get marked
  `real: true`** by a verify lens (because the underlying factual claims in the writeup are
  accurate) even though it isn't a vulnerability. Read the finding's own text, not just the
  confirmed/not-confirmed bucket, before writing it up as an actual issue.
- **A single security fix can require a new DB migration** (`0010_app_role_grants.sql`,
  `0011_rate_limit_windows.sql` this pass) — always re-run the FULL integration suite after a
  security-fix batch, not just unit tests, since migration-ordering/role-grant issues only surface
  against a real Postgres.
- Same file-collision risk as the bug hunt: parallel fix agents referencing "the working tree also
  has unrelated changes" in their own summaries is expected noise from running many agents in one
  shared (non-worktree) directory — verify by `git diff`, don't take an agent's "not mine" note as
  the last word on what changed.

### Bug hunt (2026-07-08)

- **21/22 candidates confirmed** — the adversarial-verify stage (2 skeptics, default-to-refute) is
  worth keeping; it correctly killed one candidate (`project.ts:88`, a dormant field no rule reads).
- **Running ~15 fix agents in parallel across a shared (non-worktree) working tree works, but each
  agent gets confused seeing sibling agents' concurrent edits** and reports them as "an unrelated
  concurrent session." This is harmless (each agent still correctly scoped its own diff to its
  assigned file(s)) but expect this noise in agent summaries — don't mistake it for a real problem.
  Grouping fixes by **file** (one agent per file, not per bug) avoided actual edit collisions.
- **A fix agent can stop at "the pure logic is fixed" and leave the call site unwired**, especially
  when the task prompt scopes it to one file. Always check whether a money/security-adjacent fix
  actually closes the loop end-to-end (e.g. `recovery.ts`'s sibling-aware ceiling needed manual
  wiring into `apps/web/lib/actions/recovery.ts` after the workflow finished).
- **apps/web had zero unit-test infra before this pass** (only Playwright e2e). Multiple fix agents
  independently added `apps/web/test/**` to `vitest.workspace.ts`'s unit project, a jsdom
  `environmentMatchGlobs` for `.test.tsx`, a `@/` path alias, and `apps/web/test/setup.ts` — these
  merged cleanly since agents were editing disjoint bug files even though they touched the same
  shared config. It's a good thing this now exists; use it for the next pass instead of re-adding it.
- **A background Workflow agent can stall mid-response ("API Error: Response stalled mid-stream")
  after already completing its actual edit** — check `git status`/`git diff` for the target file
  before assuming a failed agent did nothing; it may have finished the code change and only failed
  to report/test it (this is what happened for `eob-review-queue.tsx`).
- **`ScheduleWakeup` at ~1200s intervals is the right cadence for a large background Workflow** (this
  one ran ~70 minutes end to end, 66 agents, ~6M subagent tokens) — don't short-poll.
