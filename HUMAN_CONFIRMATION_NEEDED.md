# Human Confirmation Needed
### Things research could NOT confirm — and exactly what you must do

> Companion to `01_market_and_gtm.md` + `02_product_build_plan.md`.
> Everything here is **unverified** or **needs a human action** (a phone call, a counsel review, a price quote). It is **not** a list of facts — it is a list of *gaps*.
> Status key: ❌ no primary source found · ⚠️ verify-before-citing · 🔒 only obtainable by contacting a person/org directly.
> Priority: 🔴 blocks a real decision · 🟡 important before scaling · 🟢 cleanup / nice-to-have.
>
> **🔬 Research update 2026-07-01** (two deep-research passes, ~200 agents total — full log in `RESEARCH_FINDINGS_2026-07-01.md`). Resolved: **CHI annual-report PDFs found + read in full** (A1/A2), **Oracle Cloud Riyadh region confirmed LIVE** (C3), **Waseel pricing confirmed primary** (D1), **clearinghouse does NOT confirmedly remove your PKI/conformance duties** (B1/B2/B3), **D2 vendor depth**, **F1–F3 artifacts**. Remaining items are now human-action calls (CHI direct ask; NPHIES/Waseel scope call; counsel), not research gaps.

---

## A. Market & denial economics (your ROI pitch rests on this)

### A1. 🔴❌ National private-insurance **denial / rejection rate %**
- **What's unconfirmed:** the "~25% of claims denied" number. No primary source. It traces to vendor blogs (refuted in verification).
- **✅ Research update 2026-07-01 — CHI PDFs now READ, figure still absent.** Downloaded + full-text-extracted **CHI Annual Report 2023 (192 pp)** and **CCHI/CHI Annual Report 2020 (60 pp)** directly from chi.gov.sa. **Neither PDF contains any denial/rejection-rate figure.** 2020 reports loss ratio 83%, retention 96%, net claims incurred SAR 17.991B (actuarial ratios — *not* a denial rate). 2023 reports only NPHIES achievement metrics (243M transactions, 96.62% KPI). The **"15–25%"** number traces solely to a **Glance Care vendor whitepaper** (self-estimated, not official). **Verdict: no national denial rate exists in any CHI primary source.** The PDF-hunt action is now DONE — remaining path is a direct CHI ask or (better) design-partner data.
- **What you have instead:** a single Najran public-hospital peer-reviewed *coding-error* rate (26.8% primary / 9.9% secondary) — real but **not** a national denial rate, and not private-insurance-specific.
- **What to do (remaining):**
  1. ~~Download + read CHI annual report PDFs~~ — **DONE (no figure present).**
  2. Email/call **CHI (Council of Health Insurance, chi.gov.sa)** — ask directly for the **denial/rejection rate** (not published in reports).
  3. Ask a friendly **design-partner clinic** for their *actual* denial rate from their NPHIES `ClaimResponse` data (this is the free-audit motion — your most reliable number).
- **Why it matters:** it's the headline of your sales pitch. Until you have it, lead with the **free audit** (their own number), never a quoted national stat.

### A2. 🔴❌ National **annual denied-claim value (SAR)**
- **What's unconfirmed:** "~SAR 3B denied/year" (and a vendor "3.5–4.5B"). Both **refuted** — no primary source.
- **✅ Research update 2026-07-01 — effectively DENIED.** The **"3 billion SAR" appears only in a Glance Care whitepaper TITLE**, unsubstantiated in its body. CHI 2023 + 2020 PDFs (read in full) carry **no denied-claim-value figure** of any kind. No primary source exists.
- **What to do (remaining):** ~~CHI annual-report PDFs~~ **DONE (absent).** Ask CHI directly for total denied/rejected claim value; otherwise do not use a national SAR figure at all.
- **Why it matters:** it sizes the whole market (your TAM story). Don't put a national SAR figure on a deck until sourced.

