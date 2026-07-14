# Audit runbook — Taweed

> Living reference for repeat audit passes (bugs, security, authz, deps, a11y, mapping). Read this
> first before launching a new audit workflow — it exists to make the next pass faster, not to
> re-derive repo layout/tooling from scratch every time. Update it (§Learnings) after each pass.

## Audit history at a glance

| # | Pass | Date | Output | Confirmed / found | Verification |
|---|---|---|---|---|---|
| 1 | Bug hunt | 2026-07-08 | `docs/bugs.md` | 21 confirmed, 1 refuted (of 22) | unit 483/483, int 37/37, build green |
| 2 | Security (injection/authn/secrets/access) | 2026-07-08 | `docs/secure.md` | 10 confirmed + 1 confirmed-clean | unit 533/533, int 42/42, build green |
| 3 | API/server-action auth-check audit | 2026-07-08 | (fixed inline, no dedicated doc) | 15 missing-auth-check findings, all fixed | typecheck/lint/tests green |
| 4 | Dependency audit (CVEs, abandonment, license) | 2026-07-08 | `docs/deps.md` | 10 advisories → 0; several floor-hygiene + watch-items | unit/int green, build green |
| 5 | WCAG AA accessibility audit | 2026-07-09/10 | `docs/a11y.md` | 25 confirmed and fixed | unit 668/668, int 42/42, build green |
| 6 | Codebase minimap (subsystems/connections/weaknesses) | 2026-07-10 (~02:18) | `docs/minimap.md` (gitignored, local-only) | 14 of 30 candidates confirmed+fixed, 16 deferred | unit 708/708, int 42/42, build green |
| 7 | **Incremental re-run: bug hunt** | 2026-07-10 (~20:00) | `bugs.md` (**repo root, gitignored** — see convention-conflict note below) | 10 confirmed, 1 refuted (of 11) | unit 919/919, root+web typecheck green |
| 8 | **Incremental re-run: security** | 2026-07-10 (~21:56) | `secure.md` (**repo root, gitignored**) | 3 confirmed, 2 refuted (of 5) | unit 928/928, prod build green |
| 9 | **Incremental re-run: API/server-action auth-check** | 2026-07-10 (~22:33) | (no dedicated file — 0 findings) | 0 findings across all 22 entrypoints (prior sweep's 15 fixes hold, no regressions) | — |
| 10 | **Incremental re-run: dependency audit** | 2026-07-10 (~22:33) | (no dedicated file) | 0 CVEs (807 deps); 15 safe patch/minor bumps applied; 14 majors + next-auth governance risk flagged | unit 933/933, typecheck green |
| 11 | **Incremental re-run: WCAG AA** | 2026-07-10 (~23:00) | `docs/a11y.md` (updated in place, findings #23-24) | 2 confirmed+fixed; both prior "Considered" loose ends closed clean via live re-check | unit 933/933, typecheck green |
| 12 | **Incremental re-run: codebase minimap** | 2026-07-10/11 (~23:30) | `docs/minimap.md` (overwritten — superseded pass #6's stale snapshot) | 24 weaknesses found (9 fixed safe-tier, incl. a re-dispatched agent + 2 follow-up fixes; 15 flagged for planning) | unit 977+/977+, typecheck green |
| 13 | **Incremental re-run: diff-scoped bugs + security (CSP/CI/Docker)** | 2026-07-14 | `bugs.md` + `secure.md` (repo root, gitignored) | **0 confirmed, 0 refuted** — clean pass; auth/RBAC spot-check (4 server actions) holds; Dockerfile-runs-as-root noted as non-blocking FYI | unit 982/982, root + web typecheck green, lint clean (CI) |

**Passes #7-#12 (2026-07-10 evening / 2026-07-11) are an incremental re-run, not a redundant one.**
They ran *after* the same day's AI-4 real-data-gaps and EXECUTE-UI-tail work landed (~07:50+,
*after* pass #6's ~02:18 snapshot) — genuinely new code (onboarding corridor, audit-report/
owner-report pages, eob-review approve flow) that passes #1-#6 never saw. Every overlapping-file
finding was cross-checked against the committed `docs/bugs.md`/`docs/secure.md` before write-up to
confirm it's a **complementary refinement** of an already-fixed issue, not a duplicate or a
conflict (e.g. pass #7's `recovery.ts` TOCTOU race is a race condition *in* the sibling-aware
ceiling logic pass #1 added — see `docs/bugs.md` #15 vs. this session's `bugs.md` #6; pass #7's
`parse.ts` fullUrl-leak finding is a residual gap in the id-collision detector pass #1's `bugs.md`
#13 added). Pass #9 (0 findings) is a *positive* confirmation, not a gap — it's exactly what you'd
expect from re-scanning code whose auth gaps a prior pass (#3) already closed.

**Convention conflict — flagged for a human decision, not resolved unilaterally:** passes #1-#6
followed this repo's established convention of committing findings docs (`docs/bugs.md`,
`docs/secure.md` tracked in git, per the §Conventions section below). Passes #7-#8's queuing
instructions said "(ignore all .md in git)" for the bug-hunt/minimap tasks specifically; the
session that ran them read this as "exclude `*.md` files from the audit *scope*" (consistent with
task 6's separate, explicit "(ignore in git)" instruction for the minimap specifically — if task
7's queue meant "gitignore the output" too, why say it differently and only for the minimap?) but
erred toward the safer reading and gitignored `bugs.md`/`secure.md` at the repo root instead of
appending to the tracked `docs/` versions. **Net effect: two parallel sets of findings docs exist**
— `docs/bugs.md`/`docs/secure.md` (tracked, passes #1-#2) and root `bugs.md`/`secure.md`
(gitignored, passes #7-#8). Recommend: fold the root files' *new* findings into the tracked
`docs/` versions (as new numbered entries continuing each file's sequence) next time this runbook
is used, then delete the root copies — but that's a decision for whoever's driving the next pass,
not something this pass did unprompted to already-committed history.

All passes used the same core method: parallel finder/mapper agents by area → each candidate
adversarially re-verified by an independent agent (default-to-refute) → every CONFIRMED finding
fixed with a regression test (or, for money/PHI-path findings — see the money-path policy note
added in §Learnings below — reported + a `test.fails()` regression test only, gated for human
sign-off) → full typecheck+lint+unit+build re-run before calling it done. Passes #1-#5 are
committed to git (`docs/*.md` + the code fixes); #6/#12's `minimap.md` is intentionally local-only
(see its own file header) but its code fixes are committed like the others. Passes #7-#8's `bugs.md`/
`secure.md` are local-only per the convention-conflict note above; their code fixes are NOT yet
committed as of this writing (push/commit is user-gated, same as every other pass).

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
  tools** — they're a separate, externally-driven browser connection and work fine (confirmed twice
  now: 2026-07-08's auth-check pass, and 2026-07-10/11's incremental a11y pass, which drove real
  navigation + clicks + axe-core injection against a `pnpm --filter @taweed/web dev` server started
  on a spare port). Use chrome-devtools MCP for any a11y/visual audit that needs a live browser;
  reserve "code-level pass only, say so explicitly" for when chrome-devtools MCP itself is
  unavailable, not for this Node-version reason.
- **Docker `docker info`/`ps`/`exec` can hang on this host**; the Postgres container and port work
  fine regardless — probe with `nc -z localhost 5432` instead of trusting `docker compose ps`.
- **Integration tests are destructive** (`pnpm test:int` wipes + re-migrates the shared local DB) —
  re-seed after (`pnpm --filter @taweed/web seed`) before manually clicking through the app again.

## Conventions for audit output files

- `docs/bugs.md`, `docs/secure.md` — tracked in git (like `docs/review.md`). One entry per
  **verified** finding only (CONFIRMED, not just plausible) — severity, file:line, repro/failure
  scenario, fix applied, and the test that now guards it.
- A gitignored `minimap.md`-style file (mapping the codebase) stays **local-only** — add its exact
  name to `.gitignore` when created, same pattern as `docs/NEXT_STEP_PROMPT.md`/`docs/blocker.md`.
- This file (`docs/audit.md`) is the one meta-doc that persists across passes — update its
  §Learnings section after every audit run, not just at the very end of a queued batch.

## Learnings (append after each pass — newest on top)

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
- **`docs/minimap.md` (gitignored, local-only per the existing convention) is genuinely different
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
