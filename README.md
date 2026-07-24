# Taweed

Bilingual (EN/AR RTL) multi-tenant denial-recovery platform for Saudi NPHIES claims.
Monorepo: `apps/web` (Next.js 15 app) + `packages/*` (data pipeline, rules engine,
appeals, analytics, AI) + `test/synthetic-*` (synthetic FHIR/EOB fixtures).

**New engineering partner?** Read `docs/summary.md` first — business context, full
repo/docs minimap. For product/architecture background see `docs/02_product_build_plan.md` and
`docs/03_design_brief.md`. `infra/README.md` covers the (not-yet-runnable)
Terraform deploy skeleton — this file covers day-to-day local dev.

## Quick start — step by step, no coding experience needed

This walks through running the whole app on your own computer, one click/command at a
time. You do **not** need to know how to code. You will use one app (Docker Desktop) and
paste a few commands into a black window (Terminal) — every command is given exactly, just
copy-paste it.

### Step 1 — Install Docker Desktop

1. Go to **https://www.docker.com/products/docker-desktop/** in your browser.
2. Click the download button for your computer (Mac or Windows).
3. Open the file you downloaded and drag/install Docker Desktop like any other app.
4. Open Docker Desktop once (find it in Applications on Mac, or Start menu on Windows).
5. Wait until it says **"Docker Desktop is running"** (a whale icon appears in your
   menu bar/system tray, no longer animated/loading). Leave it open in the background —
   it needs to stay running for the app to work.

### Step 2 — Open a Terminal window

- **Mac**: press `Cmd + Space`, type `Terminal`, press Enter.
- **Windows**: press the Start key, type `PowerShell`, press Enter.

A plain text window opens. This is where you'll paste the commands below.

### Step 3 — Download the project

Copy this whole block, paste it into the Terminal window, press Enter:

```bash
git clone https://github.com/HXSmc/taweed.git
cd taweed
```

If you see a folder listing / no red error text, it worked. (If it says `git: command not
found`, install Git first from **https://git-scm.com/downloads**, then repeat this step.)

### Step 4 — Build and start everything

Paste this next (this step takes a few minutes the first time — it's downloading and
building everything; later runs are much faster):

```bash
docker compose up -d --build
```

When it finishes, you'll see lines ending in "Started" or "Running", and you'll be back at
a normal prompt. That means Postgres (the database) and the app are both running.

### Step 5 — Load the demo data

Paste this (creates two example clinics with realistic sample claims to explore):

```bash
docker compose exec app pnpm --filter @taweed/web seed
```

You should see a line like `[seed] done. tenants=2 claims=1196 denials=520 appeals=416
rules=30`. That's the confirmation it worked.

### Step 6 — Open the app

Open your web browser and go to: **http://localhost:3000/en**

You'll see a login page listing demo accounts by clinic and role (e.g. "owner",
"finance", "rcm"). **Click any one of the buttons** — there is no password, this is a demo
login for exploring the product. You're now inside the app.

### Everyday commands, once it's set up

| What you want to do | Command to paste |
|---|---|
| Stop the app (keep your data) | `docker compose down` |
| Stop the app AND erase all demo data | `docker compose down -v` |
| Start it again later | `docker compose up -d` |
| Start fresh after downloading new code | `docker compose up -d --build` |
| See what the app is doing / find an error | `docker compose logs -f app` |
| Wipe and reload the demo data | repeat Step 5's command |

This is a demo/dev stack (synthetic data, passwordless login) — not a production deployment
recipe. For that, see `infra/README.md` (Terraform skeleton, not yet runnable — creds-gated).

### Testing the AI features (optional, needs an Anthropic API key)

AI features are OFF by default — the steps above give you the full product except the four
AI-assisted extras. To turn them on:

1. In the `taweed` folder you downloaded, open **`docker-compose.yml`** in any text editor
   (on Mac: right-click → Open With → TextEdit; on Windows: right-click → Open with →
   Notepad).
2. Find the `app:` section, then the `environment:` list under it. Near the bottom you'll
   see lines starting with `#` (these are "commented out" / disabled) mentioning
   `ANTHROPIC_API_KEY` and `TAWEED_AI_ENABLED`.
3. Remove the `#` from the start of these lines (the master switch, plus whichever of the
   four feature lines you want to try — you can enable one, some, or all four):
   ```yaml
   ANTHROPIC_API_KEY: "sk-ant-your-real-key-here"
   TAWEED_AI_ENABLED: "true"
   TAWEED_AI_EXPLAIN_ENABLED: "true"
   TAWEED_AI_APPEAL_ENABLED: "true"
   TAWEED_AI_AUTHOR_RULE_ENABLED: "true"
   TAWEED_AI_EXTRACT_EOB_ENABLED: "true"
   ```
4. Replace `sk-ant-your-real-key-here` with a real Anthropic API key (from
   **https://console.anthropic.com/settings/keys** if you don't have one — this is a paid
   API, using it will incur small usage charges on that account).
5. Save the file, then back in Terminal run:
   ```bash
   docker compose up -d
   ```
6. See `docs/review.md` → "Testing the AI features" for exactly where in the app each of
   the four AI features appears and what a correct result looks like.

**Important:** both the master switch (`TAWEED_AI_ENABLED`) AND that specific feature's own
line must be uncommented for a feature to turn on — enabling the master switch alone turns
on nothing.

## Local dev without Docker

## Prerequisites

- Node.js >= 22
- pnpm 11.13 (pinned via `packageManager` in `package.json`)
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