### A3. 🟡⚠️ Najran coding-error study figures (the ONE primary anchor you do have)
- **What's confirmed:** 26.8% / 9.9% miscoding, SAR 12,927 loss — **single hospital, public, not insurance-specific.**
- **What to do:** read the source PDFs yourself before quoting ([F1000Research](https://f1000research.com/articles/13-820), [PMC11342027](https://pmc.ncbi.nlm.nih.gov/articles/PMC11342027/)). Always say "single-hospital study" when you cite it. **Do not** present it as a market-wide rate.

---

## B. NPHIES technical onboarding (Phase 2 — blocks live integration, NOT the MVP)

> All three below are 🔒 — **not public, not secret.** One call to NPHIES/CHI (and one to Waseel) answers all of them. None block your MVP (MVP = file upload, no NPHIES connection).
>
> **🔬 Research update 2026-07-01 — the "does a clearinghouse solve B1+B2?" question is answered: NO (not supported by any primary source).**
> - **Waseel Connect's own pages are SILENT** (verified 3-0): they do **not** claim that routing through Waseel removes your own NPHIES **PKI cert (B1)** or your own **conformance/sandbox testing (B2)**, and make no licensed-clearinghouse claim.
> - **PKI is issued per-organization** (Cirrus), and **NPHIES runs its own "System Vendor Certification Program"** that vendors complete themselves — **independent of any clearinghouse.**
> - So routing through Waseel likely still leaves a **software vendor** facing NPHIES vendor certification. Treat "clearinghouse removes B1/B2" as **UNCONFIRMED / probably false** until NPHIES + Waseel confirm scope on a call.
> - **B3 direct-vs-mandatory is resolved:** direct HIS-to-NPHIES integration **IS permitted** — a clearinghouse is an option, not mandatory.

### B1. 🔴🔒 **PKI certificate issuance process**
- **What's unconfirmed:** *how* you actually obtain the digital ID badge (certificate + private key) that authenticates your software to NPHIES. We confirmed a "certificate of integration" exists after testing — not how to get the PKI.
- **What to do:** contact the **NPHIES onboarding team** (via [portal.nphies.sa](https://portal.nphies.sa) / CHI). Ask: *Who issues the PKI cert? What documents/prerequisites? Timeline? Renewal? Cost (if any)?*

### B2. 🔴🔒 **Conformance / sandbox testing steps**
- **What's unconfirmed:** the exact steps to get **sandbox (test environment) access** and pass **conformance testing** before going to production.
- **What to do:** ask NPHIES onboarding: *How do we get sandbox credentials? What's the conformance test set? Manual or automated review? How long to certification?*

### B3. 🟢✅ **Clearinghouse REQUIRED vs. direct integration allowed** — RESOLVED
- **✅ Confirmed:** NPHIES connectivity is achievable **either** by **direct** HIS-to-NPHIES integration **or** via a clearinghouse — **direct is permitted, a clearinghouse is NOT mandatory** (Cirrus + NPHIES IG; NPHIES intro doesn't prohibit direct).
- **⚠️ But the cost/architecture nuance (see box above):** a clearinghouse does **not** confirmedly remove your own PKI (B1) + conformance (B2) obligations — NPHIES has a separate vendor-certification track. So "clearinghouse = much less lift" is not established.
- **What to do (now just scoping, not a yes/no):** ask **Waseel** ([waseel.com/connect](https://waseel.com/connect/)) for a **quote + exactly what its Connect covers** (does it carry the NPHIES-side cert for your transactions, or do you still certify as a vendor?). Published tiers: **Basic SAR 1,499/mo (≤500 txns), Premium SAR 1,999/mo (≤1,500), Enterprise = quote** (confirmed primary).
- **Why it matters:** "direct" = more build, full control; "clearinghouse" = faster, ongoing fee + dependency — but confirm whether it actually offloads B1/B2 before pricing Phase 2.

---

## C. Compliance & hosting (mostly RESOLVED — residual human checks)

### C1. 🟡✅→🔒 PDPL cross-border — framework confirmed, operational sign-off needed
- **What's confirmed (3-0):** SDAIA Transfer Regulation — no localization ban; adequacy list; SCC/BCR/Certificate safeguards; **sensitive/health data gets the stricter path.** Keep PHI **in-Kingdom** = clean.
- **What to do (human):** have **KSA privacy counsel** review your final data-flow + write the **DPA** (data processing agreement) wording with clinics, and confirm nothing in your stack quietly sends PHI abroad (logging, analytics, backups, email).
- **Why it matters:** the law is clear; the *implementation* (your actual architecture) still needs a lawyer's eyes before GA.

### C2. 🟢✅ CBAHI — resolved (no action)
- **Confirmed (3-0):** CBAHI accredits **facilities/providers, not software vendors.** No CBAHI requirement on you. (Nice-to-have: support clinics' accreditation/data-quality goals as a selling point.)

### C3. 🟢✅ In-Kingdom cloud region — RESOLVED: Oracle Riyadh is LIVE now
- **Confirmed (3-0):** AWS Saudi region **announced/planned for 2026, not yet live (GA).** Azure KSA = Q4 2026 (not GA).
- **🆕 Research update 2026-07-01 — Oracle Cloud Riyadh (`me-riyadh-1`) is LIVE / GA since 6 Aug 2024** ([Oracle](https://www.oracle.com/sa/cloud/cloud-regions/riyadh/)). The brief previously marked Oracle "unconfirmed" — there **is** a confirmed, operational in-Kingdom hyperscaler region **today**. Closes the timing-risk gap: you have a residency-compliant host now, before AWS/Azure go GA. (Google in-Kingdom region still unconfirmed.)
- **What to do (human):** at build time, still **check AWS/Azure GA status**; Oracle Riyadh is the confirmed interim/primary in-Kingdom option. Verify Oracle pricing + service coverage fits the stack.
- **Why it matters:** residency plan no longer has a hard gap — an in-Kingdom region exists and is GA.

---

## D. Competitors (pricing partly resolved)

### D1. 🟢✅ Waseel & Insta pricing — confirmed (no action)
- Waseel Connect: SAR 1,499–1,999/mo (transaction-tiered). Insta KSA HMS: SAR 190–225/user/mo (Oracle Cloud). *Insta is HMS seat pricing, not a denial-module-specific price — confirm the denial-module price in a demo if it matters.*

### D2. 🟡⚠️ HealthOrbit / Ecaresoft pricing — RESEARCHED: pricing still unpublished, depth now known
- **✅ Research update 2026-07-01 — integration depth confirmed, pricing genuinely not public:**
  - **HealthOrbit:** publishes **no rates** (pricing-page link only). NPHIES depth = an **NPHIES payload "validation" tool + native schema mapping** — but **no documented live claims submission, eligibility, PKI, or clearinghouse connectivity.** Compliance certs (HIPAA/GDPR/ISO27001/SOC2) are generic, **none NPHIES-specific.** → validation-tier, not deep live NPHIES.
  - **Ecaresoft (Cirrus/Nimbo HIS):** **no pricing disclosed.** NPHIES: **Eligibility + Pre-Auth LIVE on production; full Claims + Payment reconciliation "in progress"** (2021 doc), via internal code-mapping to NPHIES/CCHI-BS/SFDA. → partial live NPHIES.
- **What to do (remaining):** book demos / request quotes for **actual pricing** (not published anywhere); re-confirm Ecaresoft's Claims module is now fully live (2021 doc may be stale).

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

### F1. 🟢✅ Two paper citations — RESOLVED
- `arXiv:2602.05374` **resolves (HTTP 200) but is MISATTRIBUTED** — it's *"Cross-Lingual Empirical Evaluation of LLMs for Arabic Medical Tasks"*, **not** a claim-denial paper. **Do not cite it for denial content** (fine as an Arabic-medical-LLM ref).
- The SUNY Binghamton three-stage-denial **thesis stays UNCONFIRMED** — no stable citation found. Drop it. (The real US denial paper is `arXiv:2007.06229` "Deep Claim", unrelated to Binghamton.)

### F2. 🟢✅ `Fadil369/NPHIES` GitHub repo — RESOLVED
- **Confirmed exists** (GitHub API): public, **MIT license**, **0★ / 2 forks / 3 issues**, created 2025-08-13, last push 2025-08-14 (~16 commits in one day, inactive since), Go, ~158 KB. **Early-stage/low-adoption confirmed — use as a sketch only, not an architecture dependency.**

### F3. 🟡🔒 NPHIES IG package — RESOLVED (restricted, as feared)
- **Confirmed:** IG is copyright *"IG © 2024+ HL7 Saudi Arabia"*, StructureDefinition pages state *"Used by permission of HL7 International, all rights reserved"* + a Creative Commons ref + the FHIR License — **no unrestricted open-source grant; each terminology artifact carries its own terms.**
- **What to do:** **do NOT assume you can bundle/redistribute the IG** into your product/CI. Get written confirmation from **NPHIES/HL7 Saudi Arabia** before bundling.

---

## Quick action plan (do these first)

| # | Action | Who to contact | Unblocks |
|---|---|---|---|
| 1 | ~~Get annual-report PDFs~~ **DONE — no denial figure inside.** Now ask CHI *directly* for denial rate + denied-SAR | **CHI (chi.gov.sa)** | A1, A2 |
| 2 | Ask PKI issuance + sandbox/conformance steps (**B3 direct-vs-clearinghouse now RESOLVED: direct permitted; clearinghouse does NOT clearly remove B1/B2**) | **NPHIES onboarding (portal.nphies.sa / CHI)** | B1, B2 |
| 3 | Get clearinghouse quote **+ ask if it offloads your PKI/conformance or you still vendor-certify** | **Waseel** | B3 ✅, D1 |
| 4 | Review data-flow, write DPA, confirm no PHI leaves Kingdom | **KSA privacy counsel** | C1 |
| 5 | **Oracle Riyadh region confirmed LIVE** — evaluate it as in-Kingdom host; recheck AWS/Azure GA at build time | **Oracle / AWS** | C3 ✅ |
| 6 | Run free denial audits on real clinic data | **Design-partner clinics** | A1, A2 (your best path) |
| 7 | Verify branch counts/insured-mix; confirm "Nabda" | **Manual / each clinic** | E1, E2 |

> **Bottom line:** none of these block the **MVP** (file upload → analytics → scrub → appeals, no NPHIES connection). They block **Phase 2 (live NPHIES)**, **the market-size claims on your deck**, and **GA hosting**. Items 1, 2, 6 are the highest leverage — two emails/calls + your first free audit resolve most of the red items.
