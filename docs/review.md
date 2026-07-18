# Taweed — Local Testing Guide & Technical Review

> **Who this is for:** the developer taking ownership of Taweed. It has two halves:
>
> 1. **Part 1 — Local Testing Guide** — everything you need to run the whole product on your own machine and click through every feature, including the new AI features. Start here.
> 2. **Part 2 — Technical Review** — a beginner-friendly tour of how the system is built, written for someone fluent in **Python, Java, C#, HTML, and CSS** (not necessarily TypeScript/React/Node). Every unfamiliar concept is mapped back to something you already know.
>
> Written 2026-07-06 against `main` (`2d0e1bb`); updated 2026-07-08 against branch `ai-phase-4` (`e42821a`, pending merge to `main`) to cover **AI-4 (vision EOB/PDF extraction)**. Sources: `docs/handoff.md`, `docs/ai-deploy-readiness.md`, `docs/04_agentic_retrofit_plan.md`, `docs/blocker.md`, and a direct read of the code.

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
- **AI-4 — EOB/PDF Extraction:** upload a scanned insurer remittance (EOB) PDF; a vision model extracts claim-line data, deterministic validators cross-check the totals, and a human reviews/corrects/approves every extraction before it ever reaches a claim record. **Built and tested on synthetic PDFs only** — no real partner document may reach the model until a production-route decision and counsel sign-off are recorded (`docs/blocker.md`, BLK-AI-1/3/4).

---
---

# PART 1 — LOCAL TESTING GUIDE

This part is a complete, click-by-click script. If you follow it top to bottom you will have exercised every screen and every new feature.

