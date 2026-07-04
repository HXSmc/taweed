# 04 — CREATE Step Summary (plain-language)

> What got built in the CREATE step, in the simplest form. Companion to `02_product_build_plan.md` (§2 CREATE, §8 wk1–3).

## What we built

We built the **data plumbing** — no screens yet.

Goal of this step: prove that a NPHIES insurance claim file can be read by our code and turned into clean database rows. Nothing else.

The chain we proved works:

```
fake claim file  →  read it  →  reshape it  →  save it to the database
   (generator)      (parser)   (normalizer)      (Postgres)
```

In plain terms:
1. **Generator** — makes fake-but-valid NPHIES `Claim` + `ClaimResponse` files (denials, partial denials, missing pre-auth, Arabic/English, etc.). No real patient data.
2. **Parser** — reads those files, checks they're valid FHIR, pairs each claim with its response.
3. **Normalizer** — turns the messy claim into tidy rows: one row per billed line, and one row per denied line/reason.
4. **Database** — saves the rows in Postgres, with **tenant isolation** (each clinic can only ever see its own data, enforced by the database itself).

## Proof it works
- Automated tests: **56 unit tests + 3 database tests, all passing.**
- One test runs the *whole* chain into a real Postgres and confirms Clinic A cannot see Clinic B's data.

## What is deliberately NOT built yet
- No website/dashboard (the `apps/web` folder is an empty placeholder).
- No login, no rules engine, no appeal letters, no analytics.
- No real NPHIES codes — placeholders tagged `TODO(nphies-creds)` until we get official access.

## Anything real still missing?
Yes, on purpose: we still need to feed it **one real (de-identified) NPHIES file** and have a **Saudi billing expert check the denial-reason list**. Everything is structured so that's a drop-in later, not a rebuild.

---

## Can it be hosted on Vercel now?

**Short answer: you *could* deploy it, but it's a bad idea as a real host right now.** Only useful as a throwaway placeholder.

### Why it's pointless today
- The website part is **empty** — there are no screens to show. You'd deploy a blank page.
- The real value (the data pipeline) is **backend + database**, which isn't something a visitor "sees."

### Why it's the wrong host for the real product (the important reason)
- **Data residency (PDPL law).** Saudi rules require patient data to stay **inside the Kingdom**. Vercel has **no Saudi region**, so putting real patient data on it would break the law we're building around (build-plan §4/§6). The planned real home is **Oracle Cloud Riyadh** (`me-riyadh-1`), which is in-Kingdom.
- **It needs a database Vercel doesn't provide.** Our pipeline needs Postgres with tenant isolation. Vercel runs the web app but not the database — you'd still need a managed Postgres, and for real data that Postgres must also be in-Kingdom.
- **Serverless + database quirks.** Vercel's serverless functions can exhaust database connections without careful pooling — solvable, but extra work for zero payoff at this stage.

### When Vercel *is* fine
- Later, as a **demo/preview** using **synthetic (fake) data only** — no real PHI. Good for showing the UI to a design partner.
- Real, PHI-carrying production: **use the in-Kingdom host, not Vercel.**

**Bottom line:** don't host it on Vercel as the product. Fine only as a fake-data demo once there's actually a UI to look at.
