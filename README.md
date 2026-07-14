# Taweed

Bilingual (EN/AR RTL) multi-tenant denial-recovery platform for Saudi NPHIES claims.
Monorepo: `apps/web` (Next.js 15 app) + `packages/*` (data pipeline, rules engine,
appeals, analytics, AI) + `test/synthetic-*` (synthetic FHIR/EOB fixtures).

For product/architecture background see `docs/02_product_build_plan.md` and
`docs/03_design_brief.md`. `infra/README.md` covers the (not-yet-runnable)
Terraform deploy skeleton — this file covers day-to-day local dev.

## Quick start with Docker (recommended — no Node/pnpm install needed)

Everything (app + Postgres + demo data) runs in containers. Only prerequisite: **Docker
Desktop** (or any Docker + Compose v2 install).

```bash
git clone https://github.com/HXSmc/taweed.git
cd taweed
docker compose up -d --build   # builds the app image, starts Postgres + the app
docker compose exec app pnpm --filter @taweed/web seed   # loads synthetic demo data
```

Open **http://localhost:3000/en** — sign in as one of the seeded demo accounts (shown on
the login page; passwordless, dev-mode auth — see the `TAWEED_ENABLE_DEV_AUTH` note in
`docker-compose.yml`, never used in a real deployment).

- Logs: `docker compose logs -f app`
- Stop: `docker compose down` (add `-v` to also wipe the Postgres data volume)
- Rebuild after pulling new code: `docker compose up -d --build`
- Re-seed (drops + recreates all data): re-run the `seed` command above — safe, it only
  ever targets this stack's own isolated Postgres container (see the
  `TAWEED_ALLOW_DESTRUCTIVE_MIGRATE` comment in `docker-compose.yml` for why that's true
  even though the guard it bypasses exists specifically to prevent this against a real DB).
- AI features stay off by default (`TAWEED_AI_ENABLED` unset) — this quick start doesn't
  need an Anthropic API key. To try them, add `ANTHROPIC_API_KEY` under the `app` service's
  `environment:` in `docker-compose.yml` before `docker compose up`.

This is a demo/dev stack (synthetic data, passwordless login) — not a production deployment
recipe. For that, see `infra/README.md` (Terraform skeleton, not yet runnable — creds-gated).

## Local dev without Docker

## Prerequisites

- Node.js >= 20
- pnpm 9.15 (pinned via `packageManager` in `package.json`)
- Docker (for local Postgres)

## First-time setup

```bash
# 1. Install workspace dependencies
pnpm install

# 2. Start local Postgres (postgres:16, db/user/pass all "taweed", port 5432)
docker compose up -d

# 3. Add secrets apps/web needs
#    apps/web/.env.local (gitignored) — Next.js loads this automatically for
#    `next dev`/`next start`, but plain `tsx`/vitest invocations (e.g. the seed
#    script below) do NOT read it, hence the inline `env DATABASE_URL=...`:
#      ANTHROPIC_API_KEY=sk-ant-...
#      DATABASE_URL=postgres://taweed:taweed@localhost:5432/taweed
#    AUTH_SECRET has a working local default: it falls back to an insecure
#    dev-only secret whenever NODE_ENV=development (see apps/web/lib/auth.ts).

# 4. Apply schema + load synthetic data
#    The seed script itself destructively migrates (drops + recreates the
#    `public` schema, then applies every packages/db/drizzle/*.sql file in
#    order) before seeding — there is no separate "migrate" command.
env DATABASE_URL=postgres://taweed:taweed@localhost:5432/taweed \
  pnpm --filter @taweed/web seed

# 5. Run the app
pnpm --filter @taweed/web dev
```

The app is served at http://localhost:3000.

Re-run step 4's `pnpm --filter @taweed/db db:generate` only after changing
`packages/db/src/schema.ts` — it regenerates the drizzle SQL migration files
under `packages/db/drizzle/`; it does not apply them.

## Tests

```bash
pnpm test       # unit tests (packages/*/test, apps/web/test) — no DB needed
pnpm test:int   # integration tests — needs a live Postgres via DATABASE_URL
```

`pnpm test:int` is **destructive**: each `*.int.test.ts` file drops and
re-migrates the same local Postgres (single-forked so files don't race each
other). If you've been clicking through the app locally, re-seed afterward:

```bash
env DATABASE_URL=postgres://taweed:taweed@localhost:5432/taweed \
  pnpm --filter @taweed/web seed
```

Other checks:

```bash
pnpm lint        # eslint
pnpm typecheck   # root + all packages
pnpm build       # currently an alias for typecheck (no bundling step)
```

Live AI evals (`packages/*/evals/**/*.eval.ts`) hit the real Anthropic API and
are never run by CI or `pnpm test`/`pnpm test:int`. Opt in explicitly:

```bash
env AI_EVALS_LIVE=1 pnpm vitest run --project evals
```
