# Human Confirmation Needed
### Things research could NOT confirm — and exactly what you must do

> Companion to `01_market_and_gtm.md` + `02_product_build_plan.md`.
> Everything here is **unverified** or **needs a human action** (a phone call, a counsel review, a price quote). It is **not** a list of facts — it is a list of *gaps*.
> Status key: ❌ no primary source found · ⚠️ verify-before-citing · 🔒 only obtainable by contacting a person/org directly.
> Priority: 🔴 blocks a real decision · 🟡 important before scaling · 🟢 cleanup / nice-to-have.

---

## A. Market & denial economics (your ROI pitch rests on this)

### A1. 🔴❌ National private-insurance **denial / rejection rate %**
- **What's unconfirmed:** the "~25% of claims denied" number. No primary source. It traces to vendor blogs (refuted in verification).
- **What you have instead:** a single Najran public-hospital peer-reviewed *coding-error* rate (26.8% primary / 9.9% secondary) — real but **not** a national denial rate, and not private-insurance-specific.
- **What to do:**
  1. Email/call **CHI (Council of Health Insurance, chi.gov.sa)** — ask for the **denial/rejection rate** in their annual report or NPHIES statistics.
  2. Download + read CHI **annual report PDFs** (figures, if any, live inside the PDFs — not on the website index).
  3. Ask a friendly **design-partner clinic** for their *actual* denial rate from their NPHIES `ClaimResponse` data (this is the free-audit motion — your most reliable number).
- **Why it matters:** it's the headline of your sales pitch. Until you have it, lead with the **free audit** (their own number), never a quoted national stat.

### A2. 🔴❌ National **annual denied-claim value (SAR)**
- **What's unconfirmed:** "~SAR 3B denied/year" (and a vendor "3.5–4.5B"). Both **refuted** — no primary source.
- **What to do:** same as A1 — CHI annual-report PDFs + NPHIES dashboards. Ask CHI directly for total denied/rejected claim value.
- **Why it matters:** it sizes the whole market (your TAM story). Don't put a national SAR figure on a deck until sourced.

