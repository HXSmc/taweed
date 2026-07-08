# Taweed — Local Testing Guide & Technical Review

> **Who this is for:** the developer taking ownership of Taweed. It has two halves:
>
> 1. **Part 1 — Local Testing Guide** — everything you need to run the whole product on your own machine and click through every feature, including the new AI features. Start here.
> 2. **Part 2 — Technical Review** — a beginner-friendly tour of how the system is built, written for someone fluent in **Python, Java, C#, HTML, and CSS** (not necessarily TypeScript/React/Node). Every unfamiliar concept is mapped back to something you already know.
>
> Written 2026-07-06 against `main` (`2d0e1bb`). Sources: `docs/handoff.md`, `docs/ai-deploy-readiness.md`, `docs/04_agentic_retrofit_plan.md`, and a direct read of the code.

---

## 0. What Taweed is (60-second version)

Taweed is a **medical-claims denial-recovery** web app for Saudi dental/medical clinics. A clinic sends a claim to an insurer; the insurer sometimes **denies** it (won't pay). That denied money is real revenue the clinic is losing. Taweed:

1. **Ingests** claim data (from NPHIES — the Saudi national claims exchange — or a CSV export).
2. **Scrubs** each claim against billing rules to flag what will likely be denied *before* submission.
3. **Analyses** denial patterns (by payer, by branch, by reason).
4. **Generates appeal letters** (bilingual English/Arabic) to fight denials.
5. **Tracks recovery** — how much denied money was actually won back (the headline number).

The product's whole promise is one number: **recovered SAR** (Saudi Riyals). Everything in the UI orbits that number.

It is **bilingual (English + Arabic, full right-to-left)**, **multi-tenant** (many clinics share one deployment but can never see each other's data), and today runs on **synthetic (fake) data** — no real patient data is involved yet.

The newest work (what you're mostly here to test) is a **selective AI layer** on top of the deterministic core:

- **AI-1 — Explain Flag:** plain-language explanation of why a claim was flagged.
- **AI-2 — Appeal Assist:** AI-drafted extra paragraphs for an appeal letter.
- **AI-3 — Rule Authoring:** describe a billing rule in a sentence, AI turns it into a structured rule (human must approve before it goes live).

---
---

# PART 1 — LOCAL TESTING GUIDE

This part is a complete, click-by-click script. If you follow it top to bottom you will have exercised every screen and every new feature.

## 1.1 Prerequisites (what must be installed)

| Tool | Version on this machine | Why |
|------|------------------------|-----|
| **Node.js** | `v20.2.0` | Runs the app and the tests. (Note: this is *below* Next.js 16's floor, which is exactly why the app is pinned to **Next.js 15**. Don't "upgrade Next" to fix an error — see Troubleshooting.) |
| **pnpm** | `9.15.0`, installed at `~/.local/bin/pnpm` | The package manager (like `pip` / Maven / NuGet). It is **not** on the global PATH here, so every command below calls it by its full path `~/.local/bin/pnpm`. |
| **Docker** (with Docker Compose) | Docker CLI at `/usr/local/bin/docker` | Runs the local PostgreSQL database in a container so you don't have to install Postgres directly. |

Quick sanity check — run this in your terminal (fish shell):

```fish
node -v                 # expect v20.2.0
~/.local/bin/pnpm -v    # expect 9.15.0
docker --version        # expect Docker version 2x.x
```

> **Shell note:** your shell is **fish** and the project's own docs use a `env VAR=value <command>` prefix to pass environment variables to commands (because env vars don't always reach the underlying tooling otherwise). The commands below follow that convention. If you use bash/zsh instead, `env VAR=value cmd` works there too.

---

## 1.2 One-time setup (install dependencies)

`node_modules` (the downloaded libraries) are **not** committed to git, so the very first thing to do in a fresh checkout is install them. This is the equivalent of `pip install -r requirements.txt` or `mvn install` or `dotnet restore`.

```fish
cd "$HOME/Desktop/web apps/taweed"
~/.local/bin/pnpm install
```

This reads `pnpm-lock.yaml` (the exact-versions lockfile) and downloads everything for **all** packages in the monorepo at once. It takes a few minutes the first time. When it finishes with no red errors, you're set. You only repeat this if `package.json`/the lockfile changes.

---

## 1.3 The two tiers of testing

There are two independent ways to "test" this product. Do both.

| Tier | What it proves | Needs a database? | Section |
|------|----------------|-------------------|---------|
| **A. Automated checks** | Types are consistent, lint is clean, unit + integration tests pass | Unit: no. Integration: yes (Postgres) | §1.11 |
| **B. The live app** | The real product works when a human clicks through it | Yes (Postgres + seed data) | §1.4 – §1.10 |

Tier B (clicking through the real app) is what most of this guide covers, because that's how you actually *feel* the product and verify the new AI features. Start the database first.

---

## 1.4 Start the database (Docker)

The app stores everything in **PostgreSQL 16**. Instead of installing Postgres on your Mac, one command spins it up inside a container.

From the project root:

```fish
cd "$HOME/Desktop/web apps/taweed"
docker compose up -d
```

What this does (see `docker-compose.yml`):

- Starts a `postgres:16` container.
- Creates a database named `taweed`, user `taweed`, password `taweed`.
- Exposes it on **`localhost:5432`** (the standard Postgres port).
- Has a health-check so it reports "healthy" once it's ready to accept connections.

**Verify it's up:**

```fish
docker compose ps
```

You should see the `postgres` service with state `running`/`healthy`.

> **Known host quirk (from the project notes):** on this specific machine, some Docker CLI *metadata* commands (`docker info`, `docker version`, `docker exec`) can hang, but the database container and port work fine. If `docker compose ps` hangs, don't panic — instead just check the port is open:
>
> ```fish
> nc -z localhost 5432; and echo "postgres port open"
> ```

The connection string the app and tools use (with defaults built in, so you rarely type it):

```
postgres://taweed:taweed@localhost:5432/taweed
```

---

## 1.5 Seed synthetic data

An empty database renders empty screens. The **seed** script destructively rebuilds the schema and loads realistic fake data — two clinics, their branches/doctors/payers/patients, hundreds of claims (some accepted, some denied), appeals in various states, the scrubber rule library, and demo user accounts.

```fish
cd "$HOME/Desktop/web apps/taweed"
env DATABASE_URL=postgres://taweed:taweed@localhost:5432/taweed \
    ~/.local/bin/pnpm --filter @taweed/web seed
```

**Expected output** (numbers vary slightly with the scenario mix):

```
[seed] migrating (destructive, local only)...
[seed] Al Salama Dental Group: <N> claims, <M> denials, <K> appeals
[seed] Noor Polyclinic: <N> claims, <M> denials, <K> appeals
[seed] done. tenants=2 claims=... denials=... appeals=... rules=...
```

Important things to know about the seed:

- It is **destructive** — it drops and recreates the schema every run. That's fine locally; never point it at anything real.
- It creates **two tenants (clinics):** *Al Salama Dental Group* and *Noor Polyclinic*.
- Tenant IDs are **fixed** (hard-coded UUIDs) so re-seeding doesn't invalidate a login session you already have open.
- It sets up the security model exactly like production: tenant rows are inserted by a superuser connection, but every tenant-scoped row is written through the restricted `taweed_app` role so **Row-Level Security** (tenant isolation) is exercised, not bypassed.

Re-run the seed any time you want a clean slate (e.g., after integration tests, which also wipe the DB — see §1.11).

---

## 1.6 Start the web app

The web app is a **Next.js 15** application. Start its dev server:

```fish
cd "$HOME/Desktop/web apps/taweed"
~/.local/bin/pnpm --filter @taweed/web dev
```

- It boots on **http://localhost:3000**.
- The database connection defaults to the local Postgres above, so if you seeded, there's nothing else to configure for the **base** product. (AI features need extra env vars — see §1.10.)
- Leave this terminal running; it hot-reloads on code changes.

Open **http://localhost:3000** in your browser. Because Arabic is the default locale, the URL will redirect to **`/ar`**. You'll land on the **marketing landing page** (the logged-out home).

> If you'd rather start in English, go straight to **http://localhost:3000/en**.

---

## 1.7 Log in (click-by-click)

Authentication here is a **dev-only, passwordless demo picker** (a real Saudi-resident OIDC provider is a planned swap; this stand-in exercises the whole login → tenant → data-isolation chain). You never type a password.

**Steps:**

1. From the landing page, click **Sign in** (top of the page), or go directly to **http://localhost:3000/en/login**.
2. You'll see a card titled roughly *"Choose an account"* listing the seeded demo users. Each row shows the **clinic name**, an **email**, and a **role badge** (owner / finance / rcm / clinician / admin).
3. **Click a row to sign in as that user.** No password.

**Which account to pick — this matters, because the role changes what you can see:**

| Role | Sees these modules | Best for testing… | Default language |
|------|--------------------|-------------------|------------------|
| **rcm** | **All 7** (Overview, Analytics, Ingest, Scrubber, Appeals, Recovery, Settings) + can author rules | **The full walkthrough — use this one first** | English |
| **owner** | Overview, Analytics, Scrubber (read), Appeals (approve), Recovery, Settings — **no Ingest** | Arabic/RTL experience, the owner dashboard | **Arabic (RTL)** |
| **admin** | All except it can't upload in some flows; can author rules | Admin/audit view | English |
| **finance** | Overview, Analytics, Ingest (upload), Scrubber (read), Appeals (review), Recovery, Settings (limited — **no rule authoring**) | Finance-scoped permissions | English |
| **clinician** | Overview (read), Analytics (read), Scrubber (flag-only), Appeals (evidence) — **no Ingest/Recovery/Settings** | Most-restricted role | English |

For the demo accounts, the emails follow the pattern `<role>@<clinic-slug>.dev`, e.g.:

- `rcm@al-salama-dental-gro.dev` (recommended for the full test)
- `owner@al-salama-dental-gro.dev` (Arabic UI)
- `rcm@noor-polyclinic.dev` (the *other* clinic — use it to prove tenant isolation, §1.8 step 9)

> **Tip:** because the **owner** account defaults to Arabic, clicking it is the fastest way to see the full right-to-left interface. Clicking any other role gives you English.

**Recommended for the first pass: sign in as `rcm` at Al Salama Dental Group.** It can see and do everything.

---

## 1.8 Full product walkthrough (click-by-click)

Sign in as **rcm @ Al Salama Dental Group**. You'll be redirected to the **Analytics** page (rcm's landing module; owners land on Overview instead).

The persistent layout you'll see on every page:

- **Left rail** (vertical nav) — the module icons. On a narrow window it's icons-only; widen past ~1024px to see labels. In Arabic it flips to the right side.
- **Top command bar** — clinic/branch switcher, a search box, and on the inline-end side: a **persistent money indicator** (recovered vs at-risk — only visible at ≥1024px width), a data-residency badge, the **language toggle (EN/AR)**, the **theme toggle (light/dark)**, your role chip, and an account menu.

Now walk each module.

### Step 1 — Overview
Click **Overview** in the left rail.

- The big emerald number is **Recovered SAR** — the product's hero metric.
- To its side: **At-risk SAR** (money still recoverable), **Win rate**, **Median days to recovery**.
- Below: two "forward" cards — *Run scrubber* and *Build report* — that link deeper.
- **What to verify:** the big number renders large (not tiny). A past bug rendered hero numbers at 14px; it's fixed, so this is a good visual regression check.

### Step 2 — Denial Analytics
Click **Analytics**.

- Top strip: the **denial rate** as a huge red percentage, plus **at-risk SAR**.
- Charts: a **trend line** (denials over ~6 months), a **Pareto** chart (denials by reason, ranked), **by payer** ranked bars, **by branch** ranked bars.
- **What to verify:** charts actually render (they use hard-coded HEX colors deliberately — CSS variables don't work inside SVG). Hover a bar/point; numbers should be sensible.

### Step 3 — Ingest (data intake)
Click **Ingest**. (Only visible to rcm/finance/admin — that's why we're using rcm.)

- Left: a **drag-and-drop zone** for a claim file. Right: a **run ledger** with stage checkmarks (received → parsing → validating → ready) and three counters: **claims created, denials detected, quarantined**.
- **To test it end-to-end:**
  1. Click **Download sample file** (the secondary button). This downloads `taweed-sample-bundle.json` — a synthetic NPHIES claim bundle.
  2. Click **Process** (or drag the downloaded file onto the dropzone).
  3. Watch the ledger stages tick green and the counters count up.
  4. If any rows are malformed, a **Quarantine** table appears at the bottom listing each bad row with a **reason** — the app never silently drops bad data.
- **What to verify:** counters animate, and a summary line appears ("*N claims, M denials, at-risk SAR …*").

### Step 4 — Scrubber (+ AI-1: Explain Flag)
Click **Scrubber**.

- A table of claims, each with a **risk score** (0–100, colored bar), the top flag message, claim id, patient pseudonym, payer, codes, and amount.
- **Click any row** (or focus it and press Enter/Space) to open a **detail panel** (slides in from the side).
- In the panel, each **flag** shows its rule name, severity, the human message, the **field** that failed, and the **rule id**.
- **AI-1 lives here:** under each flag is a small **"Explain" button with a ✨ sparkle icon**.
  - With AI **off** (the default — see §1.10): clicking it shows a muted *"explanation unavailable"* note. This is the intended graceful-degradation behavior — **not** a bug.
  - With AI **on**: clicking it fetches a bilingual plain-language explanation + a suggested fix, shown inline. Click again to collapse. (It's cached, so a second click on the same flag is instant and doesn't re-call the model.)
- **What to verify (AI off):** deterministic messages always show; Explain degrades gracefully. **(AI on):** you get a real explanation in the current language; toggle to Arabic and it's in Arabic.

### Step 5 — Appeals (+ AI-2: Appeal Assist)
Click **Appeals**.

- Left: a **queue** of denials sorted by SAR at stake (payer, reason, deadline in days).
- **Click a denial** in the queue. The right side loads a **draft appeal letter** — a complete, deterministic, editable letter (the SAR being appealed is shown prominently at the top).
- **Language toggle (English / العربية):** each language keeps its *own* editable copy — switching never loses your edits. The letters are natively generated per language, not machine-translated.
- **AI-2 lives here:** the dashed **"AI suggestions"** panel with a **"Suggest" ✨ button**.
  - AI **off:** the panel shows an *"unavailable"* note; the deterministic letter still stands alone.
  - AI **on:** click **Suggest** → you get one or more clearly-labelled **DRAFT** paragraphs. Each is editable. Click **Insert** to append one into the letter body; click **Discard** to dismiss. (The system measures how much you edited a suggestion — a quality metric.)
- **Export gate (human-in-the-loop):** at the bottom, you must (a) type a reviewer **name** and (b) tick **"I reviewed this"** before the **Export** button enables. Taweed **never auto-submits** an appeal.
  - Click **Export** → an HTML letter downloads. A compliance record of the export is written *before* the file is handed over.
- **What to verify:** the export button stays disabled until name + checkbox are set; the exported letter opens correctly; Arabic exports are right-to-left.

### Step 6 — Recovery
Click **Recovery**.

- Top ROI band: **Recovered SAR** (emerald hero), **win rate**, **median days**, and the share recovered.
- Below: the appeal **pipeline grouped by stage** (submitted / under review / won / lost), each stage rolling up its appealed and recovered SAR.
- For any non-terminal appeal, you get **Mark won / Mark lost** buttons. Click **Mark won** → the page refreshes and the recovered totals update. This is how the headline number grows.
- **What to verify:** marking an appeal won moves it to the "won" group and increases Recovered SAR consistently.

### Step 7 — Settings (Rules, AI-3 Authoring, Audit, Residency)
Click **Settings**. You'll see tabs.

- **Rules tab:** the active scrubber rule library (message, severity, scope, version).
- **Author tab (AI-3 — only for rcm/owner/admin):** this is the new rule-authoring surface.
  1. Type a billing rule in plain English or Arabic, e.g. *"Flag claims where the tooth surface code is missing on a restorative procedure."*
  2. Choose **scope**: *Global* or *Payer* (pick a payer if payer-scoped).
  3. Click **Draft** (✨).
     - AI **off:** you get a *"manual authoring"* note; nothing breaks.
     - AI **on:** the model proposes a structured rule, which is then run through a **deterministic gate** (shape check → engine dry-run → golden-set regression). You'll see either **"Gate passed"** (green shield) or **"Blocked at stage X"** (red) with the specific errors, plus a readable view of the rule's conditions.
  4. If the gate passed, click **Approve** (or **Reject**). Nothing goes live until a human clicks Approve — approved rules are server-enforced by role, not just UI.
  - The **authored-rule library** below lists drafts/approved/rejected rules; drafts can be approved/rejected from there too.
- **Audit tab:** the append-only access log — actor, action, entity, timestamp. Every PHI read/write/export appears here.
- **Residency tab:** a data-residency statement (KSA hosting posture) and the Arabic-Indic digit-law note.

### Step 8 — Language + theme (do this on any page)
- Click the **EN/AR toggle** in the top bar. The **entire layout mirrors** to right-to-left, Arabic text renders, and numbers follow the digit law. This is a core requirement — check a few pages in Arabic.
- Click the **theme toggle** (sun/moon). Verify **both light and dark** look intentional (no unreadable contrast, hero numbers still colored correctly).

### Step 9 — Prove tenant isolation (the security money-shot)
1. Note some claim ids / numbers as **rcm @ Al Salama Dental Group**.
2. Sign out (account menu, top-right).
3. Sign in as **rcm @ Noor Polyclinic**.
4. **Verify you see completely different data** — none of Al Salama's claims. This proves Row-Level Security is doing its job: one deployment, many clinics, zero cross-tenant leakage.

That completes a full functional pass.

---

## 1.9 What "good" looks like (a quick checklist)

- [ ] Landing page loads at `/ar` (and `/en`) logged-out.
- [ ] Login picker signs you in with one click; owner → Arabic, others → English.
- [ ] All 7 modules load for rcm; restricted roles see fewer.
- [ ] Overview/Analytics/Recovery hero numbers render **large** and correctly colored.
- [ ] Ingest processes the sample bundle; quarantine explains any bad rows.
- [ ] Scrubber rows open a detail panel; Explain degrades gracefully (AI off) or explains (AI on).
- [ ] Appeals: draft loads, export gate enforces review, letter downloads.
- [ ] Recovery: mark-won updates totals.
- [ ] Settings: rule authoring gate passes/blocks; approve makes a rule live.
- [ ] EN↔AR mirrors the whole UI; light↔dark both look right.
- [ ] Signing into the second clinic shows different data (isolation).

---

## 1.10 Testing the NEW AI features (enabling AI locally)

By **default, AI is OFF** — deliberately. This is a "fail-closed" safety design: unless you explicitly turn it on, every AI surface shows a graceful "unavailable" message and the deterministic product works unchanged. **Testing the AI-off behavior is itself a test** (do it first — it's the default).

To turn AI **on** locally you need **three** things to line up (defense in depth):

1. **The global switch** — must be the *exact* string `true`.
2. **The per-feature switch** — each AI feature has its own flag.
3. **An Anthropic API key** — the real model provider.

(There's also a fourth layer — a per-tenant database flag — but it **defaults to ON** when no row exists, so locally you can ignore it. It exists to switch a single clinic off in production.)

**Easiest way: create `apps/web/.env.local`** (Next.js loads it automatically for the dev server). Put:

```bash
# Master switch — must be exactly "true"
TAWEED_AI_ENABLED=true

# Per-feature switches (turn on the ones you want to test)
TAWEED_AI_EXPLAIN_ENABLED=true       # AI-1 Explain Flag (Scrubber)
TAWEED_AI_APPEAL_ENABLED=true        # AI-2 Appeal Assist (Appeals)
TAWEED_AI_AUTHOR_RULE_ENABLED=true   # AI-3 Rule Authoring (Settings → Author)

# Your Anthropic API key (real network calls will be made & billed)
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Then **restart the dev server** (`Ctrl-C`, then `pnpm --filter @taweed/web dev` again) so it picks up the new env file.

> **If you don't have an API key:** you can't exercise the *live* AI path, but you can and should test the **AI-off** path (the default) — the graceful "unavailable" behavior — and the **automated tests** exercise the AI code with a fake/fixture provider (no key, no network). See §1.11.

**Now re-run the three AI walkthroughs with AI on:**

- **AI-1 (Explain):** Scrubber → open a flagged row → click **Explain**. You should get a real bilingual explanation + suggested fix (§1.8 Step 4).
- **AI-2 (Appeal Assist):** Appeals → pick a denial → **Suggest** → edit/insert a DRAFT paragraph (§1.8 Step 5).
- **AI-3 (Rule Authoring):** Settings → Author tab → type a rule → **Draft** → watch the gate verdict → **Approve** (§1.8 Step 7).

**Three states you should be able to tell apart** (this is a designed behavior, worth verifying):

| State | How to produce it | Expected UI |
|-------|-------------------|-------------|
| **Off** | No env vars (default) | Muted "unavailable" / "manual authoring" note; deterministic product unaffected |
| **On & working** | All 3 layers + valid key | Real AI output appears |
| **On but misconfigured** | Feature flag `true` but **no/blank `ANTHROPIC_API_KEY`** | Fails **loudly** with a distinct "misconfigured" message — *not* silently collapsed into the same "unavailable" as off |

That last row is important: the system deliberately distinguishes "AI is intentionally off" from "AI is on but broken," so an ops person can tell a deliberate switch from an outage.

**Audit note:** every AI call — success, parse failure, or provider error — writes a row to the `llm_calls` table. It stores **only hashes** of the prompt/output, never the raw text or any PHI. You can see AI activity reflected via the compliance trail; the raw content is intentionally never persisted.

---

## 1.11 Running the automated test suites

These don't need the browser. Run from the project root.

**Type check** (like a compiler pass — proves the TypeScript types are consistent across all packages):

```fish
~/.local/bin/pnpm typecheck
```

**Lint** (style/quality rules; `apps/web` is now fully lint-enforced including React-hooks and accessibility rules):

```fish
~/.local/bin/pnpm lint
```

**Unit tests** (fast, no database — pure logic, utilities, the AI code via a *fixture* provider so no API key/network is used):

```fish
~/.local/bin/pnpm test
```

Expected: all unit tests green (the project baseline is ~340 unit tests passing).

**Integration tests** (need Postgres running; these are **destructive** — they migrate and wipe the shared local database):

```fish
env DATABASE_URL=postgres://taweed:taweed@localhost:5432/taweed \
    ~/.local/bin/pnpm test:int
```

Expected: all integration tests green (baseline ~33 passing). They verify real database behavior: migrations apply cleanly, Row-Level Security actually blocks cross-tenant reads, the audit/`llm_calls` tables are append-only *by database privilege* (not just by convention), and the money math reconciles.

> **After running integration tests, re-seed** (§1.5) before using the live app again — the integration run leaves the database wiped.

**Full build check** (the root `build` script is just the type check; to run the real Next.js production build):

```fish
~/.local/bin/pnpm --filter @taweed/web build
```

**End-to-end (Playwright) tests:** these live in `apps/web/tests/e2e` and run in **CI** (GitHub Actions) against a seeded database, including accessibility checks. They **cannot run locally on this machine** because the pinned Playwright can't load its config under Node 20.2.0 (CI uses a newer Node 20.x). Treat CI as the source of truth for E2E; locally, the manual click-through (§1.8) is your E2E.

---

## 1.12 Tearing down / resetting

- **Stop the app:** `Ctrl-C` in its terminal.
- **Stop the database (keep data):** `docker compose stop`
- **Stop and delete the database container + data:** `docker compose down`  (next `up -d` starts fresh; you'll need to re-seed)
- **Reset just the data:** re-run the seed (§1.5) — it rebuilds the schema from scratch.
- **If disk fills up** from Next's build cache: `rm -rf apps/web/.next`

---

## 1.13 Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| App shows **no data / empty tables** | Not seeded, or you logged into a tenant whose session id no longer matches | Re-run the seed (§1.5); tenant ids are fixed so a re-seed keeps your session valid |
| **"Cannot connect to database"** | Postgres container not running | `docker compose up -d`; check port with `nc -z localhost 5432` |
| `docker info`/`ps`/`exec` **hangs** | Known Docker CLI metadata quirk on this host | Ignore those subcommands; the container still works — probe the port directly |
| **Explain / Suggest says "unavailable"** | AI is off (the default) | That's correct behavior. To enable, set the env vars in §1.10 and restart the dev server |
| AI enabled but errors **loudly** ("misconfigured") | `ANTHROPIC_API_KEY` missing/blank while a feature flag is `true` | Add a valid key to `apps/web/.env.local`, restart |
| Tempted to **upgrade Next.js** to fix an error | Node here is 20.2.0, below Next 16's floor | **Don't.** The app is intentionally pinned to Next 15. Fix the actual error instead |
| **Playwright/E2E won't run locally** | Playwright can't load config under Node 20.2.0 | Expected; rely on CI for E2E, manual click-through locally |
| Test output looks **truncated/summarized** when *Claude* runs it | The RTK tooling hook compresses stdout | Only affects the AI assistant, not your own terminal; if needed, write results to a file with `--reporter=json --outputFile <path>` |
| **Integration tests left the DB empty** | They're destructive by design | Re-seed (§1.5) |
| Seeing an **Arabic RTL** UI unexpectedly | You signed in as the **owner** (defaults to Arabic) | Use the EN/AR toggle, or sign in as rcm/finance for English |

---
---

# PART 2 — TECHNICAL REVIEW

Written for a developer fluent in **Python, Java, C#, HTML, and CSS**. TypeScript, React, and Node are close cousins of what you already know — this section leans on that. Wherever a concept might be unfamiliar, there's a "**≈ in your world**" analogy.

## 2.0 How to read this section

The single biggest mental shift: this is a **TypeScript** codebase running on **Node.js**, using **React/Next.js** for the UI.

- **TypeScript ≈ Java/C# with structural typing.** It's JavaScript plus a type system. Types are checked at *compile time* and then **erased** — at runtime it's plain JavaScript with no types (like Java generics' erasure, but for *everything*). You'll see `interface`, generics `<T>`, and `x: string` annotations that read almost exactly like Java/C#.
- **Node.js ≈ the JVM/.NET runtime**, but single-threaded with an event loop. Instead of threads you use `async`/`await` (which works just like C#'s `async`/`await` — same keywords, same idea).
- **React ≈ a declarative UI framework** (closest thing you know: think of building HTML from server-side templates, but the "template" is a function that returns markup, and it re-runs when data changes). A **component** is a function that returns HTML-like markup (JSX).
- **pnpm ≈ pip/Maven/NuGet**, and `package.json` ≈ `requirements.txt`/`pom.xml`/`.csproj`.
- **A "monorepo" ≈ one Maven multi-module / .NET solution** with many projects in one git repository that depend on each other.

Keep those five mappings in mind and the rest follows.

## 2.1 The big picture — one repo, many packages

Taweed is a **pnpm monorepo**: one repository containing ~12 internal packages plus one web app, all wired together. Think of it as **one .NET solution with 12 class libraries and 1 web project**, or **one Maven parent POM with 12 modules**.

```
taweed/
├── packages/            ← the "class libraries" (pure logic, no UI)
│   ├── shared           ← common types + constants (≈ a Core/Common library)
│   ├── fhir             ← parse & validate NPHIES/FHIR claim documents
│   ├── normalizer       ← turn a raw claim into tidy database rows
│   ├── db               ← database schema, migrations, connection, security
│   ├── audit            ← append-only access log (compliance)
│   ├── rules-engine     ← the "scrubber": rules-as-data that flag claims
│   ├── appeals          ← generate bilingual appeal letters
│   ├── analytics        ← roll up numbers (denial rate, recovered SAR…)
│   ├── ingest           ← read CSV/TSV real-world exports
│   ├── ai               ← the ONLY package that talks to an LLM
│   ├── platform         ← swappable infra (object store, KMS, OIDC)
│   └── (test/synthetic-fhir) ← generates fake claims for dev/tests
├── apps/
│   └── web              ← the Next.js UI (the "web project")
├── infra/               ← Terraform (cloud infra as code) — skeleton, not applied
└── scripts/seed.ts      ← loads fake data into a local DB
```

**Why so many small packages?** Same reason you'd split a big C#/Java solution into libraries: clear boundaries, each testable in isolation, and — critically here — **only one package (`ai`) is allowed to talk to the outside LLM**, so all the safety controls live in one auditable place. The house coding rules explicitly favor "many small files/modules over few large ones."

**The dependency direction is one-way:** the UI (`apps/web`) depends on the packages; the packages don't depend on the UI. Pure logic at the bottom, UI at the top. (≈ your domain/business libraries never referencing the web project.)

## 2.2 The tech stack, decoded

| Technology | What it is | ≈ In your world |
|------------|-----------|-----------------|
| **TypeScript** | Typed JavaScript | Java/C# type system bolted onto a dynamic language; types erased at runtime |
| **Node.js** | JS runtime | The JVM/.NET CLR, but single-threaded + event loop |
| **React** | UI library — components are functions returning markup | Declarative templating; UI = f(state) |
| **Next.js 15** | Full framework on top of React (routing, server rendering, server actions) | ≈ ASP.NET/Spring MVC, but the same language runs on server *and* browser |
| **JSX/TSX** | HTML-like syntax inside TypeScript | Razor (`.cshtml`) or JSP — markup embedded in code |
| **PostgreSQL 16** | The database | Same Postgres you may know from Python/Java |
| **Drizzle ORM** | Type-safe query builder + migrations | ≈ Entity Framework / JPA-Hibernate / SQLAlchemy, but thinner and closer to SQL |
| **Tailwind CSS** | Utility CSS classes in the markup | CSS, but you compose tiny classes (`p-4 flex gap-2`) instead of writing rule blocks |
| **Radix UI** | Unstyled accessible UI primitives (dialogs, tabs…) | A component toolkit that handles keyboard/focus/ARIA for you |
| **next-intl** | Internationalization (EN/AR) | ≈ resource bundles / `.resx` files, plus locale routing |
| **Auth.js (NextAuth)** | Authentication | ≈ ASP.NET Identity / Spring Security's auth layer |
| **Zod** | Runtime schema validation | ≈ Bean Validation / FluentValidation / Pydantic — validates data at runtime *and* infers the TypeScript type from the schema |
| **Vitest** | Test runner | ≈ JUnit / xUnit / pytest |
| **Playwright** | Browser automation for E2E tests | ≈ Selenium, modern |
| **Recharts** | Charting library | A charts component library |
| **Anthropic SDK** | Client for Claude (the LLM) | An HTTP API client for an AI model |

**Zod deserves a second look** because it's used everywhere and has no direct equivalent in older Java/C#. You define a schema once:

```ts
const userSchema = z.object({ email: z.string().email(), age: z.number().int() });
type UserInput = z.infer<typeof userSchema>;   // the TYPE is derived from the schema
const validated = userSchema.parse(input);      // throws if invalid — like Pydantic
```

It's Pydantic-for-TypeScript: one definition gives you both runtime validation *and* the static type. The AI features use it to force the model's output into a known shape.

## 2.3 How a request flows (the mental model)

When you click something in Taweed, here's the path — compare it to an MVC request in Spring/ASP.NET:

1. **Browser → Next.js route.** URLs look like `/en/scrubber`. The `/[locale]` folder means "locale is a URL segment" (≈ a route parameter). Middleware (`middleware.ts`) handles locale routing only.
2. **The page is a Server Component.** This is the key Next.js idea: **most components run on the *server*** (like a Razor page rendering on the server), fetch their data directly, and send finished HTML to the browser. Only components that need interactivity (buttons, state) are marked `"use client"` and also run in the browser.
   - ≈ Think server-side rendering by default, with islands of client-side interactivity.
3. **Auth + tenant resolution.** The authenticated layout calls `requireSession()`. If there's no valid session it redirects to `/login`. If there is, it extracts the **`tenantId` from the verified session token** — never from anything the client sent.
4. **Data access through a security seam.** All tenant data goes through `withSession(tenantId, db => …)` which:
   - Uses a **restricted database role** (`taweed_app`) that *cannot* bypass row security.
   - Sets the current tenant in a Postgres session variable so **Row-Level Security** filters every query automatically (more in §2.5).
5. **Render.** The server component renders markup with the data and streams HTML to the browser. Interactive bits hydrate client-side.
6. **Mutations use "Server Actions."** When you submit a form or click "Mark won," it calls a `"use server"` function — a server-side function you can call directly from the client, no manual REST endpoint. ≈ a controller action, but you don't hand-write the HTTP plumbing. Every one of these **re-checks auth and role on the server** (the UI gate is not trusted).

The one-sentence takeaway: **the server owns security and data; the browser only renders and collects input.**

## 2.4 The data model & multi-tenancy — the crown jewel

This is the most important thing to understand about Taweed, and it's genuinely well done.

**The problem:** one deployment serves many clinics ("tenants"). Clinic A must *never* see Clinic B's patient data. In healthcare this isn't a nice-to-have; it's the whole ballgame.

**The naive approach** (adding `WHERE tenant_id = ?` to every query) is fragile — one forgotten `WHERE` clause leaks data. Taweed instead uses **PostgreSQL Row-Level Security (RLS)**, enforced by the *database itself*:

- Every tenant table has an RLS **policy**: a row is only visible/writable if its `tenant_id` matches the tenant set in the current database session variable.
- The app connects as a **non-superuser role (`taweed_app`)** that is subject to RLS (superusers bypass it — so the app never uses one for tenant data). This is proven, not assumed: an integration test signs in and confirms cross-tenant reads return **zero rows**.
- The `tenant_id` is set from the **verified session**, via `withTenant(...)`, and can never be supplied by the client.
- Migration `0003` even added **composite same-tenant foreign keys**, so you can't attach a child row (e.g., a claim line) to a parent from another tenant — closing a subtle hole where a foreign key could sidestep RLS.

≈ In your world: imagine if instead of trusting every developer to add `WHERE tenant_id = @id`, the *database* refused to return other tenants' rows no matter what SQL you ran. That's RLS. It's the difference between "we remember to filter" and "the database physically can't leak."

**The ORM is Drizzle.** ≈ Entity Framework/JPA, but deliberately thin and close to raw SQL. The schema is defined in TypeScript; migrations are plain `.sql` files in `packages/db/drizzle/` applied in order (`0000` … `0007`). Money is stored with integer precision (halalas — Saudi cents) to avoid floating-point drift, with database CHECK constraints for plausibility. A missing required amount is **quarantined at ingest**, not silently turned into `0.00`.

**Append-only compliance tables.** Two tables — `audit_logs` (every PHI access) and `llm_calls` (every AI call) — are **append-only enforced by database privilege**: the app role is `GRANT`ed INSERT/SELECT but explicitly `REVOKE`d UPDATE/DELETE. So the compliance trail can't be tampered with even by buggy app code. (An integration test confirms UPDATE/DELETE are rejected with a permissions error.)

## 2.5 The money path — "the moat"

The product's entire value is the **recovered SAR** number, so its correctness is treated as sacred. There's a subtle bit worth understanding because the team spent real effort on it:

- **At-risk SAR** = denied money not yet recovered. **Recovered SAR** = money actually won back.
- The tricky case is a **partial win**: a claim denied for 100 SAR where an appeal recovers only 60. The naive query counted the denial as "resolved" (a won appeal exists) and only credited 60 as recovered — so the unrecovered **40 SAR vanished** from *both* buckets, understating the money at stake.
- This was found, escalated as a semantics question (is the remaining 40 still at-risk, or a write-off?), decided from the product design docs (it's still at-risk), and **fixed** so `at_risk + recovered = total denied` always reconciles. The fix: at-risk sums `GREATEST(denied − recovered, 0)` per denial. There's a dedicated test proving it (denied 1000 / recovered 600 → at-risk 400).
- A separate guardrail (`resolveRecovery`) ensures recovered can never exceed the amount appealed or go negative — protecting the ROI integrity the pricing depends on.

≈ In your world: it's the classic "money must reconcile to the cent, and every edge case is a test" discipline you'd apply to any billing/ledger code. They applied it here.

## 2.6 The AI layer — how it's kept safe

The new AI work is architecturally the most interesting part, and the safety design is the point. Everything lives in **one package, `@taweed/ai`**, which is the *only* code allowed to call the LLM. The raw provider client is **never exported**, so no other code can make an un-audited AI call.

Five safety properties, each of which you can verify by testing:

1. **Fail-closed kill switches (three layers).** Global env switch (must be exactly `"true"`) **AND** a per-feature switch **AND** a per-tenant database flag. Turning AI on globally does *not* silently enable every feature. Default = off → the app falls back to deterministic behavior via a typed `AiDisabledError`. (§1.10 shows this in action.)
2. **PHI-free by construction.** The inputs sent to the model are built from **rule metadata and generic templates**, not patient data. Where an identifier is needed (e.g., a member id in an appeal), it's **pseudonymized** (tokenized) before the call and **de-tokenized after**. Date of birth becomes an age band. Free text is excluded. A runtime guard rejects any unexpected field.
3. **Audited on every attempt.** Every call — success, schema-parse failure, or network/timeout error — writes an `llm_calls` row. It stores **only SHA-256 hashes** of prompt and output, never the raw text. The audit write is fail-closed: if a successful, billable call *can't* be audited, the answer is **discarded** rather than served un-audited (and it logs loudly so ops can tell an audit-DB outage from a deliberate off-switch).
4. **No connection held across the network call.** The LLM call happens *outside* any database transaction; each DB step opens its own short transaction. So a slow/hung AI request can't hold a Postgres connection and starve other tenants (a real availability/DoS concern that was caught in review and fixed).
5. **Structured, validated output.** The model is forced to return JSON matching a Zod schema (bilingual explanation, appeal paragraphs, or a structured rule). If it doesn't validate, the call fails rather than passing malformed data downstream.

The three features, and their guardrails:

- **AI-1 Explain (Haiku model):** cheapest model; output is a bilingual explanation cached per (tenant, rule, version) so you don't pay twice. The web action re-derives the prompt server-side from the rule library — no client text reaches the model. It's also rate-limited per actor.
- **AI-2 Appeal Assist (Opus + a Sonnet "judge"):** produces suggested paragraphs, then a second model pass verifies them. **Anti-hallucination is structural:** the draft uses digit-free slot tokens, so *any literal digit the model invents is treated as a hallucination and suppressed*. The member id is pseudonymized and de-tokenized last. Suggestions are clearly labelled DRAFT; a human must insert/edit them; edit-distance is tracked as a quality metric.
- **AI-3 Rule Authoring (Opus):** a sentence → a structured `ScrubRule` **draft**, which must pass a **deterministic gate** (shape vs registry → engine dry-run → golden-set regression) before it can even be approved. It's persisted **DISABLED** and only a human with the right role can approve it (server-enforced). Nothing the AI writes executes automatically.

≈ In your world: treat the LLM like an **untrusted external service that costs money and can lie**. Every call is gated, validated at the boundary (Zod), logged for audit, isolated from your DB connections, and its output is powerless until a human or a deterministic check approves it. That's exactly the posture here.

## 2.7 Internationalization & the UI system

- **Bilingual EN/AR with real RTL.** Locale is always in the URL (`/en/…`, `/ar/…`). The layout uses **CSS logical properties** (`inline-start` instead of `left`) so the *entire* interface mirrors from a single `dir="rtl"` flip — the nav rail moves to the right, arrows flip, etc. ≈ Like writing CSS that's direction-agnostic so one switch handles both.
- **Arabic default for owners.** New owner accounts default to Arabic (a deliberate market choice).
- **A "digit law":** Arabic surfaces convert to the correct digit rendering, strip certain control characters, and isolate the Arabic wordmark. This is handled in a dedicated post-processing step.
- **Design system:** CSS custom properties (design tokens) → Tailwind utility classes → hand-built accessible primitives on top of Radix. One accent color (cobalt `#2557E4`), money-semantic colors (emerald = recovered, red = at-risk), hairline borders over heavy cards, WCAG AA contrast, and reduced-motion support. Charts pass **HEX** colors to Recharts because CSS variables don't resolve inside SVG attributes — a real gotcha the team documented.

## 2.8 Security posture (summary)

Strong, and clearly a priority:

- **Tenant isolation by RLS** at the database level, proven by tests (§2.4).
- **Auth-derived tenant/role**, never client-supplied; **RBAC re-enforced in every server action**, not just hidden in the UI.
- **Append-only audit trails** enforced by DB privilege.
- **AI layer** fail-closed, PHI-free, audited, connection-isolated (§2.6).
- **Passwordless dev login is disabled in production** unless an explicit env flag is set; the auth secret fails closed in production if unset.
- **Secrets from env only** (the API key), nothing hardcoded.
- Real NPHIES credentials, PKI, KSA-resident OIDC, and KSA-region hosting are intentionally **stubbed as typed swaps** (`TODO(nphies-creds)` / `TODO(ksa-oidc)`) — see §2.10.

## 2.9 Testing strategy

- **Unit tests (Vitest, ≈ pytest/JUnit):** pure logic, utilities, the AI code via a **fixture provider** (record/replay, so CI never calls the real API or needs a key). Baseline ~340 passing.
- **Integration tests:** run against a real Postgres, single-fork, **destructive**. They prove migrations, RLS enforcement, append-only privileges, and money reconciliation. Baseline ~33 passing.
- **E2E + accessibility (Playwright):** run in CI against a seeded DB. First green CI in the project's history was achieved during the harden loop. (Can't run locally here — Node 20.2.0 — see §1.11.)
- **Coverage target 80%**; the `@taweed/ai` package is ~92%, with 100% on the pure PHI-handling helpers (`pseudonymize`, `postprocess-ar`, `sha256`).

The house rules mandate TDD and multi-agent review; the git history and the ledger (`docs/ai-deploy-readiness.md`) show both were followed — features landed with tests, and multi-lens security/healthcare/TypeScript reviews with adversarial verification ran before each merge.

## 2.10 What's real vs. stubbed (so nothing surprises you)

Taweed is **fully built on synthetic data** and deliberately **stubs the parts that need real Saudi credentials/partners**. These are *typed swaps* — the interface is real and tested; only the concrete implementation is a dev stand-in. This is by design, not incompleteness:

| Area | Today | Swap-in at deploy |
|------|-------|-------------------|
| Auth provider | Passwordless dev picker | KSA-resident managed OIDC (`TODO(ksa-oidc)`) |
| Denial reason codes | 8 placeholder `TWD-*` codes | Real NPHIES codes (blocked on `BLK-2`) |
| NPHIES profile validation | Base-FHIR-R4 only; profile validation is a creds-gated stub | Real IG validation |
| Object store / KMS | In-memory dev implementations | Real KSA-region S3-compatible store + KMS |
| Cloud infra (`infra/`) | Terraform skeleton, **not applied** | Applied against Oracle Cloud Riyadh once creds land (`BLK-8`) |
| XLSX / PDF-OCR ingest | Typed adapter **stubs** | Inject SheetJS + Tesseract |
| The headline "recovered SAR on a real clinic" | Synthetic | Needs a real design partner's data (`BLK-1`) + SME-reviewed taxonomy (`BLK-9`) |

If you see a `TODO(nphies-creds)` or `TODO(ksa-oidc)` comment, that's a **known, intentional stub**, not a bug.

## 2.11 Known issues, risks & deferred items

From the deploy-readiness ledger (`docs/ai-deploy-readiness.md`) and handoff notes. None are release-blockers on the synthetic build; all are documented:

- **Normalizer missing-amount → `0.00` (BLK-1 latent):** a missing adjudication amount currently becomes `"0.00"` instead of quarantining, which would *understate* denied/at-risk money. It **can't trigger today** (the synthetic generator always sets an amount), but the correct real-data behavior (quarantine vs throw) is a decision to make when real data (BLK-1) arrives. Money-adjacent — treat as a must-fix before real data.
- **Accessibility — table row semantics:** the Scrubber uses `<tr role="button">` for clickable rows, which strips proper row semantics for screen readers. Flagged, deferred. Worth fixing.
- **drizzle-kit journal stale:** the migration tool's journal isn't snapshotted for `0001`–`0007`, so `pnpm db:generate` can emit duplicate DDL. Dev-tooling annoyance only; the custom migrator applies all `.sql` files in order correctly.
- **Local runtime smoke (chrome-devtools):** couldn't run locally (Node 20.2.0 blocks local Playwright/devtools driving); covered instead by CI E2E + a11y. If you get a newer Node in a separate environment, a manual devtools pass across config states × EN/AR × light/dark would close this.
- **Rate limiting is per-instance/in-memory** for the AI explain action — fine for one server, needs a shared store (e.g., Redis) at horizontal scale. Documented as a known residual.

The ledger's own "Deploy-Ready DoD" checklist is a good living to-do list; several boxes are ticked, some remain for the deploy phase.

## 2.12 Overall assessment

**Strengths (this is a well-engineered codebase):**

- Security-first: RLS tenant isolation, DB-enforced append-only audit, server-enforced RBAC, fail-closed AI — all proven by tests, not just asserted.
- Clean modular boundaries; the "only `@taweed/ai` touches the LLM" rule is excellent risk containment.
- Money correctness treated as sacred, with the partial-win reconciliation bug found and fixed with a test.
- Genuine bilingual/RTL and accessibility discipline, not an afterthought.
- Honest about what's stubbed; stubs are typed swaps, so replacing them is mechanical.

**Watch-outs for you as the new owner:**

- It's a TypeScript/React/Node stack — budget ramp-up time if that's new (§2.0 mappings help).
- The stubbed integrations (NPHIES codes, OIDC, KSA hosting) are where the *real* remaining work and external dependencies (partner data, credentials, SME sign-off) live — those are business/logistics blockers as much as engineering.
- Keep the money-path and RLS invariants sacred: any change there should come with a test, and never let the synthetic-data gate (`data_origin`) regress before real PHI is involved.

**Recommended first moves:**

1. Run the automated suites (§1.11) — see them green yourself.
2. Do the full click-through (§1.8) with AI off, then on (§1.10).
3. Read `docs/handoff.md` and `docs/ai-deploy-readiness.md` — they're the living project memory.
4. When ready to advance, the next planned unit is **AI-4 (vision EOB/PDF extraction)** per `docs/04_agentic_retrofit_plan.md` §9; the real-data headline waits on the external blockers (BLK-1/2/9).

## 2.13 Beginner glossary

| Term | Plain meaning |
|------|---------------|
| **NPHIES** | Saudi Arabia's national platform for exchanging health insurance claims |
| **FHIR** | A healthcare data standard (the format claims come in); R4 is a version |
| **PHI** | Protected Health Information — patient data that must be guarded |
| **Claim / Denial / Appeal** | A bill to an insurer / the insurer refusing it / the clinic contesting the refusal |
| **SAR / halala** | Saudi Riyal / its cent (1 SAR = 100 halalas); money is stored in halalas |
| **Tenant** | One clinic; the app is multi-tenant (many clinics, isolated) |
| **RLS** | Row-Level Security — Postgres feature that filters rows by tenant automatically |
| **RBAC** | Role-Based Access Control — what each role (owner/rcm/…) may do |
| **Scrubber** | The rules engine that flags risky claims before submission |
| **Server Component / Server Action** | Next.js code that runs on the server (rendering / mutations) |
| **`"use client"`** | Marks a component that also runs in the browser (for interactivity) |
| **ORM / Drizzle** | Object-relational mapper — code-to-SQL layer |
| **Zod** | Runtime validation library (Pydantic-for-TS) |
| **LLM** | Large Language Model (Claude) — the AI |
| **Kill switch / fail-closed** | Off by default; must be explicitly enabled; safe when disabled |
| **Pseudonymize** | Replace an identifier with a token before sending to the AI, restore it after |
| **Typed swap / stub** | A dev placeholder behind a real interface, replaced at deploy without code changes |