> **Not a programmer, or just want the fastest path?** The repo root `README.md` has a fully
> click-by-click Docker quick start — install Docker Desktop, paste two commands, done, no Node/pnpm
> install needed. Everything from §1.7 onward (login, the walkthrough, §1.14's test fixtures) works
> identically either way — **except §1.10** (enabling AI): its `apps/web/.env.local` method is
> non-Docker-only and has no effect on a Docker deployment — see the callout at the top of §1.10
> for the Docker equivalent. §1.1–§1.6 below are for a **local (non-Docker) developer setup** instead.

## 1.1 Prerequisites (what must be installed)

| Tool | Version required | Why |
|------|------------------------|-----|
| **Node.js** | `>= 22` (pinned via `engines` in `package.json`; bumped 2026-07-15 from a 20.2.0 pin — pnpm 11 requires Node 22+) | Runs the app and the tests. The app itself stays pinned to **Next.js 15** by deliberate choice, not a Node-version constraint — don't "upgrade Next" to fix an error, see Troubleshooting. |
| **pnpm** | `11.13.0`, pinned via `packageManager` in `package.json` | The package manager (like `pip` / Maven / NuGet). If it's not on your PATH, install via `corepack enable && corepack prepare pnpm@11.13.0 --activate`, or call it by its full local-install path. |
| **Docker** (with Docker Compose) | Docker CLI at `/usr/local/bin/docker` | Runs the local PostgreSQL database in a container so you don't have to install Postgres directly. |

Quick sanity check — run this in your terminal (fish shell):

```fish
node -v                 # expect v22.x
~/.local/bin/pnpm -v    # expect 11.13.0
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

> **Step 0 — the first-run corridor (EXECUTE A2), if you want to see it:** a brand-new tenant with no captured recovery baseline is redirected to `/onboarding` instead of its normal landing module — a 4-step guided flow (locale + theme, confirm branches, upload remittances, first-insight handoff) instead of the dashboard. The seed script (`scripts/seed.ts`) captures a baseline for every demo tenant as part of seeding (EXECUTE B8), so **every seeded demo account you log in with above already counts as "past onboarding"** and goes straight to its normal landing page — you will not see the corridor by picking a demo account. To see it, either delete that tenant's row from `recovery_baselines` (`DELETE FROM recovery_baselines WHERE tenant_id = '<id>';`) and log in again, or navigate directly to `http://localhost:3000/en/onboarding` while signed in (the page itself re-checks and bounces you back out to your landing module if a baseline already exists, so this only shows real content pre-baseline). The corridor's upload step reuses the same Ingest dropzone as Step 3 below; RBAC is unchanged, so an **owner** account attempting the upload there still gets the real "not authorized" response (owner's `ingest` capability is `hidden` per `rbac.ts`) — that's why the corridor also offers a "Do this with me" white-glove CTA (a `mailto:` link) as the owner's primary path.

The persistent layout you'll see on every page:

- **Left rail** (vertical nav) — the module icons. On a narrow window it's icons-only; widen past ~1024px to see labels. In Arabic it flips to the right side.
- **Top command bar** — clinic/branch switcher, a search box, and on the inline-end side: a **persistent money indicator** (recovered vs at-risk — only visible at ≥1024px width), a data-residency badge, the **language toggle (EN/AR)**, the **theme toggle (light/dark)**, your role chip, and an account menu.

Now walk each module.

### Step 1 — Overview
Click **Overview** in the left rail.

- The big emerald number is **Recovered SAR** — the product's hero metric.
- To its side: **At-risk SAR** (money still recoverable), **Win rate**, **Median days to recovery**.
- Below: two "forward" cards — *Run scrubber* and *Build report* — that link deeper. **Build report** now opens the real **owner report** (EXECUTE A3, `/recovery/owner-report`) — a one-page, print/PDF-able summary (recovered this month, first-pass rate vs. onboarding baseline, top payers recovered from), not a placeholder link to the Recovery page anymore.
- **What to verify:** the big number renders large (not tiny). A past bug rendered hero numbers at 14px; it's fixed, so this is a good visual regression check.

### Step 2 — Denial Analytics
Click **Analytics**.

- Top strip: the **denial rate** as a huge red percentage, plus **at-risk SAR**.
- Charts: a **trend line** (denials over ~6 months), a **Pareto** chart (denials by reason, ranked), **by payer** ranked bars, **by branch** ranked bars.
- Top-right of the page header, **two** actions now (added 2026-07-17 — rcm's default landing page is Analytics, and the owner report previously had no link from here, only a card on Overview that rcm never lands on by default):
  - **Build the owner report** → `/recovery/owner-report`, the same one-page print/PDF-able summary described in Step 1.
  - **Build the free-audit report** (EXECUTE A3, `/analytics/audit-report`) — a bilingual, print/PDF-able leave-behind document: cover denial-rate/at-risk figures, leak by payer, top reasons (reusing this same Pareto), a recoverable-vs-structural split, and a projected recovery range. Click the **Print or save as PDF** button on that page (it calls the browser's own print dialog — there is no server-side PDF pipeline, by design) to see the app chrome (rail/command bar) disappear via `print:` CSS, leaving just the report.
- **What to verify:** charts actually render (they use hard-coded HEX colors deliberately — CSS variables don't work inside SVG). Hover a bar/point; numbers should be sensible. Both header buttons live-verified EN/AR × light/dark (chrome-devtools MCP, 2026-07-17): correct locale-prefixed URLs, real (non-machine-translated) Arabic label reusing the existing "تقرير المالك" term, proper RTL mirroring, good contrast both themes.
- **What to verify (branch selector):** picking a branch in the command bar (top of the page) narrows this page's numbers/charts to that branch only — e.g. at-risk SAR and the trend/Pareto/payer bars recompute; picking **All branches** reverts to the full-tenant figures. Analytics and Scrubber (Step 4) are the only two modules with **real** branch filtering wired in — Ingest/Appeals/Recovery show the same switcher chrome but deliberately do **not** filter on it, so seeing no change there is expected, not a bug. An invalid or foreign `?branch=` value typed directly into the URL is silently ignored (falls back to All branches) rather than erroring — it can never widen scope beyond this tenant's own branches.

### Step 3 — Ingest (data intake)
Click **Ingest**. (Only visible to rcm/finance/admin — that's why we're using rcm.)

- Left: a **drag-and-drop zone** for a claim file. Right: a **run ledger** with stage checkmarks (received → parsing → validating → ready) and three counters: **claims created, denials detected, quarantined**.
- **To test it end-to-end:**
  1. Click **Download sample file** (the secondary button). This downloads `taweed-sample-bundle.json` — a synthetic NPHIES claim bundle.
  2. Click **Process** (or drag the downloaded file onto the dropzone).
  3. Watch the ledger stages tick green and the counters count up.
  4. If any rows are malformed, a **Quarantine** table appears at the bottom listing each bad row with a **reason** — the app never silently drops bad data.
- **What to verify:** counters animate, and a summary line appears ("*N claims, M denials, at-risk SAR …*").

> **Where Scrubber (Step 4) and Appeals (Step 5) test data actually comes from:** both modules only show something once **claims exist** in the database. The seed (§1.5) already loads a full set for you, but if you ever land on an empty/thin Scrubber or Appeals — a fresh DB you didn't seed, or you just want more variety — **this Ingest step is how you add more claims**: click **Download sample file** then **Process** again (you can do this repeatedly; each run adds another batch of synthetic claims/denials on top of what's there, it does not wipe anything). The only way to reset to a completely clean, empty-then-fully-seeded state is re-running the seed script (§1.5), which is destructive and rebuilds from scratch. In short: **no seed run yet → empty Scrubber/Appeals is expected, not a bug — go to Ingest first.**

### Step 3a — B6: CSV/TSV field-mapping panel

Still on **Ingest**, same dropzone as Step 3 — but drop a `.csv` or `.tsv` file instead of the JSON
sample bundle. (An `.xlsx` drop is also accepted by the dropzone but currently always fails with an
explanatory error — a real XLSX parser is a documented later swap, not built yet.)

- **What it does:** a remittance CSV/TSV doesn't carry FHIR-typed fields, so the app can't know which
  column is which. It auto-detects a best-guess mapping (source column → canonical field, e.g. a
  "Denied Amount" header maps to the `deniedAmount` field) with a confidence indicator, and always
  requires an explicit human confirm before anything is written — never auto-proceeds even on a
  high-confidence match.
- **To test it:**
  1. Make a small CSV with a header row and a few data rows — columns like `Claim ID, Payer Name,
     SBS Code, Total Amount, Denied Amount, Denial Reason` map cleanly; try a deliberately odd header
     name too, to see a low-confidence "No match" row.
  2. Drop it on the dropzone (or use the file picker). A **"Map your columns"** panel replaces the
     run ledger: one row per canonical field, showing the detected source column, a confidence badge
     (High/Medium/Low/No match), and an override **dropdown** per row.
  3. Correct any wrong/missing mapping via the dropdown (including explicitly clearing a field to
     "— none —" — this is honored, not silently ignored).
  4. Click **Confirm mapping**. The panel is replaced by the same run-ledger counters Step 3 uses
     (claims created, denials detected, quarantined) — a CSV commit lands in the exact same
     claims-creation path a JSON bundle does.
  5. Click **Cancel** instead (on a fresh drop) to back out to the empty dropzone without committing
     anything.
- **Quarantine behavior (money-path — treat with extra care):** a row with a missing/invalid total
  amount, an inconsistent denied-amount/denial-reason pair, an amount with more than 2 decimal places
  (SAR's actual precision), an implausibly large amount, or an amount written in Arabic-Indic digits
  (this app's digit law requires Western digits in money columns, both locales) is **quarantined with
  a specific reason**, never silently dropped, corrupted, or mis-rounded. The quarantine table below
  the counters lists each bad row's ref + reason, same as the JSON path.
- **What to verify:** the mapping panel's heading receives focus on appearing (screen-reader users
  aren't left behind on a silent page transition); after Confirm or Cancel, focus lands back on the
  run-ledger heading; a live status region announces "N rows detected" and, after commit, the same
  result summary the JSON path shows ("*N claims, M denials, at-risk SAR …*"); dropping a *second*,
  different file while the mapping panel is still open resets the override selections (they don't
  leak from the first file's mapping).

### Step 3b — AI-4: EOB/PDF Extraction (Review queue)

Still on **Ingest**. Note the second tab at the top of the panel, next to the upload tab: **"Review queue"** (it shows a pending-count badge once something is waiting). This is AI-4 — the newest AI feature.

- **What it does:** a clinic receives a scanned/PDF **EOB** (Explanation of Benefits — the insurer's remittance advice showing what it actually paid/denied per claim line) from a payer. Instead of someone re-typing every line by hand, a vision-capable model reads the PDF and extracts the structured data (claim refs, line items, paid/billed/patient-share amounts, denial codes). **A human always reviews and can correct it before anything is written to a real claim record** — nothing from this pipeline is auto-applied.
- **To test it, you need a PDF file to upload — and four ready-made synthetic ones now ship with the repo.** `docs/test-fixtures/eob-1-clean.pdf`, `eob-2-full-denial.pdf`, and (added 2026-07-18 as a size-extremes stress pair) `eob-3-minimal-single-line.pdf` and `eob-4-dense-large-remittance.pdf` are real, valid remittance PDFs with their expected extractions saved alongside (`*.expected.json`) — drop any of them straight onto the dropzone (full walkthrough in §1.14, Fixtures 5–8). These were produced by the synthetic-EOB corpus's **HTML→PDF rasterizer** (`test/synthetic-eob/src/rasterize.ts`, headless Chromium `page.pdf()`), which was **built 2026-07-10** — the earlier "rendering that HTML to a PDF is a not-yet-built `TODO(ai-route)` step" note is obsolete. You can also bring your own PDF: any real or dummy PDF works for a plumbing test (the upload only checks for valid `%PDF-` magic bytes before proceeding), but for a *meaningful* extraction test use one of the fixture PDFs or another remittance-shaped document.
- **Steps:**
  1. On the **upload** tab, drag a `.pdf` onto the dropzone (or use the file picker) instead of the JSON sample bundle.
  2. It's submitted to `extractEobPdfAction`; on success you'll see *"Submitted for review. Open the Review queue tab above to check and approve it."*
  3. Switch to the **Review queue** tab. Your file appears as a row: filename, which model tier handled it (`sonnet`, or `opus` if escalated), a confidence badge, and an **"escalated"** badge if the cheaper sonnet pass failed validation and opus was retried.
  4. Click **Review** to open the extraction form: every extracted field is editable. If the deterministic validator found a problem (e.g., claim lines don't sum to the claimed total), you'll see a card listing each **failing check** with its detail — this is the arithmetic/cross-total gate speaking, not a vague error.
  5. Click **Approve** — the arithmetic validator **re-runs on your edited values** before it's allowed to save (so a human edit can't silently break the totals); if it still doesn't reconcile, approval is blocked with an "inconsistent" message until you fix the numbers. Click **Reject** to discard instead.
- **AI off (default):** uploading a PDF goes through the same fail-closed pattern as AI-1/2/3 — see §1.10 for the flag. With AI off, the extraction call itself won't run.
- **What to verify:** the queue badge count matches pending rows; approve is blocked when totals don't reconcile (try editing a paid amount to something wrong and confirm you can't approve); reject removes the row from the queue.
- **Hard constraint, always true, never testable-around:** every extraction in this build comes from a synthetic PDF you supplied yourself. **No real patient/claim PDF should ever be uploaded here** until the production route decision and counsel sign-off are recorded in `docs/blocker.md` (BLK-AI-1/3/4) — this is a policy boundary, not a technical one, so nothing in the UI currently stops you from uploading a real document; don't.

### Step 4 — Scrubber (+ AI-1: Explain Flag)
Click **Scrubber**.

- A table of claims, each with a **risk score** (0–100, colored bar), the top flag message, claim id, patient pseudonym, payer, codes, and amount.
- **Click any row** (or focus it and press Enter/Space) to open a **detail panel** (slides in from the side).
- In the panel, each **flag** shows its rule name, severity, the human message, the **field** that failed, and the **rule id**.
- **AI-1 lives here:** under each flag is a small **"Explain" button** (Sparkles icon).
  - With AI **off** (the default — see §1.10): clicking it shows a muted *"explanation unavailable"* note. This is the intended graceful-degradation behavior — **not** a bug.
  - With AI **on**: clicking it fetches a bilingual plain-language explanation + a suggested fix, shown inline. Click again to collapse. (It's cached, so a second click on the same flag is instant and doesn't re-call the model.)
- **What to verify (AI off):** deterministic messages always show; Explain degrades gracefully. **(AI on):** you get a real explanation in the current language; toggle to Arabic and it's in Arabic.
- **What to verify (branch selector):** picking a branch in the command bar (top of the page) narrows this table to that branch's claims only; picking **All branches** shows every branch again. Unlike Analytics (Step 2), Scrubber is one of the two modules with **real** branch filtering — Ingest/Appeals/Recovery show the same switcher chrome but deliberately do **not** filter on it, so seeing no change there is expected, not a bug. An invalid or foreign `?branch=` value typed directly into the URL is silently ignored (falls back to All branches) rather than erroring.

### Step 4a — Command-bar search

The search box in the top command bar (shared shell chrome — visible on every page, not just here) was a dead `<input type="search">` with no handler; it's now wired, and its effect lands on this page.

- **What it does:** type a query and press **Enter** — it navigates to `/scrubber?q=<query>`, which substring-filters the already-loaded claim rows by **claim id**, **NPHIES id**, or **payer name** (no new search index/API/dependency — it filters what Scrubber already has in memory).
- **Steps:**
  1. From any page, click into the search box and type a claim id, NPHIES id, or payer name (or a partial match) you know exists in the seeded data.
  2. Press **Enter**. You land on Scrubber at `/scrubber?q=<your query>`, and the table shows only the matching rows.
  3. Press Enter with the box empty or whitespace-only — nothing happens, no navigation (a deliberate no-op, so an empty search doesn't fire a bare `?q=` request).
- **What to verify:** the query persists in the URL (shareable, survives reload); the match is substring, not exact — a partial payer name still filters correctly.

### Step 5 — Appeals (+ AI-2: Appeal Assist)
Click **Appeals**.

- Left: a **queue** of denials sorted by SAR at stake (payer, reason, deadline in days).
- **Click a denial** in the queue. The right side loads a **draft appeal letter** — a complete, deterministic, editable letter (the SAR being appealed is shown prominently at the top).
- **Language toggle (English / العربية):** each language keeps its *own* editable copy — switching never loses your edits. The letters are natively generated per language, not machine-translated.
- **AI-2 lives here:** the dashed **"AI suggestions"** panel with a **"Suggest" button** (Sparkles icon).
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
- The **owner report** (EXECUTE A3) also lives one click away here: same destination as Overview's *Build report* card, `/recovery/owner-report`. RBAC-gated the same as this page (hidden for clinician).

### Step 7 — Settings (four tabs, four different jobs)
Click **Settings**. It's four tabs; each answers a different question about the product. (AI-4's review queue is **not** here — it lives on the Ingest page, §Step 3b.)

- **"Scrubber rules" tab — "what rules are live right now?"** A read view of the active scrubber rule library: message, severity, scope, version. This is the *ground truth* the Scrubber module (Step 4) actually runs against — if a claim isn't getting flagged the way you expect, check here first to confirm the rule is active and scoped correctly (global vs. a specific payer).
- **"Author" tab — "how do we add a new rule?" (AI-3, only visible to rcm/owner/admin).** This is where a new flag gets created, either by hand or with AI help:
  1. Type a billing rule in plain English or Arabic, e.g. *"Flag claims where the tooth surface code is missing on a restorative procedure."*
  2. Choose **scope**: *Global* or *Payer* (pick a payer if payer-scoped).
  3. Click **Draft** (the Sparkles-icon button).
     - AI **off:** you get a *"manual authoring"* note; nothing breaks.
     - AI **on:** the model proposes a structured rule, which is then run through a **deterministic gate** (shape check → engine dry-run → golden-set regression). You'll see either **"Gate passed"** (green shield) or **"Blocked at stage X"** (red) with the specific errors, plus a readable view of the rule's conditions.
  4. If the gate passed, click **Approve** (or **Reject**). Nothing goes live until a human clicks Approve — approved rules are server-enforced by role, not just UI.
  - The **authored-rule library** below lists drafts/approved/rejected rules; drafts can be approved/rejected from there too. Once approved, a rule shows up in the "Scrubber rules" tab above and starts firing in Scrubber (Step 4).
- **"Audit log" tab — "who touched what, and when?"** The append-only compliance trail: actor, action, entity, timestamp. Every PHI read/write/export — and every AI call, including AI-4 extractions — appears here. Use this tab whenever you need to prove *who* approved a rule, exported a letter, or approved an EOB extraction.
- **"Data residency" tab — "where does the data live, and is it handled correctly?"** A static statement of the KSA-hosting posture (today: stubbed, see §2.10) plus the Arabic-Indic digit-law note (why Arabic numerals render the way they do). There's nothing to click here; it's a reference/compliance page, not a workflow.

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
- [ ] Ingest → Review queue: a submitted PDF appears, shows model tier + confidence, and blocks approval when totals don't reconcile.
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

> **Running via the Docker quick start (README.md)? Stop here and use README's method instead.**
> `apps/web/.env.local` is only read by the local (non-Docker) `pnpm --filter @taweed/web dev`
> server — it does **not** exist inside the Docker container, so setting it has **zero effect**
> on a `docker compose up` deployment. A Docker tester who follows the `.env.local` steps below
> will see every AI feature stay stuck on "unavailable" with no error, because the flags were
> never actually read. This bit a real tester (2026-07-16) who followed this exact section
> before realizing they were on Docker. If you're on Docker, set the same six variables inside
> **`docker-compose.yml`**'s `app: environment:` block instead — see README.md → "Testing the AI
> features" for the click-by-click version — then `docker compose up -d` to pick them up (no
> `--build` needed, only a container recreate).
>
> Everything below this note is for the **non-Docker** `pnpm dev` path only.

**Easiest way: create `apps/web/.env.local`** (Next.js loads it automatically for the dev server). Put:

```bash
# Master switch — must be exactly "true"
TAWEED_AI_ENABLED=true

# Per-feature switches (turn on the ones you want to test)
TAWEED_AI_EXPLAIN_ENABLED=true       # AI-1 Explain Flag (Scrubber)
TAWEED_AI_APPEAL_ENABLED=true        # AI-2 Appeal Assist (Appeals)
TAWEED_AI_AUTHOR_RULE_ENABLED=true   # AI-3 Rule Authoring (Settings → Author)
TAWEED_AI_EXTRACT_EOB_ENABLED=true   # AI-4 EOB/PDF Extraction (Ingest → Review queue)

# Your Anthropic API key (real network calls will be made & billed)
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Then **restart the dev server** (`Ctrl-C`, then `pnpm --filter @taweed/web dev` again) so it picks up the new env file.

> **If you don't have an API key:** you can't exercise the *live* AI path, but you can and should test the **AI-off** path (the default) — the graceful "unavailable" behavior — and the **automated tests** exercise the AI code with a fake/fixture provider (no key, no network). See §1.11.

> **AI-4 runs slower than the other three.** PDF+vision calls get a **90-second** per-request timeout (vs. 30s for AI-1/2/3) — a large or dense scanned PDF can genuinely take that long, especially if the first (sonnet) pass fails validation and escalates to a second (opus) pass. A slow Review queue on a real test PDF is expected, not a hang.

**Now re-run the four AI walkthroughs with AI on:**

- **AI-1 (Explain):** Scrubber → open a flagged row → click **Explain**. You should get a real bilingual explanation + suggested fix (§1.8 Step 4).
- **AI-2 (Appeal Assist):** Appeals → pick a denial → **Suggest** → edit/insert a DRAFT paragraph (§1.8 Step 5).
- **AI-3 (Rule Authoring):** Settings → Author tab → type a rule → **Draft** → watch the gate verdict → **Approve** (§1.8 Step 7).
- **AI-4 (EOB/PDF Extraction):** Ingest → upload a PDF → **Review queue** tab → open it, check the validator findings (if any), **Approve** or **Reject** (§1.8 Step 3b). Remember: **synthetic PDFs only**, never a real document (§Step 3b).

**Three states you should be able to tell apart** (this is a designed behavior, worth verifying):

| State | How to produce it | Expected UI |
|-------|-------------------|-------------|
| **Off** | No env vars (default) | Muted "unavailable" / "manual authoring" note; deterministic product unaffected |
| **On & working** | All 3 layers + valid key | Real AI output appears |
| **On but misconfigured** | Feature flag `true` but **no/blank `ANTHROPIC_API_KEY`** | Fails **loudly** with a distinct "misconfigured" message — *not* silently collapsed into the same "unavailable" as off |

That last row is important: the system deliberately distinguishes "AI is intentionally off" from "AI is on but broken," so an ops person can tell a deliberate switch from an outage. This applies to AI-4 too.

**Audit note:** every AI call — success, parse failure, or provider error — writes a row to the `llm_calls` table. It stores **only hashes** of the prompt/output, never the raw text or any PHI. You can see AI activity reflected via the compliance trail; the raw content is intentionally never persisted. AI-4 additionally persists the **extraction itself and its validator report** in a separate `eob_extractions` row (that's the actual reviewable data — a hash alone wouldn't let a human review anything), scoped by the same tenant-isolation policy as every other tenant table.

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

Expected: all unit tests green (the project baseline is 444 unit tests passing, up from ~340 pre-AI-4).

**Integration tests** (need Postgres running; these are **destructive** — they migrate and wipe the shared local database):

```fish
env DATABASE_URL=postgres://taweed:taweed@localhost:5432/taweed \
    ~/.local/bin/pnpm test:int
```

Expected: all integration tests green (baseline 37 passing, up from ~33 pre-AI-4). They verify real database behavior: migrations apply cleanly, Row-Level Security actually blocks cross-tenant reads (including the new `eob_extractions` table), the audit/`llm_calls` tables are append-only *by database privilege* (not just by convention), and the money math reconciles.

> **After running integration tests, re-seed** (§1.5) before using the live app again — the integration run leaves the database wiped.

**AI-4 eval harness — fully fixed and run for real, 2026-07-18. Sonnet meets both documented targets.** `packages/ai/evals/extractEob.eval.ts` is gated behind `AI_EVALS_LIVE=1` (never runs in CI, never runs in `pnpm test`) and scores real extraction accuracy against the synthetic corpus's ground truth (`EVAL_TARGET_THRESHOLDS`: amounts ≥98%, overall ≥95%). Getting a trustworthy number took three real fixes, all landed: (1) an env-shadowing bug (`env: {...}` fully replacing `process.env`, hiding a genuinely-configured `ANTHROPIC_API_KEY`) in both `extractEob.eval.ts` and `explainFlag.eval.ts`; (2) a too-short per-tier test timeout (`120_000`ms → `900_000`ms) for 40 sequential real API calls; (3) the real root cause — `test/synthetic-eob/src/generate.ts`'s `buildHtmlTemplate` (what's actually rasterized into the PDF the vision model sees) never rendered `patientRef`/`serviceDate`/`claimId`, so the model couldn't produce fields it never saw, cascading every nested score to ~0. Fixed by rendering those fields into the document and by having `scoring.ts` match claims on `nphiesClaimId` (falling back to `claimId`) — the same fallback pattern production code already uses. **Full 40-item × 2-tier live run against the real Anthropic API (`packages/ai/evals/.output/extractEob-*.json`, ~978s wall time): Sonnet 96.6% overall / 100% amounts, 0 hallucinated claims — meets and exceeds both documented targets (98% amounts, 95% overall). Opus 87.1% overall / 100% amounts — meets amounts only; codes underperform Sonnet's (183/375 vs 343/375), a genuine model-behavior difference worth a follow-up look, not a bug.** The harness's own `expect(...)` assertions still deliberately check only *plumbing* (one report row per tier, a score recorded per document), never the accuracy thresholds themselves — routine model drift shouldn't masquerade as a broken build — but the numbers above are now real, reviewed, scored results, not an artifact.

> **UPDATE 2026-07-18, same day, size-diversity follow-up: the corpus grew from 40 to 44 items (9 to 11
> scenarios) — and immediately found a real production bug, not just a scoring one.** Two new
> scenarios (`minimalSingleLine`: 1 claim/1 line; `denseLargeRemittance`: 8 claims × 6 lines = 48
> lines, a real 4-page PDF) were added to `test/synthetic-eob/src/scenarios.ts` to stress-test the
> size extremes the original 1-3-claim/2-4-line corpus never exercised (`CORPUS_SIZE` bumped 40→44
> to keep even per-scenario coverage). The large scenario immediately reproduced a genuine
> extraction failure: `stop_reason: "max_tokens"` — Claude Sonnet 5 runs **adaptive thinking on by
> default** (no `thinking` field needed to trigger it), and that thinking budget is drawn from the
> *same* `max_tokens` ceiling as the actual response. On the 48-line document, 3148 of the 8192-token
> budget went to thinking, leaving too little room for the JSON output, which got truncated
> mid-string and threw a hard parse error — the extraction failed **outright**, not just scored low.
> Confirmed via a live isolated repro against `docs/test-fixtures/eob-4-dense-large-remittance.pdf`;
> re-run at `max_tokens: 32768` completed naturally (`stop_reason: "end_turn"`, ~11k tokens used, 3x
> headroom). **Fixed in production code**, not just the eval: `packages/ai/src/features/extractEob.ts`'s
> `maxTokens: 8192` → `32768` (`EXTRACT_EOB_MAX_TOKENS`). Full 44-item × 2-tier re-run post-fix (real
> Anthropic API, both tests passed clean, ~1434s wall time): **Sonnet 98.1% overall / 100% amounts,
> 0 hallucinated — exceeds both targets by a wider margin than the 40-item run.** **Opus 83.5%
> overall / 99.9% amounts** — meets amounts, codes weaker at the larger scale (360/924 vs Sonnet's
> 888/924). Two new manual walkthrough fixtures also ship in `docs/test-fixtures/` from this pass —
> see §1.14 Fixtures 7-8.



**Full build check** (the root `build` script is just the type check; to run the real Next.js production build):

```fish
~/.local/bin/pnpm --filter @taweed/web build
```

**End-to-end (Playwright) tests:** these live in `apps/web/tests/e2e` and run in **CI** (GitHub Actions). As of the 2026-07-15 Node 22 bump (§1.1), local Playwright should now load its config correctly (the old Node 20.2.0-on-this-Mac block is gone) — untested locally as of this writing, but worth trying (`~/.local/bin/pnpm --filter @taweed/web test:e2e`) before assuming CI is the only option. Either way, treat CI as the source of truth for E2E; the manual click-through (§1.8) is a good substitute if local E2E still doesn't cooperate.

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
| Tempted to **upgrade Next.js** to fix an error | Next 15 is a deliberate pin, not a Node-version workaround | **Don't.** Fix the actual error instead |
| **Playwright/E2E won't run locally** | Used to be blocked by a Node 20.2.0 pin on this Mac; that pin is gone as of the 2026-07-15 Node 22 bump | Try it again locally first; fall back to CI + manual click-through if it still doesn't cooperate |
| Test output looks **truncated/summarized** when *Claude* runs it | The RTK tooling hook compresses stdout | Only affects the AI assistant, not your own terminal; if needed, write results to a file with `--reporter=json --outputFile <path>` |
| **Integration tests left the DB empty** | They're destructive by design | Re-seed (§1.5) |
| Seeing an **Arabic RTL** UI unexpectedly | You signed in as the **owner** (defaults to Arabic) | Use the EN/AR toggle, or sign in as rcm/finance for English |

---

## 1.14 Test fixtures — mock files with documented expected results

`docs/test-fixtures/` has ten ready-made files (two FHIR bundles, two CSVs, four EOB PDFs) you can
drop straight onto the Ingest dropzone. Every result below was **verified against this running
app**, not predicted from reading the code — upload the same file and you should see the exact same
result every time (these are deterministic, not random).

> **If you're on the Docker quick-start** (see the repo root `README.md`), do §1.5's seed step via
> `docker compose exec app pnpm --filter @taweed/web seed` instead of the local `pnpm` command
> above — same script, just run inside the container.

### Important: what actually controls a scrubber flag on an uploaded claim

Every claim you upload through the Ingest UI (FHIR bundle **or** CSV) is tagged
`data_origin: "synthetic"` (`apps/web/lib/actions/ingest.ts`) — this is a deliberate PHI-safety gate
(`packages/rules-engine/src/project.ts`'s "EXECUTE B5" guard: only an explicit `synthetic` tag may
use the demo-data code path; anything else must use real, audited columns). One side effect worth
knowing before you build your own test file: for a `synthetic`-tagged claim, some scrubber inputs
are **fabricated from a stable hash of the claim**, not read from the file you uploaded —
specifically `hasPreAuth`, `policyActive`, `isDuplicate`, `hasDiagnosis`, `hasDocumentation`, and
patient gender/age. Only **SBS codes, line quantity, and the total amount** come from what you
actually typed into the file. So a fixture built around "no prior authorization" won't reliably
fire that specific rule — that's why both FHIR fixtures below are instead built around SBS codes
and quantity, which the file's real content *does* control. You'll likely also see one extra,
unrelated flag on each uploaded claim (e.g. "High-value claim submitted without prior
authorization") — that's the hash-fabricated part firing incidentally; it's expected, not a bug in
the fixture.

### Fixture 1 — FHIR bundle, `fhir-ingest-1-excess-quantity.json`

Tests the real, content-driven rule **R-D08-qty-exceeds-cap** (a line's quantity exceeds the
allowed maximum of 10 units — this fixture's line has quantity 25).

1. Sign in as `rcm@al-salama-dental-gro.dev` (§1.7).
2. Go to **Ingest** (§1.8 Step 3).
3. Drag `docs/test-fixtures/fhir-ingest-1-excess-quantity.json` onto the dropzone (or use the file
   picker button).
4. **Expected:** the run ledger shows **"1 claims, 0 denials detected, SAR 0 at risk."**
5. Go to **Scrubber**. Search the table for claim id `claim-test-excess-qty-1` (SBS code `SBS-4200`,
   amount `50,000`) — it's a very large claim so it should sort near the top.
6. Click that row to open **"Why this flagged."**
7. **Expected — verified:** two flags listed:
   - **R-D08-qty-exceeds-cap** — "Line quantity exceeds the allowed maximum." (failed field:
     `lineUnits`) — this is the one this fixture is testing.
   - **R-D02-preauth-highcost** — "High-value claim submitted without prior authorization." (failed
     field: `hasPreAuth`) — the incidental hash-fabricated flag described above; ignore it.

### Fixture 2 — FHIR bundle, `fhir-ingest-2-bundling-pair.json`

Tests the real, content-driven rule **R-D07-bundling-pair** (two procedures — SBS-0007 and
SBS-0008 — that should be billed as one bundled line instead of two separate ones).

1. Same setup as Fixture 1. Drag `docs/test-fixtures/fhir-ingest-2-bundling-pair.json` onto the
   Ingest dropzone.
2. **Expected:** "1 claims, 0 denials detected, SAR 0 at risk."
3. Go to **Scrubber**, find claim id `claim-test-bundling-1` (SBS codes `SBS-0007, SBS-0008`,
   amount `50,000`).
4. Click the row to open **"Why this flagged."**
5. **Expected — verified:** two flags:
   - **R-D07-bundling-pair** — "Two procedures billed separately should be bundled into one line."
     (failed field: `sbsCodes`) — this is the one this fixture is testing.
   - One incidental hash-fabricated flag (varies) — ignore it, same reason as Fixture 1.

### Fixture 3 — CSV, `csv-ingest-1-clean.csv`

Tests a normal, valid remittance row that should ingest with nothing quarantined.

1. Go to **Ingest**, drag `docs/test-fixtures/csv-ingest-1-clean.csv` onto the dropzone.
2. A **"Map your columns"** panel appears (§1.8 Step 3a). Every field auto-maps at **High
   confidence** (Claim ID → `claim id`, Patient reference → `patient id`, SBS code → `sbs code`,
   ICD-10-AM code → `icd10am code`, Service date → `service date`, Total amount → `total amount`) —
   don't change anything.
3. Click **Confirm mapping**.
4. **Expected — verified:** "1 claims, 0 denials detected, SAR 0 at risk." No quarantine table
   appears.

### Fixture 4 — CSV, `csv-ingest-2-bad-denial.csv`

Tests the quarantine path: this row's denied amount (900) is greater than its total amount (500),
which the ingest validator explicitly rejects (a denial can never exceed what was billed).

1. Go to **Ingest**, drag `docs/test-fixtures/csv-ingest-2-bad-denial.csv` onto the dropzone.
2. **"Map your columns"** appears again — this file additionally maps Denied amount → `denied
   amount` and Denial reason code → `reason code`, both High confidence. Click **Confirm mapping**.
3. **Expected — verified:** "0 claims, 0 denials detected, SAR 0 at risk," **Quarantined: 1**, and a
   **Quarantine** table below listing ref `CLM-T002` with reason **"denied amount exceeds total
   amount."** The row is set aside, not silently dropped or corrupted.

### Fixture 5 — EOB PDF, `eob-1-clean.pdf` (+ `eob-1-clean.expected.json`)

Generated by the app's own synthetic-EOB corpus generator (`test/synthetic-eob`, scenario
`"clean"`, seed 1000) — a real, valid, single-page PDF remittance where every line is paid in full,
no denials. Its exact ground-truth extraction (what a correct AI-4 read should produce) is saved
alongside it in `eob-1-clean.expected.json` — compare a live extraction's payer name, amounts, and
per-line `denialCode: null` values against that file.

**Needs AI-4 turned on** (§1.10: `TAWEED_AI_ENABLED=true` **and**
`TAWEED_AI_EXTRACT_EOB_ENABLED=true` **and** a real `ANTHROPIC_API_KEY`) — this is a real,
billed Anthropic API call, not a local computation.

- **With AI-4 off (verified):** dragging this PDF onto the Ingest dropzone fails with **"That PDF
  could not be processed. Try again, or enter this remittance manually."** — a clean, honest
  failure message, not a crash or a silent no-op. This itself is worth checking off as a pass.
- **With AI-4 on:** upload it, then check the **Review queue** tab (§1.8 Step 3b). Compare the
  extracted payer name, remittance date, and per-line billed/paid/patient-share amounts against
  `eob-1-clean.expected.json`. Expect **no denial codes anywhere** (`remittanceTotalPaidHalalas` in
  the JSON is > 0) and the arithmetic validator should show no failing checks, since paid + adjustment
  + rejected reconciles against billed on every line.

### Fixture 6 — EOB PDF, `eob-2-full-denial.pdf` (+ `eob-2-full-denial.expected.json`)

Same generator, scenario `"fullDenial"`, seed 2001 — every line denied (`TWD-D01` "Service not
covered by plan" and `TWD-D05` "Duplicate claim / service"), nothing paid.

- **With AI-4 off (verified):** same clean failure message as Fixture 5.
- **With AI-4 on:** upload it, open it in the Review queue, and compare against
  `eob-2-full-denial.expected.json` — expect `paidHalalas: 0` on every line, a non-null
  `denialCode` on every line, and `remittanceTotalPaidHalalas: 0` overall. This is the "extraction
  correctly reads a bad-news remittance" case — a model that hallucinates a partial payment here
  would be a real, visible bug.

### Fixture 7 — EOB PDF, `eob-3-minimal-single-line.pdf` (+ `.expected.json`) — smallest-size stress test

Same generator, scenario `"minimalSingleLine"`, seed 1009 (added 2026-07-18 to stress-test the
smallest end of what the extraction schema allows) — a single 1-page PDF with exactly **one claim,
one line**: `claim-minimalSingleLine-1009-0`, billed 21.00 SAR, paid 18.90 SAR, no denial.

- **With AI-4 off (verified):** same clean failure message as Fixture 5.
- **With AI-4 on:** upload it, open the Review queue, and compare against
  `eob-3-minimal-single-line.expected.json` — expect exactly one claim, one line, and
  `remittanceTotalPaidHalalas: 1890`. This checks the opposite failure mode from Fixture 8 below: a
  claim/line loop that silently drops the only row, or renders an empty table, on a minimal
  document.

### Fixture 8 — EOB PDF, `eob-4-dense-large-remittance.pdf` (+ `.expected.json`) — largest-size stress test

Same generator, scenario `"denseLargeRemittance"`, seed 1010 (added 2026-07-18) — a real **4-page**
PDF (confirmed via `file docs/test-fixtures/eob-4-dense-large-remittance.pdf`), **8 claims x 6 lines
= 48 lines**, well past every other fixture's size. Denials (`TWD-D02`, `TWD-D05`, `TWD-D06`,
`TWD-D08`) and one contractual adjustment (200 halalas) are spread across claims 0, 2, 4, 5, and 7 —
not just the first claim — so cross-page/cross-claim extraction is exercised, not just per-claim
arithmetic on page 1. `remittanceTotalPaidHalalas: 114730`.

- **With AI-4 off (verified):** same clean failure message as Fixture 5.
- **With AI-4 on:** upload it, open the Review queue, and compare against
  `eob-4-dense-large-remittance.expected.json` — expect all 8 claims present (not just the ones on
  the PDF's first page), 48 total lines, the 4 denial codes above on their respective claims, and
  the one adjustment on claim index 4's third line. A model or extraction pipeline that only reads
  the first PDF page would silently truncate to 1-2 claims here — this fixture is what would catch
  that class of bug in manual testing.

### After using any of these fixtures

Re-seed (§1.5) to return to the standard demo dataset before continuing the rest of the walkthrough
— the fixtures above add extra claims on top of the seed data rather than replacing it, so they'll
otherwise keep showing up in Scrubber/Ingest for the rest of your session.

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
│   ├── ingest           ← read CSV/TSV real-world exports + PDF text-layer/OCR seam
│   ├── ai               ← the ONLY package that talks to an LLM
│   ├── platform         ← swappable infra (object store, KMS, OIDC)
│   ├── (test/synthetic-fhir) ← generates fake claims for dev/tests
│   └── (test/synthetic-eob)  ← generates fake EOB/remittance ground truth for AI-4
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
2. **PHI-free by construction — true for AI-1/2/3, deliberately NOT true for AI-4.** For AI-1/2/3 the inputs sent to the model are built from **rule metadata and generic templates**, not patient data; where an identifier is needed (e.g., a member id in an appeal), it's **pseudonymized** (tokenized) before the call and **de-tokenized after**; date of birth becomes an age band; free text is excluded; a runtime guard rejects any unexpected field. **AI-4 breaks this pattern on purpose:** it sends whole PDF pages to a vision model, and a *real* remittance PDF would contain genuine PHI (patient names, member IDs, service dates) with no way to redact it before the model needs to read it. That's exactly why AI-4 is scoped to **synthetic PDFs only** for now — the PHI-free property this codebase otherwise guarantees can't hold for a vision-OCR feature, so enabling it on real documents is a policy decision (route + counsel sign-off), not a flag flip. See `docs/blocker.md` BLK-AI-1/3/4.
3. **Audited on every attempt.** Every call — success, schema-parse failure, or network/timeout error — writes an `llm_calls` row. It stores **only SHA-256 hashes** of prompt and output, never the raw text. The audit write is fail-closed: if a successful, billable call *can't* be audited, the answer is **discarded** rather than served un-audited (and it logs loudly so ops can tell an audit-DB outage from a deliberate off-switch).
4. **No connection held across the network call.** The LLM call happens *outside* any database transaction; each DB step opens its own short transaction. So a slow/hung AI request can't hold a Postgres connection and starve other tenants (a real availability/DoS concern that was caught in review and fixed).
5. **Structured, validated output.** The model is forced to return JSON matching a Zod schema (bilingual explanation, appeal paragraphs, or a structured rule). If it doesn't validate, the call fails rather than passing malformed data downstream.

The four features, and their guardrails:

- **AI-1 Explain (Haiku model):** cheapest model; output is a bilingual explanation cached per (tenant, rule, version) so you don't pay twice. The web action re-derives the prompt server-side from the rule library — no client text reaches the model. It's also rate-limited per actor.
- **AI-2 Appeal Assist (Opus + a Sonnet "judge"):** produces suggested paragraphs, then a second model pass verifies them. **Anti-hallucination is structural:** the draft uses digit-free slot tokens, so *any literal digit the model invents is treated as a hallucination and suppressed*. The member id is pseudonymized and de-tokenized last. Suggestions are clearly labelled DRAFT; a human must insert/edit them; edit-distance is tracked as a quality metric.
- **AI-3 Rule Authoring (Opus):** a sentence → a structured `ScrubRule` **draft**, which must pass a **deterministic gate** (shape vs registry → engine dry-run → golden-set regression) before it can even be approved. It's persisted **DISABLED** and only a human with the right role can approve it (server-enforced). Nothing the AI writes executes automatically.
- **AI-4 EOB/PDF Extraction (Sonnet, escalating to Opus):** a PDF goes to Sonnet first (cheaper); a **deterministic validator** (`validateEobExtraction`/`validateEobExtractionArithmetic` in `packages/ai/src/eob-validators.ts`) cross-checks the extracted claim-line totals against the claimed remittance total and, when a text layer exists, against the PDF's own embedded text. If Sonnet's output fails validation *or the Sonnet call itself throws*, the system automatically retries once with **Opus** (the more capable, more expensive model) — escalation is symmetric to both failure modes, not just a bad answer. The result — whichever model tier produced it, its confidence, and the full validator report — lands as a `pending_review` row in `eob_extractions` (its own tenant-scoped, RLS-protected table). **Nothing is written to a real claim/denial record from this pipeline** — a human reviews every field, and re-approving re-runs the arithmetic validator on the human-edited values before persisting, so a hand-edit can't silently break the totals either.

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

- **Unit tests (Vitest, ≈ pytest/JUnit):** pure logic, utilities, the AI code via a **fixture provider** (record/replay, so CI never calls the real API or needs a key). Baseline **769 passing** (up from 708 pre-EXECUTE-UI-tail, 444 pre-AI-4).
- **Integration tests:** run against a real Postgres, single-fork, **destructive**. They prove migrations, RLS enforcement, append-only privileges, and money reconciliation. Baseline **37 passing** (up from ~33 pre-AI-4).
- **Live eval harness (AI-4 only, `packages/ai/evals/*.eval.ts`):** gated behind `AI_EVALS_LIVE=1`, never runs in CI or `pnpm test`. **UPDATE 2026-07-10 (AI-4 real-data-gaps unit):** the HTML→PDF rasterizer this section used to say was missing is now built and wired. **UPDATE 2026-07-18 — run for the first time, scoring bug found AND fixed, real numbers in hand.** Two blockers cleared before it could even execute: (1) `extractEob.eval.ts`'s own `env: {...}` literal fully shadowed `process.env`, hiding the configured `ANTHROPIC_API_KEY` — fixed (same bug in `explainFlag.eval.ts`, also fixed); (2) the file's hardcoded `120_000`ms per-tier timeout was too short for 40 real sequential API calls, bumped to `900_000`. The real root cause: the synthetic corpus's `buildHtmlTemplate` (`test/synthetic-eob/src/generate.ts`) never rendered `patientRef`/`serviceDate`/`claimId` into the actual PDF the vision model sees, so claim-matching (keyed on the invisible `claimId`) failed and cascaded every nested field to ~0. **Fixed at the source**: those fields are now rendered into the document, and `scoring.ts` now matches on `nphiesClaimId` (falling back to `claimId`) — production's own established fallback pattern. Full 40-item × 2-tier live run: **Sonnet 96.6% overall / 100% amounts, 0 hallucinated — meets both documented targets. Opus 87.1% overall / 100% amounts — meets amounts only, codes underperform Sonnet's** (a model-behavior difference, not a bug). AI-4 is confirmed working well; this was a broken measurement, never a broken feature. **UPDATE 2026-07-18, same day: corpus grew to 44 items/11 scenarios (added a smallest- and largest-size stress pair) and immediately caught a real production bug** — Sonnet 5's default adaptive-thinking budget was drawn from the same `max_tokens: 8192` ceiling as the response, so the 48-line `denseLargeRemittance` scenario truncated mid-JSON and threw a hard parse error (`stop_reason: "max_tokens"`), not just a low score. Fixed in production code (`extractEob.ts`'s `maxTokens` → `32768`), confirmed via live repro, then a clean 44-item re-run: **Sonnet 98.1% overall / 100% amounts, 0 hallucinated. Opus 83.5% overall / 99.9% amounts**, codes weaker at scale (360/924).
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
| XLSX ingest | Typed adapter **stub** | Inject SheetJS |
| PDF-OCR ingest (AI-4) | **Implemented and tested on synthetic PDFs** (`ClaudeVisionOcrAdapter`) — this is no longer a stub, but it is **gated off real data**: no real partner document may reach it until BLK-AI-1/3/4 clear | Route decision (cloud vs. self-hosted VLM) + counsel PDPL sign-off, then real documents |
| Synthetic-EOB → PDF rasterizer | **Built 2026-07-10** (`test/synthetic-eob/src/rasterize.ts`, Playwright headless Chromium `page.pdf()`, eval-harness-only — never imported into `apps/web`'s runtime) | A live-scored `AI_EVALS_LIVE=1` run against the real API (manual/CI-scheduled, not part of the build) |
| The headline "recovered SAR on a real clinic" | Synthetic | Needs a real design partner's data (`BLK-1`) + SME-reviewed taxonomy (`BLK-9`) |
| A3 report PDF generation | Browser print-to-PDF (`window.print()` + `print:` CSS) | A server-side PDF render pipeline, if a non-interactive export is ever required |
| A3's "projected recovery range" | A 15 to 35 percent conservative modeled estimate (badged `MOCK`) until a tenant has resolved appeals of its own; then a real historical-win-rate band | Same mechanism at scale, more data to narrow the band |

If you see a `TODO(nphies-creds)` or `TODO(ksa-oidc)` comment, that's a **known, intentional stub**, not a bug.

## 2.11 Known issues, risks & deferred items

From the deploy-readiness ledger (`docs/ai-deploy-readiness.md`) and handoff notes. None are release-blockers on the synthetic build; all are documented:

- **Normalizer missing-amount → `0.00` (BLK-1 latent):** a missing adjudication amount currently becomes `"0.00"` instead of quarantining, which would *understate* denied/at-risk money. It **can't trigger today** (the synthetic generator always sets an amount), but the correct real-data behavior (quarantine vs throw) is a decision to make when real data (BLK-1) arrives. Money-adjacent — treat as a must-fix before real data.
- ~~**Accessibility — table row semantics:** the Scrubber uses `<tr role="button">` for clickable rows, which strips proper row semantics for screen readers. Flagged, deferred.~~ **RESOLVED** (WCAG AA accessibility audit, `docs/a11y.md` #21, commit `516e72d`): native `<tr>`/`<td>` semantics restored (no `role`/`tabIndex` override), and the row's own mouse-only `onClick`/`cursor-pointer` was removed rather than papered over with a second `role="button"` — the nested claim-ID `<button>` (already `.focus-ring` + `aria-label`'d) is the row's one and only control. Regression-tested in `apps/web/test/scrubber-table.test.tsx` (7 tests: row/cell roles survive, the button is the sole interactive element, keyboard activation works, AR-locale aria-label) — reconfirmed green (7/7) 2026-07-10.
- **drizzle-kit journal stale:** the migration tool's journal isn't snapshotted for `0001`–`0007`, so `pnpm db:generate` can emit duplicate DDL. Dev-tooling annoyance only; the custom migrator applies all `.sql` files in order correctly.
- **Local runtime smoke (chrome-devtools):** couldn't run locally (Node 20.2.0 blocks local Playwright/devtools driving); covered instead by CI E2E + a11y. If you get a newer Node in a separate environment, a manual devtools pass across config states × EN/AR × light/dark would close this.
- **Rate limiting is per-instance/in-memory** for the AI explain action — fine for one server, needs a shared store (e.g., Redis) at horizontal scale. Documented as a known residual.
- **AI-4 eval harness scored a real, trustworthy model pass, then caught a real production bug via size-diversity fixtures (both 2026-07-18).** See §2.9's 2026-07-18 updates: the corpus's rendering bug and the matching-key bug are both fixed; a same-day follow-up grew the corpus to 44 items/11 scenarios (smallest- and largest-size stress pair), which reproduced a genuine `extractEob.ts` extraction failure on large documents (Sonnet 5's default adaptive thinking exhausting the 8192-token `max_tokens` ceiling before the JSON output finished) — fixed by raising `maxTokens` to `32768`. Final numbers against the 98%/95% thresholds in `packages/ai/evals/scoring.ts`: **Sonnet 98.1% overall / 100% amounts** — meets and exceeds both. **Opus 83.5% overall / 99.9% amounts** (codes underperform Sonnet's at scale, flagged as a minor follow-up, not blocking).
- ~~**AI-4's arithmetic validator has no adjustment/withholding bucket.**~~ **RESOLVED 2026-07-10.** A 5th `adjustmentHalalas`/`totalAdjustmentHalalas` bucket now exists end to end: `packages/ai/src/schemas/eobExtraction.ts` (schema), `packages/ai/src/eob-validators.ts` (cross-total + a generalized non-negativity guard covering all five buckets, added after an adversarial money-path pass found the first-draft guard only covered `adjustmentHalalas` itself and a sign-cancelling `paid > billed` bypass was still open through the other four), `apps/web/lib/actions/eob-review.ts` + `eob-extraction-form.tsx` (reviewer edit/display), `packages/ai/evals/scoring.ts` (eval scoring), and a new `contractualAdjustment` synthetic scenario so the (now-live) eval harness actually exercises it. A real remittance with a contractual write-off is no longer permanently stuck at "reject only." Deliberately NOT persisted into `ClaimRow`/`ClaimResponseRow`/`DenialRow` (`apps/web/lib/eob-to-normalized.ts`) — no DB column exists for it and stuffing it into `denials` would wrongly mark a non-appealable write-off as appealable; a documented `TODO(ai-route)` + two pinning tests track that as a separate, deliberate follow-up (schema migration + analytics decision), not a silent gap. See `docs/handoff.md`'s AI-4 real-data-gaps entry for the full build + the dedicated money-path adversarial-scrutiny findings.
- **AI-4's PHI/cross-border pre-enable checklist lives in `docs/blocker.md` (BLK-AI-1), not here** — e.g., confirming error-path logging doesn't capture field-level extraction values, and confirming what a `TAWEED_AI_EXTRACT_EOB_ENABLED` flag-flip means for the `inference_geo` setting (cross-border data transfer) before any real document is ever processed. Read that blocker before touching the production route decision.
- **Deliberately-parked optimizations live in `docs/deferred.md` (`DEF-*`), not here** — work we've *chosen not to build yet* (as opposed to issues in code that exists). The current entry is **DEF-1: text-layer-first extraction routing for born-digital EOB PDFs** — a cost/latency tuning of AI-4 that the 2026-07-16 calculation parked (negligible savings at pre-pilot volume; no compliance benefit as designed; not the highest-value next step). Each entry carries the rationale and the concrete trigger that would flip it to worth-doing.

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
2. Do the full click-through (§1.8) with AI off, then on (§1.10), including AI-4's Review queue (§Step 3b).
3. Read `docs/handoff.md`, `docs/ai-deploy-readiness.md`, and `docs/blocker.md` — they're the living project memory.
4. AI-0 through AI-4 are all built on synthetic data, and the EXECUTE phase's entire buildable pass — including the UI tail (A2 first-run corridor, A3 free-audit + owner report) and the B6 CSV/TSV field-mapping panel (§Step 3a) — is now built too, closing out the EXECUTE build plan entirely; check `docs/NEXT_STEP_PROMPT.md` for the current pointer to whatever's next. Two concrete gaps that used to sit before AI-4 seeing real data are now both closed: the synthetic-EOB→PDF rasterizer is built (§2.9) and the adjustment/withholding bucket is in the extraction schema (§2.11). With an `ANTHROPIC_API_KEY` now configured too, the last remaining eval task is simply to **run** `AI_EVALS_LIVE=1` against the synthetic corpus and read the scored accuracy (§1.11). The real-data headline itself still waits on the external blockers (BLK-1/2/9) and, for AI-4 specifically, the production-route decision + counsel sign-off + ZDR/DPA (BLK-AI-1/3/4 and the ZDR/DPA part of BLK-AI-2) — see `docs/blocker.md`.

## 2.13 Beginner glossary

| Term | Plain meaning |
|------|---------------|
| **NPHIES** | Saudi Arabia's national platform for exchanging health insurance claims |
| **FHIR** | A healthcare data standard (the format claims come in); R4 is a version |
| **PHI** | Protected Health Information — patient data that must be guarded |
| **Claim / Denial / Appeal** | A bill to an insurer / the insurer refusing it / the clinic contesting the refusal |
| **EOB** | Explanation of Benefits — the insurer's remittance document showing what it actually paid/denied per claim line; AI-4 extracts structured data from a scanned/PDF EOB |
| **Escalation (Sonnet → Opus)** | AI-4's retry pattern: try the cheaper model first, automatically retry with the more capable one if validation fails or the call errors |
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

## 2.14 Blocked functions/features — exact map (function → blocker → what turns on)

Every stub below is a **typed swap**: interface real and tested, only the concrete implementation
waits on a human/external input. Full blocker detail + paste-ready unblock prompts: `docs/blocker.md`.
None of this blocks the synthetic-data product — everything here is Phase 2 / DEPLOY / real-data-only.

| Function / feature | File:line | Blocked on | What works once cleared |
|---|---|---|---|
| `validateAgainstNphiesProfile()` | `packages/fhir/src/nphies-profile.ts:12` | **BLK-6** (IG bundling rights) | Real NPHIES IG/profile validation replaces the base-R4-only hand-rolled check |
| NPHIES live submission + eligibility client | `packages/nphies-client` (not yet created — scaffolded by BLK-3) | **BLK-3 → BLK-4 → BLK-5** (Academy → PKI → sandbox/conformance) | Direct live claim submission + real-time eligibility to NPHIES |
| `DENIAL_REASON_CODES` (8 placeholder `TWD-*`) | `packages/shared/src/denial-codes.ts:13` | **BLK-2** (real NPHIES denial-reason codes) | Scrubber/appeals reference real adjudication codes instead of fake taxonomy |
| Appeal-deadline countdown (hash-derived placeholder) | `apps/web/lib/appeals-data.ts:28` | **BLK-2** (per-payer deadline matrix) | Countdown shows the real per-payer reconsideration window, not a hash |
| Rule thresholds / SBS codes / payer mappings | `packages/rules-engine/src/rules.ts:8` | **BLK-2** (SBS/ICD-10-AM/denial codes) + **BLK-9** (SME sign-off) | Scrubber flags fire on real coding regime instead of placeholder codes |
| Arabic appeal templates, doc checklists, payer conventions | `packages/appeals/src/templates.ts:9,306` | **BLK-2** (real codes) + **BLK-9** (KSA-RCM SME sign-off) | Appeal letters clinically/linguistically correct enough to ship to a real clinic — **hard gate**, no real appeal goes out before BLK-9 |
| Arabic glossary/billing terminology | `packages/shared/src/glossary.ts:7` | **BLK-9** (SME sign-off) | MSA billing wording confirmed correct by a KSA RCM SME |
| `claimToFactsReal()` vs `claimToFactsSynthetic()` dispatch (`projectClaimFacts`) | `packages/rules-engine/src/project.ts:101,143,194` | **BLK-1** (real partner data) | `data_origin` flips a claim from `synthetic`→`production`; the synthetic hash projection is already hard-guarded to refuse production-tagged claims (EXECUTE B5 gate) — real column signals (pre-auth/eligibility/duplicate/documentation) drive the scrubber instead |
| Per-tenant dimension resolution from real uploads | `apps/web/lib/actions/ingest.ts:112`, `apps/web/lib/actions/ingest-csv.ts:238` | **BLK-1** (design-partner data) | Real branches/providers/payers/patients created from the partner's own data, instead of mapping onto the tenant's first seeded dimension (current documented CSV-path simplification) |
| Normalizer missing-amount handling | `apps/web/lib/eob-to-normalized.ts:124` (see §2.11 "BLK-1 latent") | **BLK-1** | Decide quarantine-vs-`0.00` for a real missing adjudication amount — can't trigger on synthetic data (generator always sets an amount), must be fixed before real data lands |
| Recovery baseline capture at onboarding | `apps/web/lib/data.ts` (`getRecovery`, `recovery_baselines`) | **BLK-1** | Recovered-SAR counter has a real starting baseline instead of a synthetic one |
| Auth provider (dev credentials picker) | `apps/web/lib/auth.ts:25`, `apps/web/app/[locale]/(auth)/login/page.tsx:12` | **BLK-7** (KSA-resident OIDC — provider not yet even chosen) | Production login via a real KSA-resident, PDPL-compliant IdP; dev picker stays for local-only behind `TAWEED_ENABLE_DEV_AUTH` |
| DB/session credential source | `apps/web/lib/db.ts:19` | **BLK-7** + **BLK-8** | Real secrets-manager-sourced DB credentials instead of dev env values |
| KSA OIDC config loader | `packages/platform/src/oidc.ts:7,33` (`ksaOidcConfigFromEnv`) | **BLK-7** | Already has a typed config shape waiting for a real issuer/client — just needs the chosen IdP's values |
| Object store + KMS | `@taweed/platform` (in-memory dev impl) | **BLK-8** (Oracle Cloud Riyadh creds) | Real KSA-region S3-compatible storage + per-tenant KMS envelope encryption for raw bundles/documents |
| `infra/` Terraform | Does not exist yet — authored from scratch when BLK-8 clears | **BLK-8** | Applied infrastructure in `me-riyadh-1`, not just a skeleton |
| XLSX ingest adapter | typed adapter stub (SheetJS not injected) | none blocking — buildable now, just not built | Real spreadsheet ingest, same field-mapping panel as CSV |
| `AzureDocIntelOcrAdapter` | `packages/ingest/src/adapters/azure-doc-intel-adapter.ts:13,18` | **BLK-AI-1/2** (counsel + Anthropic org/ZDR) if this route is chosen, or a separate Azure decision | Alternate OCR/extraction backend for scanned EOBs |
| `SelfHostedVlmAdapter` | `packages/ai/src/adapters/selfhosted-vlm-adapter.ts:16,22` | **BLK-AI-3** (OCI Riyadh GPU quota/pricing) — only if self-host route chosen for AI-4 | Zero-cross-border PDF extraction, no data leaving KSA |
| `ClaudeVisionOcrAdapter` on **real** documents (already built + tested on synthetic PDFs) | `packages/ai/src/adapters/claude-vision-ocr.ts` | **BLK-AI-1** (counsel sign-off incl. the two concrete pre-enable checks: `INFERENCE_GEO` cross-border flag-flip; `errorReport()` field-level-leak risk in `apps/web/components/modules/eob-review/eob-extraction-form.tsx`) + **BLK-AI-2** (Anthropic org + ZDR + DPA) | Real remittance/EOB PDFs go through AI-4 extraction instead of only synthetic ones — flip `TAWEED_AI_EXTRACT_EOB_ENABLED` |
| Adjustment/withholding bucket persistence | `apps/web/lib/eob-to-normalized.ts:100,129` (`TODO(ai-route)`) | schema migration decision, buildable now, deliberately deferred (not a blocker) | Contractual write-offs flow into `ClaimRow`/`DenialRow` instead of staying display-only in `eob_extractions` |
| Live LLM calls of any kind (AI-1/AI-2/AI-3/AI-4 beyond fixtures) | `packages/ai/src/adapters/anthropic-1p.ts` | **Key added** → live calls on synthetic / PHI-free inputs now reach the real API. The **ZDR + DPA** part of **BLK-AI-2** (+ **BLK-AI-1** counsel) still gates any call carrying **real PHI** | `TAWEED_AI_ENABLED=true` actually reaches the real API instead of `FixtureProvider`/deterministic fallback (synthetic/PHI-free only until BLK-AI-1/2 fully clear) |
| `AI_EVALS_LIVE=1` scored eval run — real number, not the artifact-dominated 2026-07-18 one | `packages/ai/evals/scoring.ts`, `packages/ai/evals/extractEob.eval.ts` | Design decision on claim-matching key (`claimId` vs `nphiesClaimId`) — see `docs/NEXT_STEP_PROMPT.md`, not an external blocker | The 98%/95% accuracy thresholds become proven results instead of a scoring-artifact number |

**Read this table alongside, not instead of:** §2.10 (stub inventory), §2.11 (deferred items),
`docs/blocker.md` (per-blocker paste-ready unblock prompts — copy the prompt for the cleared blocker
into a fresh session to build the real feature immediately), and `docs/deferred.md` (`DEF-*` —
deliberately-parked optimizations with their revisit triggers, e.g. DEF-1 text-layer-first routing).