### A3. 🟡⚠️ Najran coding-error study figures (the ONE primary anchor you do have)
- **What's confirmed:** 26.8% / 9.9% miscoding, SAR 12,927 loss — **single hospital, public, not insurance-specific.**
- **What to do:** read the source PDFs yourself before quoting ([F1000Research](https://f1000research.com/articles/13-820), [PMC11342027](https://pmc.ncbi.nlm.nih.gov/articles/PMC11342027/)). Always say "single-hospital study" when you cite it. **Do not** present it as a market-wide rate.

---

## B. NPHIES technical onboarding (Phase 2 — blocks live integration, NOT the MVP)

> All three below are 🔒 — **not public, not secret.** One call to NPHIES/CHI (and one to Waseel) answers all of them. None block your MVP (MVP = file upload, no NPHIES connection).

### B1. 🔴🔒 **PKI certificate issuance process**
- **What's unconfirmed:** *how* you actually obtain the digital ID badge (certificate + private key) that authenticates your software to NPHIES. We confirmed a "certificate of integration" exists after testing — not how to get the PKI.
- **What to do:** contact the **NPHIES onboarding team** (via [portal.nphies.sa](https://portal.nphies.sa) / CHI). Ask: *Who issues the PKI cert? What documents/prerequisites? Timeline? Renewal? Cost (if any)?*

### B2. 🔴🔒 **Conformance / sandbox testing steps**
- **What's unconfirmed:** the exact steps to get **sandbox (test environment) access** and pass **conformance testing** before going to production.
- **What to do:** ask NPHIES onboarding: *How do we get sandbox credentials? What's the conformance test set? Manual or automated review? How long to certification?*

### B3. 🔴🔒 **Clearinghouse REQUIRED vs. direct integration allowed**
- **What's unconfirmed:** whether NPHIES lets you connect **directly**, or whether you must go through a **clearinghouse** middleman (e.g. Waseel). This changes your Phase-2 architecture **and** cost.
- **What to do:**
  1. Ask **NPHIES/CHI:** *Can a provider/vendor integrate directly, or is a clearinghouse mandatory?*
  2. Ask **Waseel** ([waseel.com/connect](https://waseel.com/connect/)) for a **quote + integration scope** as the clearinghouse option (their published Connect tiers: SAR 1,499–1,999/mo, but confirm what your use needs).
- **Why it matters:** "direct" = more build, full control; "clearinghouse" = faster, ongoing fee + dependency. You can't price Phase 2 without this answer.

---

## C. Compliance & hosting (mostly RESOLVED — residual human checks)

### C1. 🟡✅→🔒 PDPL cross-border — framework confirmed, operational sign-off needed
- **What's confirmed (3-0):** SDAIA Transfer Regulation — no localization ban; adequacy list; SCC/BCR/Certificate safeguards; **sensitive/health data gets the stricter path.** Keep PHI **in-Kingdom** = clean.
- **What to do (human):** have **KSA privacy counsel** review your final data-flow + write the **DPA** (data processing agreement) wording with clinics, and confirm nothing in your stack quietly sends PHI abroad (logging, analytics, backups, email).
- **Why it matters:** the law is clear; the *implementation* (your actual architecture) still needs a lawyer's eyes before GA.

### C2. 🟢✅ CBAHI — resolved (no action)
- **Confirmed (3-0):** CBAHI accredits **facilities/providers, not software vendors.** No CBAHI requirement on you. (Nice-to-have: support clinics' accreditation/data-quality goals as a selling point.)

### C3. 🟡✅→🔒 AWS Saudi region — confirmed NOT-yet-GA; timing risk
- **Confirmed (3-0):** AWS Saudi region is **announced/planned for 2026, not yet live (GA).** Azure KSA = Q4 2026. Google/Oracle in-Kingdom region **unconfirmed (❌)**.
- **What to do (human):** at build time, **check AWS's current GA status** directly; if you need in-Kingdom hosting *before* AWS/Azure go live, evaluate a **local/KSA-based hosting provider** as interim. Verify Google/Oracle KSA region availability if you want more options.
- **Why it matters:** if the region isn't GA when you need to launch, your residency plan has a gap.

---

## D. Competitors (pricing partly resolved)

### D1. 🟢✅ Waseel & Insta pricing — confirmed (no action)
- Waseel Connect: SAR 1,499–1,999/mo (transaction-tiered). Insta KSA HMS: SAR 190–225/user/mo (Oracle Cloud). *Insta is HMS seat pricing, not a denial-module-specific price — confirm the denial-module price in a demo if it matters.*

### D2. 🟡❌ HealthOrbit / Ecaresoft pricing — not found
- **What to do:** book demos or request quotes; check G2/Capterra. Confirm each competitor's **actual NPHIES integration depth** (Insta showed denial workflows but **no documented NPHIES integration**).

---

## E. Target account list (verify before CRM load / outreach)

### E1. 🟡⚠️ Branch counts + insured-mix for rows tagged (M)/(L)
- **What's unconfirmed:** exact branch counts and how insured-heavy vs. cash-pay several clinic groups are (File 1 §6). KSA clinics often list branches on Instagram/Snapchat/Google Maps, not their site.
- **What to do:** before loading into CRM, confirm each (M)/(L) row's **branch count** (Google Maps / their "Branches" page) and **insured mix** (a quick call or their booking flow). Prioritize **fit-5 + insured-heavy**; deprioritize cash-pay cosmetic.

### E2. 🟡❌ "Nabda" seed — brand not cleanly resolved
- **What's unconfirmed:** which "Nabda/نبضة" you meant. Research found only a single-site IVF unit + unrelated entities.
- **What to do:** confirm the **intended brand/spelling** (give the website or city) so it can be verified or dropped.

---

## F. Research artifacts to verify before citing (File 2 §12)

### F1. 🟢⚠️ Two paper citations look shaky
- `arXiv:2602.05374` ("Feb 2026") has an **implausible/future ID** — confirm it exists before citing.
- The SUNY Binghamton three-stage-denial **thesis URL is malformed** — find a stable citation or drop it.

### F2. 🟢⚠️ `Fadil369/NPHIES` GitHub repo
- Flagged **early-stage / low-star.** Confirm it exists, its license, and what's actually implemented before treating it as an architecture reference.

### F3. 🟡🔒 NPHIES IG package — confirm reuse/bundling terms
- The NPHIES Implementation Guide (StructureDefinitions/ValueSets) is **governed by NPHIES/CCHI, not a standard open-source license.** Before you bundle it into your product/CI, **confirm you're allowed to redistribute it** (ask NPHIES/CHI).

---

## Quick action plan (do these first)

| # | Action | Who to contact | Unblocks |
|---|---|---|---|
| 1 | Ask for denial rate + denied-SAR figures; get annual-report PDFs | **CHI (chi.gov.sa)** | A1, A2 |
| 2 | Ask PKI issuance + sandbox/conformance + direct-vs-clearinghouse | **NPHIES onboarding (portal.nphies.sa / CHI)** | B1, B2, B3 |
| 3 | Get clearinghouse quote + integration scope | **Waseel** | B3, D1 |
| 4 | Review data-flow, write DPA, confirm no PHI leaves Kingdom | **KSA privacy counsel** | C1 |
| 5 | Confirm AWS/Azure KSA GA status at build time; check local host | **AWS / local KSA host** | C3 |
| 6 | Run free denial audits on real clinic data | **Design-partner clinics** | A1, A2 (your best path) |
| 7 | Verify branch counts/insured-mix; confirm "Nabda" | **Manual / each clinic** | E1, E2 |

> **Bottom line:** none of these block the **MVP** (file upload → analytics → scrub → appeals, no NPHIES connection). They block **Phase 2 (live NPHIES)**, **the market-size claims on your deck**, and **GA hosting**. Items 1, 2, 6 are the highest leverage — two emails/calls + your first free audit resolve most of the red items.
