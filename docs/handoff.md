# Handoff — start here (next session)

> Entry point for a new Claude Code session picking up Taweed. Read this, then run the
> EXECUTE prompt (`docs/NEXT_STEP_PROMPT.md`). Blocker register + a per-blocker unblock prompt:
> `docs/blocker.md`. Written 2026-07-04; last refreshed 2026-07-05 (IMPLEMENT merged to `main`, EXECUTE next).

## Where the project stands

- **CREATE + IMPLEMENT phases are DONE on synthetic/placeholder data** and merged to `origin/main` (github.com:HXSmc/taweed), merge `44e0e13` (2026-07-05). *(The `02` §2 / §8-wk3 CREATE-exit items that need real data — parsing one real de-identified NPHIES `ClaimResponse` to DB, and a KSA-RCM-SME-reviewed denial-reason taxonomy — remain deferred/blocked: `BLK-1` partner data, `BLK-2` real codes, `BLK-9` SME sign-off. "CREATE ✅" below means the synthetic spine, not the real-data exit gate.)*
- Full working product **on synthetic data**: 5 MVP modules + a bilingual EN/AR RTL multi-tenant Next.js 15 app. **143 unit + 11 integration** tests green; `pnpm build` green; multi-agent review (security/healthcare/TS) run and fixes landed.
- **Next up: EXECUTE phase** — point it at a real design partner's data; tune rules to their top payers; move the recovered-SAR counter on real data. Full paste-ready prompt: `docs/NEXT_STEP_PROMPT.md`. Every blocker + its unblock prompt: `docs/blocker.md`.
- Roadmap: CREATE ✅ → IMPLEMENT ✅ → **EXECUTE (next)** → DEPLOY.

## Can you start now?

**The buildable half of EXECUTE — yes, now, on synthetic data** (finish the IMPLEMENT DoD tail: E2E/a11y/Lighthouse in CI, first-run corridor, free-audit report, landing; plus real-data scaffolding B5–B8 and typed DEPLOY swaps). **The headline** (recovered-SAR on a real clinic) is human-gated — see `docs/blocker.md` (needs B1 design-partner data + B2 real codes + B9 SME sign-off).

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
- `packages/fhir` — R4 parse + base-R4 validate (`@medplum/fhirtypes` for types only); `validateAgainstNphiesProfile()` is a creds-gated stub (real IG validation = B6).
- `packages/normalizer` — FHIR pair → canonical rows, denials exploded.
- `packages/db` — **Drizzle** schema + migrations **through `0003`**, **RLS (FORCE + non-superuser `taweed_app` role)**, `withSession` → `withTenant` (auth-derived tenant), `insertNormalizedClaim`.
- `packages/audit` — **BUILT.** Append-only PHI audit log; tenant from the active RLS GUC; PHI-leak guard. Written on every PHI read/write/export.
- `packages/rules-engine` — **BUILT.** `json-rules-engine` scrubber, **15 rules-as-data**, golden-set harness; `ScrubResult` traces every flag to a named rule + the failed field. (`rules` table has a `scope` column for per-payer/tenant versions — wired further in EXECUTE B7.)
- `packages/appeals` — **BUILT.** Deterministic **bilingual EN/AR** appeal letters, document checklist, human-in-the-loop, **never auto-submits**.
- `packages/analytics` — **BUILT.** Rollups over canonical rows: denial rate, at-risk / recovered SAR, Pareto, trend.
- `apps/web` — **BUILT.** Next 15 App Router. Design tokens (`globals.css`) → Tailwind + hand-built shadcn/Radix primitives → EN/AR RTL (`next-intl`, logical properties, `dir` on `<html>`) → light/dark → Auth.js **dev credentials** (gated dev-only; `TODO(ksa-oidc)` swap = B7) → app-level RBAC (owner/finance/rcm/clinician/admin), **server-enforced** in server actions → three-zone shell + persistent dual money indicator with count-up. Five module surfaces: Ingest, Denial Analytics, Scrubber, Appeal Generator, Recovery.
  - Seams: `apps/web/lib/{db,auth,session,rbac,authz,audit,data,appeals-data}.ts`, `lib/actions/*` (server actions), `components/{ui,shell,charts,money,modules}`, `i18n/*`, `messages/{en,ar}.json`.
- `test/synthetic-fhir` — deterministic R4 bundle generator (9 scenarios).
- CI: `.github/workflows/ci.yml` (lint + typecheck + unit + integration w/ Postgres service).

## Must-read before building

- `docs/NEXT_STEP_PROMPT.md` — the **EXECUTE** prompt (local only).
- `docs/blocker.md` — blocker register + a paste-ready unblock prompt per blocker (local only).
- `docs/02_product_build_plan.md` §2/§7/§8 · `docs/03_design_brief.md` (UI system) · `ECC_GUIDE.md` (tooling, at repo root, local only).
- `docs/superpowers/CREATE_review_followups.md` — **now CLOSED** in migration `0003` (auth-derived `tenant_id`, composite same-tenant FKs, money precision). Kept for history (local only).

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
- Scrubber's `ClaimFacts` projection (`apps/web/lib/data.ts`, `claimToFacts`) is **synthetically hash-derived** (`TODO(nphies-creds)`) — **replace with real columns before any real PHI flows in** (hard EXECUTE-entry gate — real-column mapping per `NEXT_STEP_PROMPT.md` §B item 5; needs partner data, blocker `BLK-1`).

## Git workflow & safety

- **The app lives on `main` in this dir** (`~/Desktop/web apps/taweed`) — no active worktree. IMPLEMENT was built in a git worktree on branch `worktree-create-data-pipeline`; that branch is now **merged to `main` (`44e0e13`) and deleted** (local + remote), and the worktree is removed.
- **Backup-branch rule — keep `back-up` exactly one commit behind `main`.** Before any push that advances `main`, snapshot the current (soon-to-be-previous) `main` tip onto `back-up`, so there is always a one-step-behind restore point. `back-up` is currently at `44e0e13` (local + `origin/back-up`).

  ```bash
  git branch -f back-up main        # snapshot the current main tip (the 'old' commit)
  git push -f origin back-up         # mirror the backup to origin
  # ...now commit/merge the new work onto main...
  git push origin main               # main advances; back-up stays one commit behind
  # restore if a push goes bad:
  git reset --hard back-up           # (or inspect first: git checkout back-up)
  ```

- **Isolated feature work** (e.g. EXECUTE): create a fresh worktree + branch (`superpowers:using-git-worktrees`), build, merge to `main`, then delete the worktree + branch. NOTE: gitignored local docs (`docs/NEXT_STEP_PROMPT.md`, `docs/blocker.md`, `design/`, …) do **not** sync between a worktree and `main` — edit them directly in whichever dir you read from.
