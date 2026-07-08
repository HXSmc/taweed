# Audit runbook — Taweed

> Living reference for repeat audit passes (bugs, security, authz, deps, a11y, mapping). Read this
> first before launching a new audit workflow — it exists to make the next pass faster, not to
> re-derive repo layout/tooling from scratch every time. Update it (§Learnings) after each pass.

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
- **Node is v20.2.0** — below Next 16's floor (intentionally pinned to Next 15) and blocks local
  Playwright/chrome-devtools driving. Any a11y/visual audit that needs a live browser must rely on
  CI E2E+a11y, or do a code-level pass only and say so explicitly — don't claim a visual check that
  didn't happen.
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
