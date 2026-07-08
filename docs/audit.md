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
