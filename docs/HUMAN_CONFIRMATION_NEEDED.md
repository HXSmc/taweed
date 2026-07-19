# Human Confirmation Needed
### Things research could NOT confirm — and exactly what you must do

> Companion to `01_market_and_gtm.md` + `02_product_build_plan.md`.
> Everything here is **unverified** or **needs a human action** (a phone call, a counsel review, a price quote). It is **not** a list of facts — it is a list of *gaps*.
> Status key: ❌ no primary source found · ⚠️ verify-before-citing · 🔒 only obtainable by contacting a person/org directly.
> Priority: 🔴 blocks a real decision · 🟡 important before scaling · 🟢 cleanup / nice-to-have.
>
> **🔬 Research update 2026-07-01** (two deep-research passes, ~200 agents total — full log in `RESEARCH_FINDINGS_2026-07-01.md`). Resolved: **CHI annual-report PDFs found + read in full** (A1/A2), **Oracle Cloud Riyadh region confirmed LIVE** (C3), **Waseel pricing confirmed primary** (D1), **clearinghouse does NOT confirmedly remove your PKI/conformance duties** (B1/B2/B3), **D2 vendor depth**, **F1–F3 artifacts**. Remaining items are now human-action calls (CHI direct ask; NPHIES/Waseel scope call; counsel), not research gaps.
>
> **🔬 Double-check pass 2026-07-02** (third deep-research pass, ~100 agents): every remaining ❌/🔒 verdict **re-tested and STANDS — nothing could be confirmed or denied beyond what's below.** New this pass: (1) CHI's open-data **Statistics & Indicators page has NO denial figures** (3-0 verified) but CHI runs a formal **Data Sharing Request channel — DMO@chi.gov.sa** (Data Management Office); (2) a **peer-reviewed Nov 2025 paper** (Al-Kahtani, *Insurance Markets & Companies*) cites the national denied-SAR figure as **3.5–4.5B, sourced ONLY to the Glance Care vendor page**, and states empirical KSA rejection-rate data is sparse — the vendor-trace is now academically corroborated; (3) **B1/B2 docs are Academy-gated, not secret**: NPHIES Academy hosts a mandatory **"System Vendors Onboarding Course"** (v-academy.nphies.sa, course 11) + **"Registering in nphies Platform"** (course 6, incl. "nphies Registration Guide V1.3") — detailed PKI/sandbox steps sit behind course completion + portal registration; **NPHIES onboarding email = onboarding@chi.gov.sa (920033808)**; (4) contact emails for all action-plan targets found — see **"Emails to send"** section below the Quick action plan.
>
> **🔬 KSA regulatory compliance audit 2026-07-18** (6 parallel Opus research agents, agy + WebSearch, primary-source-verified — new **§G** section below). Covers ground never touched before: SFDA medical-device classification (**RESOLVED, COMPLIANT** — all 4 AI features are administrative/billing, primary-confirmed against SFDA's own MDS-G027 guidance), business/vendor registration (forks entirely on **founder nationality — your own self-disclosure, item #9** in the action plan), SAMA payment-services licensing (**RESOLVED, COMPLIANT** — the success-fee model never touches a regulated payment activity), SDAIA AI-specific law (**RESOLVED, COMPLIANT** — no binding AI law exists in KSA beyond PDPL, SDAIA's AI principles are voluntary), and two genuinely new, previously-untracked items: the **NPHIES portal's binding Terms & Conditions** (liability waiver + indemnity + suspend-without-notice, §G8) and the **72-hour SDAIA breach-notification requirement** (§G13, no materiality threshold, no exemptions). **No confirmed NON-COMPLIANT gap found anywhere in the product.** C1's PDPL entry corrected/sharpened (no adequacy list actually exists; PDPL enforcement is confirmed ACTIVE, not theoretical — 48 SDAIA violation decisions in 2025-2026). Emails 2 and 6 extended in place with the new questions rather than duplicated.

---

## A. Market & denial economics (your ROI pitch rests on this)

### A1. 🔴❌ National private-insurance **denial / rejection rate %**
- **What's unconfirmed:** the "~25% of claims denied" number. No primary source. It traces to vendor blogs (refuted in verification).
- **✅ Research update 2026-07-01 — CHI PDFs now READ, figure still absent.** Downloaded + full-text-extracted **CHI Annual Report 2023 (192 pp)** and **CCHI/CHI Annual Report 2020 (60 pp)** directly from chi.gov.sa. **Neither PDF contains any denial/rejection-rate figure.** 2020 reports loss ratio 83%, retention 96%, net claims incurred SAR 17.991B (actuarial ratios — *not* a denial rate). 2023 reports only NPHIES achievement metrics (243M transactions, 96.62% KPI). The **"15–25%"** number traces solely to a **Glance Care vendor whitepaper** (self-estimated, not official). **Verdict: no national denial rate exists in any CHI primary source.** The PDF-hunt action is now DONE — remaining path is a direct CHI ask or (better) design-partner data.
- **What you have instead:** a single Najran public-hospital peer-reviewed *coding-error* rate (26.8% primary / 9.9% secondary) — real but **not** a national denial rate, and not private-insurance-specific.
- **✅ Double-checked 2026-07-02 — verdict STANDS (cannot confirm, cannot deny).** CHI's open-data **Statistics & Indicators** page carries only beneficiary stats + "Number of Claims in Nafis" — **no denial rate** (verified 3-0). CHI 2023 report mentions rejections only *qualitatively* (a "Rejected Committee", rejection-reduction workshops) — no % (verified 3-0). 🆕 **CHI Annual Report 2024 (published 02/06/2025, 70 pp, Arabic-only) now downloaded + full-text-searched too: zero occurrences of رفض/مرفوض (rejection/denied)** — its KPIs cover "% paid claims" and Saudi-Billing-System %, never a rejection metric. That makes **2020 + 2023 + 2024 all read, all silent**. ⚠️ Closest-looking CHI number: a **"91.36% Paid claims" KPI** in the 2023 report — that's a CHI *performance metric*, NOT a denial-rate complement; do not derive "8.64% denied" from it. A **peer-reviewed Nov 2025 paper** (Al-Kahtani) explicitly states empirical KSA rejection-rate data is **sparse in the literature**, and its own "20–25% SME-hospital rejection rate" cites **only Glance Care 2022** (verified 3-0) — even the academic echo is vendor-sourced. New lever: CHI has a formal **Data Sharing Request** process via its **Data Management Office — DMO@chi.gov.sa** ([access-data page](https://www.chi.gov.sa/en/open-data/Pages/access-data.aspx)) — the correct front door for this ask, better than info@.
- **What to do (remaining):**
  1. ~~Download + read CHI annual report PDFs~~ — **DONE (no figure present).**
  2. Email **CHI DMO (DMO@chi.gov.sa)** — formal data-sharing request for the **denial/rejection rate** (Email 1 below), CC info@chi.gov.sa; call 19977 / 920001177 to follow up.
  3. Ask a friendly **design-partner clinic** for their *actual* denial rate from their NPHIES `ClaimResponse` data (this is the free-audit motion — your most reliable number).
- **Why it matters:** it's the headline of your sales pitch. Until you have it, lead with the **free audit** (their own number), never a quoted national stat.

### A2. 🔴❌ National **annual denied-claim value (SAR)**
- **What's unconfirmed:** "~SAR 3B denied/year" (and a vendor "3.5–4.5B"). Both **refuted** — no primary source.
- **✅ Research update 2026-07-01 — effectively DENIED.** The **"3 billion SAR" appears only in a Glance Care whitepaper TITLE**, unsubstantiated in its body. CHI 2023 + 2020 PDFs (read in full) carry **no denied-claim-value figure** of any kind. No primary source exists.
- **✅ Double-checked 2026-07-02 — verdict STANDS, vendor-trace now academically corroborated (3-0).** The figure appears in a **peer-reviewed Nov 2025 paper** (Al-Kahtani, *Insurance Markets & Companies*) as **SAR 3.5–4.5B — but its only source (ref 22) is the Glance Care vendor knowledge-center page (2022)**. So even the academic echo traces to the same vendor. ⚠️ Beware citing the paper as if it were independent — it is not. 🆕 CHI 2024 report (Arabic, full-text-searched) also carries **no denied-value figure**. 🆕 Usable derived context instead: CHI 2023 states medicines = SAR 6B = **16% of total claims value → total private claims ≈ SAR 37.5B/yr** (verified 3-0; cite as "derived from CHI 2023"). Sanity check: a ~SAR 3B denied value would be **~8% of claims value** — plausible-sized, but still unsourced (and "value of claims" is undefined in the report — submitted vs paid — so treat the 8% as indicative only).
- **What to do (remaining):** ~~CHI annual-report PDFs~~ **DONE (absent).** Ask **CHI DMO (DMO@chi.gov.sa)** for total denied/rejected claim value (same Email 1 below); otherwise do not use a national SAR figure at all.
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

> **🔬 Live confirmation 2026-07-19:** two real-world attempts closed remaining ambiguity. (1) **NPHIES Academy login itself demands a CR number** — not just the vendor-certification submission (B1/B2), the *training* step is gated too (confirmed by founder's own login attempt). (2) **Waseel called back and said they are a hospital/provider portal, not a software-vendor onboarding path** — Waseel Connect is **not applicable to Taweed's case at all**, independent of CR status. Kills the "clearinghouse-lite" reading of B3/D1 entirely — falls back to B3's original resolution: **direct NPHIES integration is the only route** (confirmed permitted, not mandatory-clearinghouse), and direct still requires B1/B2.

### B1. 🔴🔒 **PKI certificate issuance process**
- **What's unconfirmed:** *how* you actually obtain the digital ID badge (certificate + private key) that authenticates your software to NPHIES. We confirmed a "certificate of integration" exists after testing — not how to get the PKI.
- **✅ Double-checked 2026-07-02 — still not public, but the GATE is now located.** The official [conformance page](https://portal.nphies.sa/ig/conformance.html) covers only FHIR profile SHALL/SHOULD rules — zero PKI/issuance content. The detailed onboarding docs are **gated behind NPHIES Academy courses + unified-portal registration**, not secret: **["System Vendors Onboarding Course"](https://v-academy.nphies.sa/courses/11/system-vendors-onboarding-course?lang=en)** (mandatory for the **system-vendor certification program** — itself a requirement to connect) and **["Registering in nphies Platform"](https://academy.nphies.sa/courses/6/registering-in-nphies-platform?lang=en)** — the **mandatory** registration course, whose attachments list **13 PDFs incl. *"nphies Registration Guide V1.3 - English"* AND *"nphies Readiness & Activation Guide V1.2 - English"*** (verified live 2026-07-02; downloads unlock after **free Academy registration** — anonymous visitors see titles only). Official onboarding contact: **onboarding@chi.gov.sa / 920033808** (per [NPHIES Academy FAQ](https://academy.nphies.sa/page/7/%D8%A7%D9%84%D8%A3%D8%B3%D8%A6%D9%84%D8%A9-%D8%A7%D9%84%D8%B4%D8%A7%D8%A6%D8%B9%D8%A9?lang=en); variant `onboarding@cchi.gov.sa` + call center 920004299 appears in CHI's public-provider onboarding PDF). ⚠️ Also reported (nphies.sa FAQ content): **system vendors must maintain an official office inside Saudi Arabia** — confirm on the call; affects company setup.
- **What to do:** **(a) enroll in the two Academy courses yourself — free, self-serve, likely answers most of B1/B2 without waiting for a reply**; (b) email **onboarding@chi.gov.sa** (Email 2 below). Ask: *Who issues the PKI cert? What documents/prerequisites? Timeline? Renewal? Cost (if any)?*

### B2. 🔴🔒 **Conformance / sandbox testing steps**
- **What's unconfirmed:** the exact steps to get **sandbox (test environment) access** and pass **conformance testing** before going to production.
- **✅ Double-checked 2026-07-02 — same gate as B1:** no public sandbox/conformance-procedure doc exists; the vendor-certification track runs through the Academy courses above. Confirmed: completing the System Vendors Onboarding Course is **one of the requirements for linking with the platform** — so the vendor track is real and mandatory, only its internals are login-gated.
- **What to do:** same two moves as B1 — Academy self-enrollment + Email 2 to **onboarding@chi.gov.sa**: *How do we get sandbox credentials? What's the conformance test set? Manual or automated review? How long to certification?*

### B3. 🟢✅ **Clearinghouse REQUIRED vs. direct integration allowed** — RESOLVED, and Waseel specifically ruled out
- **✅ Confirmed:** NPHIES connectivity is achievable **either** by **direct** HIS-to-NPHIES integration **or** via a clearinghouse — **direct is permitted, a clearinghouse is NOT mandatory** (Cirrus + NPHIES IG; NPHIES intro doesn't prohibit direct).
- **✅ Live call 2026-07-19 — Waseel is NOT a fit, full stop:** Waseel called back after Email 3 and stated **they operate a portal for hospitals/providers, not a software-vendor onboarding channel** — Taweed's case (software vendor, not a provider) doesn't match what Connect is built for. This isn't a pricing or CR gate — it's a wrong-audience dead end. **Drop Waseel from the plan entirely.**
- **What this leaves:** **direct NPHIES integration is the only viable path** — no clearinghouse shortcut exists for a vendor in Taweed's position. Still requires B1/B2 (PKI + conformance), still CR-gated (see box above).
- **What to do:** none — closes cleanly as "direct only." If a clearinghouse alternative is ever wanted, it would need to be one that explicitly serves software vendors (not hospitals) — none identified so far; not worth re-researching unless direct integration proves unworkable.

---

## C. Compliance & hosting (mostly RESOLVED — residual human checks)

### C1. 🟡✅→🔒 PDPL cross-border — framework confirmed, operational sign-off needed
- **What's confirmed (3-0, sharpened 2026-07-18 — see §G10/G11):** SDAIA Transfer Regulation — no localization ban; **no SDAIA adequacy list has actually been published** (the earlier "adequacy list" phrasing here was ambiguous — there is nothing to check a destination against; every cross-border transfer of sensitive data, including to the US, must rely on an Appropriate Safeguard instead: Saudi SCCs, Binding Common Rules, or a Certificate of Accreditation); SCC is the applicable safeguard for a US-based subprocessor like Anthropic. **Sensitive/health data gets the stricter path** and is barred from the lighter "Exempt Cases" derogations. Keep PHI **in-Kingdom** = clean; the `inference_geo="us"` pin on AI calls (`packages/ai/src/anthropic-1p.ts`) is a real cross-border transfer once real PHI flows, not yet (synthetic/PHI-free only today, BLK-AI-1/2). **PDPL's Executive Regulations are confirmed FINALIZED and FULLY ENFORCED as of 14 Sept 2024** — no grace period remains; SDAIA issued 48 confirmed-violation decisions across 2025-2026, so this is live enforcement, not theoretical.
- **What to do (human):** have **KSA privacy counsel** review your final data-flow + write the **DPA** (data processing agreement) wording with clinics, confirm nothing in your stack quietly sends PHI abroad (logging, analytics, backups, email), draft the Saudi SCC form for the Anthropic transfer, produce the mandatory SDAIA cross-border risk assessment (Feb 2025 guideline, §G12), set up a 72-hour breach-notification runbook (§G13), and make the controller-vs-processor call (§G14) — all now folded into **Email 6**.
- **Why it matters:** the law is clear; the *implementation* (your actual architecture) still needs a lawyer's eyes before GA — and enforcement is now active, not a future risk.

### C2. 🟢✅ CBAHI — resolved (no action)
- **Confirmed (3-0):** CBAHI accredits **facilities/providers, not software vendors.** No CBAHI requirement on you. (Nice-to-have: support clinics' accreditation/data-quality goals as a selling point.)

### C3. 🟢✅ In-Kingdom cloud region — RESOLVED: Oracle Riyadh AND AWS Riyadh both LIVE now
- **Confirmed (3-0):** ~~AWS Saudi region announced/planned for 2026, not yet live~~ **CORRECTED 2026-07-19: AWS `me-central-2` (Riyadh, 3 AZs) went GA in January 2026** — $5.3B investment, **AI-native** (Trainium/Inferentia + Nvidia GPU clusters). Azure KSA = still Q4 2026 (not GA). Google Cloud Dammam (`me-central2`) opened Nov 2023 but is **not self-serve GA** — access only through **CNTXT**, Google's exclusive KSA reseller holding the CST Class C license (Sovereign Controls by CNTXT went GA 2026, but still gated behind that reseller relationship).
- **🆕 Research update 2026-07-01 — Oracle Cloud Riyadh (`me-riyadh-1`) is LIVE / GA since 6 Aug 2024** ([Oracle](https://www.oracle.com/sa/cloud/cloud-regions/riyadh/)). Closes the timing-risk gap: two independently confirmed in-Kingdom hyperscaler regions now exist (Oracle since Aug 2024, AWS since Jan 2026), plus a gated third (GCP via CNTXT).
- **What to do (human):** at build time, compare Oracle `me-riyadh-1` vs AWS `me-central-2` pricing/service coverage; GCP Dammam only worth pursuing if a CNTXT relationship is acceptable. See the **LLM-hosting alternatives table** at the bottom of this doc for how this ties into C1's cross-border question.
- **Why it matters:** residency plan no longer has a hard gap — two GA in-Kingdom regions exist today, both AI-native enough to self-host an LLM entirely in-Kingdom.

---

## D. Competitors (pricing partly resolved)

### D1. 🟢✅ Waseel & Insta pricing — confirmed (no action)
- Waseel Connect: SAR 1,499–1,999/mo (transaction-tiered). Insta KSA HMS: SAR 190–225/user/mo (Oracle Cloud). *Insta is HMS seat pricing, not a denial-module-specific price — confirm the denial-module price in a demo if it matters.*

### D2. 🟡⚠️ HealthOrbit / Ecaresoft pricing — RESEARCHED: pricing still unpublished, depth now known
- **✅ Research update 2026-07-01 — integration depth confirmed, pricing genuinely not public:**
  - **HealthOrbit:** publishes **no rates** (pricing-page link only). NPHIES depth = an **NPHIES payload "validation" tool + native schema mapping** — but **no documented live claims submission, eligibility, PKI, or clearinghouse connectivity.** Compliance certs (HIPAA/GDPR/ISO27001/SOC2) are generic, **none NPHIES-specific.** → validation-tier, not deep live NPHIES.
  - **Ecaresoft (Cirrus/Nimbo HIS):** **no pricing disclosed.** NPHIES: **Eligibility + Pre-Auth LIVE on production; full Claims + Payment reconciliation "in progress"** (2021 doc), via internal code-mapping to NPHIES/CCHI-BS/SFDA. → partial live NPHIES.
- **✅ Site check 2026-07-19 — confirmed neither publishes pricing anywhere on their live sites** (checked HealthOrbit's pricing URL directly — 404; checked Ecaresoft's nav/footer — no pricing link on either the parent site or Cirrus/Nimbo). HealthOrbit has a self-serve demo-booking form but it doesn't collect or reveal pricing, and their listed offices are UK/India/US only, no Saudi/GCC presence found. → **no self-serve path exists for either; email is the only way in** → **Email 10** (HealthOrbit) and **Email 11** (Ecaresoft) drafted above, asking pricing + current NPHIES depth in one message.
- **What to do (remaining):** send Email 10/11; re-confirm Ecaresoft's Claims module is now fully live (2021 doc may be stale) — folded into Email 11's question 1.

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
- **🆕 Independently reinforced by G8 (2026-07-19):** the NPHIES portal's own Terms & Conditions carry a separate, general IP clause covering *all* portal content — no sale/license/rent/modification/copy/reproduction/redistribution/derivative-works for public or commercial purposes without prior written NPHIES approval. Two independent sources now say the same thing.
- **What to do:** **do NOT assume you can bundle/redistribute the IG** into your product/CI. Get written confirmation from **NPHIES/HL7 Saudi Arabia** before bundling.

---

## G. KSA regulatory compliance audit *(2026-07-18 pass — 6 parallel Opus research agents, agy + WebSearch, primary-source-verified)*

> Covers ground A-F never touched: SFDA medical-device classification, business/vendor registration, SAMA payment-services licensing, SDAIA AI-specific law, NPHIES vendor legal/liability terms, and a freshness check on the existing PDPL research (C1). **Net result: no confirmed NON-COMPLIANT gap product-wide.** Two real, previously-untracked items surfaced: the NPHIES portal's binding Terms & Conditions (G8), and the 72-hour SDAIA breach-notification requirement (G13) — both now actioned via Email 2/Email 6 above.

### G1. 🟢✅ SFDA medical-device (SaMD) classification — RESOLVED, primary-confirmed
- **What's confirmed:** SFDA guidance **MDS-G027** ("Guidance on Digital Health Products," v1.0, 11/8/2025) and **MDS-G23** (SaMD framework) — both downloaded and text-extracted directly, not a vendor summary. The test is **medical purpose** (diagnose/treat/mitigate/cure/prevent), not "does a human review the output." MDS-G027 verbatim: *"A HIT product does not qualify as a medical device if it is: intended solely for administrative or communication support, such as... billing processing."* All 4 AI features (AI-1 explain, AI-2 appeal-assist, AI-3 rule-authoring, AI-4 EOB extraction) are revenue-cycle/billing functions with no clinical diagnostic/therapeutic purpose — **none require SFDA SaMD registration.** AI-2 (drafting appeal arguments referencing medical necessity) was scrutinized hardest as the closest call and still lands outside: it compiles arguments from clinical decisions already made by the clinician, serves a reimbursement purpose, and is a human-reviewed DRAFT — it doesn't interpret new patient data to recommend clinical management.
- **What to do:** nothing — this closes cleanly. Optional: if ever genuinely uncertain on a specific feature, SFDA's Medical Devices Sector takes inquiries at ☎ 19999 or via the Medical Devices e-services portal (no existing contact in this doc covers SFDA — this would be a new one, not currently needed).

### G2. 🟡⚠️ Product copy invokes the wrong SFDA exemption frame — wording fix, not a legal gap
- **What's confirmed:** `apps/web/messages/en.json` (lines ~67, ~417) and `docs/03_design_brief.md` (~293, ~307) say **"Not an SFDA medical device. Decision support with human review."** The conclusion is right; the *stated reason* is wrong — "decision support" is literally SFDA's name for a **regulated** category (clinical decision support is a named example of what typically IS SaMD). Taweed is exempt because it's **administrative/billing software with no medical purpose**, not because a human reviews it (human review is SFDA's mitigation for software that already IS medical-purpose).
- **What to do:** reword the `notDevice`/`trustDevice` copy strings to lead with "administrative/revenue-cycle software — no medical purpose" rather than "decision support." No code/architecture change, a copy edit. Not urgent, not blocking.

### G3. 🟢✅ Founder nationality — RESOLVED (founder confirmed Saudi)
- **What's confirmed:** founder is a **Saudi national**. Every downstream business-registration question below now resolves to the Saudi/GCC path — no MISA license needed anywhere in this doc.
- **What to do:** none — closes cleanly.

### G4. 🟢✅ Business registration path — RESOLVED: standard CR only, no MISA
- **What's confirmed:** as a **Saudi founder**, the path is standard KSA Commercial Registration (CR) only — **no MISA investment license required** (that track only applies to foreign/non-GCC founders). Software/SaaS CR has no meaningful minimum-capital hurdle.
- **What to do:** engage a standard CR formation agent directly (no MISA step, no incubator support-letter needed).

### G5. 🔴⚠️ No pre-entity pilot carve-out — the free-audit GTM pulls the entity requirement earlier than "first invoice"
- **What's confirmed:** operating commercially in KSA without a CR/license is prohibited (Anti-Commercial Concealment Law — fines to SAR 5M, imprisonment, deportation, entity closure, for the foreign-founder case specifically). The product's own GTM wedge (`01_market_and_gtm.md` §7-8) is a **free audit on the clinic's own real NPHIES `ClaimResponse` data** — that's real PHI, which triggers PDPL + a DPA (C1/BLK-AI-1), and **a DPA needs a legal entity to be a party to it.** So the practical "you need an entity" moment arrives at **first real-clinic-data**, before the first invoice, not at "first commercial contract" as the GTM plan implicitly assumes.
- **What to do:** do not ingest a real clinic's `ClaimResponse` data until (a) an entity exists to sign the DPA and (b) PDPL sign-off per C1. A pre-entity pilot is only safe on **synthetic/de-identified data** — which the product's own `data_origin` synthetic/production gate already enforces, so the engineering control already matches this legal constraint; just don't let a sales process outrun it.

### G6. 🟢✅ ZATCA tax + VAT + e-invoicing — informational, plan-ahead not urgent
- **What's confirmed:** general taxpayer registration (Zakat if Saudi/GCC-owned, 20% corporate income tax if foreign-owned) is required at CR issuance regardless of revenue (~60 days). **VAT** is mandatory above SAR 375,000 annual taxable supplies, voluntary between SAR 187,500-375,000, standard rate 15%. **E-invoicing (Fatoora) Phase 2** now applies from the same SAR 375,000 line (Wave 24), ≥6 months notice before a business is pulled in. At the modeled ACV (SAR 80-150k/client), Taweed crosses mandatory VAT at roughly **3-5 paying clients**.
- **What to do:** nothing now (pre-revenue, below every threshold). Register as a taxpayer at CR issuance regardless. Put "VAT registration + Fatoora-compliant invoicing" on the first-revenue checklist, expected around the 3-5th paying client.

### G7. 🟢✅ SAMA payment-services licensing — RESOLVED, outside scope
- **What's confirmed:** Taweed's revenue model (a base fee + 10-15% of recovered SAR, billed separately to the clinic) does not touch any of the 12 activities SAMA's Payments Law Article 6 defines as regulated "payment services" (deposits, transfers, card acquiring, e-money, payment initiation, etc.) — the insurer pays the clinic directly, Taweed is never in the payment path. Article 7(9) also excludes technical-service-provider support from "related payment services," though Taweed doesn't even need that exclusion since it never touches the payment ecosystem at all. SAMA's debt-collection regime doesn't apply either (binds only collection on behalf of SAMA-supervised banks/finance companies; Taweed isn't a collection agency — it never contacts debtors or holds funds).
- **What to do:** nothing required. **To keep this status:** never provide payment links/gateway APIs that capture insurer↔clinic funds, never hold funds in an escrow/pass-through account even briefly, and always bill the clinic as a separate, standard B2B invoice — never blend the fee into the payment flow itself. A one-line perimeter confirmation from KSA financial-services counsel before GA is cheap insurance (folded into Email 6's engagement, not a separate ask) but the finding stands regardless.

### G8. 🔴✅→🔒 NPHIES portal Terms & Conditions — CONFIRMED binding agreement with real business-risk terms
- **What's confirmed (verified by directly loading and expanding every accordion section of the live Arabic page on 2026-07-19 — full text pulled, not a summarized fetch):** `nphies.sa/terms-and-conditions` is a real, binding legal document, not boilerplate — *"every user of the portal is subject to these terms of use, and to the regulations of the Kingdom of Saudi Arabia"* and *"your access to and entry into the portal constitutes unconditional acceptance"* of them, effective from first use. Terms can change anytime at NPHIES's sole discretion with **no obligation to announce updates** — continued use after a silent change means acceptance. No last-updated date shown; footer copyright reads 2026. The document has 10 sections, all confirmed:
  - **Usage restrictions:** no uploading unlicensed software/data, no spam/unsolicited commercial email, no malware/corrupted files, no defamatory/obscene/illegal content, no unlawful activity via the portal, no advertising that would put NPHIES in breach of any law, no tools to intercept normal portal operation, no imposing heavy load on portal infrastructure or affecting data integrity/reliability/availability, and general compliance with KSA's anti-cybercrime law.
  - **Links to/from NPHIES:** copying/reproducing portal content or framing it elsewhere is prohibited without complying with these terms; NPHIES disclaims any association with sites that link to it and reserves the right to disable unauthorized links; outbound links are convenience-only with **no responsibility for linked-site content**, used at the visitor's own risk.
  - **🆕 IP rights clause (new finding, relevant to F3 below):** *all* portal content — software and information — is protected under Saudi copyright/trademark/IP law and owned by NPHIES; you may **not sell, license, rent, modify, copy, reproduce, reprint, download, advertise, transmit, distribute, publicly display, edit, or create derivative works** from any portal material for public or commercial purposes **without prior written approval from NPHIES platform management.** Any modification of portal content is expressly forbidden. Graphics/images are separately copyright-protected.
  - **Jurisdiction:** exclusive submission to Saudi Arabian courts for all claims/disputes arising from portal use.
  - **Liability limitation:** electronic services are explicitly framed as only *"facilitating manual procedures"* — not a replacement for the official channels; the portal disclaims responsibility for internet interception, connection/equipment/software failures, or reliance on any statement/opinion/ad on the portal; use is entirely at the user's own risk.
  - **Termination:** NPHIES may terminate, restrict, or suspend portal access **at its sole discretion, without notice, for any reason**, including a ToU violation or any conduct it unilaterally deems unlawful or harmful to others.
  - **Virus protection:** NPHIES tests content but is not liable for any data/device loss/damage during connection or from downloaded material; advises running antivirus.
  - **🆕 Disclaimer of warranties (new finding):** the portal and its services/info/functions are provided **"as is"/"as available"** with no representations or warranties, no guarantee against interruptions/errors, and — notably — **user communications sent through the portal carry no ownership right or confidentiality guarantee** on NPHIES's part. Worth flagging to counsel specifically: this appears to be a generic disclaimer about portal-support-channel communications (contact forms, chat), not the FHIR claims-transaction data itself (which would be governed by separate technical/security specs, not this ToU page) — but the wording is broad enough that counsel should confirm the scope, not assume it.
  - **Indemnity:** users agree **not to take action against NPHIES, its administrators, or any staff/agents** managing/maintaining the portal, and waive any compensation claim, for anything arising from the user's own breach of these terms or applicable KSA regulations.
- **What to do:** get this in front of counsel as part of Email 6's scope (item 5) before connecting — it's a real business-risk document worth a lawyer's read, not a code fix. Specifically flag for counsel: (1) the confidentiality-disclaimer wording above — confirm it doesn't extend to actual FHIR claims data; (2) the IP clause's bearing on F3 (IG bundling) — it independently confirms no redistribution/derivative-works right exists without written NPHIES approval, on top of F3's own finding. Also treat the suspend-without-notice right as a live operational dependency once connected (§G9's Q8 asks NPHIES directly whether there's a published basis for suspension).

### G9. 🟡🔒 NPHIES vendor liability/insurance, separate vendor agreements, post-cert compliance regime — unconfirmed, routed to Email 2
- **What's confirmed:** no PUBLIC primary source (CHI, Saudi Insurance Authority, NPHIES IG) requires a vendor to carry professional-indemnity insurance, post a bond, sign a separate indemnity undertaking, or sign a distinct vendor DPA/NDA/code-of-conduct with CHI/NPHIES beyond the portal ToU (§G8) — but the actual System Vendor Certification pack is Academy-login-gated, so absence-in-public-sources is evidence of gating, not evidence the requirement doesn't exist. Same for any post-certification ongoing compliance/re-certification/de-listing regime — nothing public, but the real material is gated. (One correction: an earlier research pass's claim that `provider-contract-suspended` is a vendor de-listing mechanism is wrong — it's a `siteEligibility` CodeSystem value describing a provider↔payer contract status, unrelated to vendor compliance.)
- **What to do:** now folded into **Email 2** (questions 6-8) — no new contact needed, same `onboarding@chi.gov.sa` inbox already being emailed for B1/B2. Also worth self-enrolling in NPHIES Academy course #11 (System Vendors Onboarding) — the gated material likely answers all three questions directly, same logic as the existing "do 1b, don't wait for the reply" note on Email 2.

### G10. 🟢✅→🔒 PDPL Executive Regulations — CONFIRMED finalized and in ACTIVE enforcement (sharpens C1)
- **What's confirmed:** PDPL entered force 14 Sept 2023; the compliance grace period ended 14 Sept 2024 — **there is no ongoing grace period now**, mid-2026 is squarely in active enforcement. The Implementing Regulations and the Data Transfer Regulations (issued Aug/Sept 2024) are both in force, not draft. Enforcement is real: SDAIA's committees issued **48 confirmed-violation decisions across 2025-2026** (no-legal-basis processing, unauthorized disclosure, missing safeguards, unconsented marketing).
- **What to do:** no new action beyond what C1 already schedules (counsel review before GA) — but note the risk framing has changed from "the law is clear, get ahead of it" to "this is now actively enforced," which raises the priority of closing C1 before any real-PHI operation, not just before GA.

### G11. 🟡⚠️ No SDAIA adequacy list exists — corrects C1's ambiguous wording (already fixed above)
- **What's confirmed:** SDAIA has never published a list of adequate jurisdictions — there is nothing to check the US (or any destination) against. C1's original phrasing ("adequacy list; SCC/BCR/Certificate safeguards") read as if a usable list exists; it doesn't. Every cross-border transfer of Taweed's kind must rely on an Appropriate Safeguard instead — Saudi SCCs (Controller-to-Processor form) being the applicable one for a third-party vendor like Anthropic (Binding Common Rules excludes third-party vendors). This is not a new problem — BLK-AI-1/2 already require SCC + counsel sign-off — just a wording fix so a future reader doesn't go looking for a list that doesn't exist.
- **What to do:** C1's wording above is already corrected. No new blocker.

### G12. 🔴🔒 SDAIA Risk Assessment Guideline (Feb 2025) — mandatory for the Anthropic health-data transfer, not previously tracked
- **What's confirmed:** SDAIA issued a "Risk Assessment Guideline for Transferring Personal Data Outside the Kingdom" (Feb 2025) plus a self-assessment tool on the National Data Governance Platform (dgp.sdaia.gov.sa). The underlying risk-assessment obligation is **mandatory** (not just the guideline) whenever (a) relying on an Appropriate Safeguard — which Taweed must, per G11 — or (b) the transfer involves sensitive data, health data explicitly named. Taweed hits both triggers. Sensitive-data transfers are also barred from the lighter "Exempt Cases" derogations (the "direct benefit" and scientific-research exemptions explicitly can't involve sensitive data) — there's no shortcut around the full safeguards + risk-assessment path for PHI.
- **What to do:** now folded into Email 6 (item 4) — produce the SDAIA risk assessment for the Anthropic transfer using the dgp.sdaia.gov.sa tool, as part of the same counsel engagement already planned for the DPA/SCC work.

### G13. 🔴🔒 72-hour SDAIA breach notification — new operational requirement, not previously tracked
- **What's confirmed:** controllers must notify SDAIA **within 72 hours** of becoming aware of a breach, **with no materiality threshold** (stricter than GDPR/US HHS — every breach size is notifiable) and no exemptions on notifying affected data subjects "without undue delay" where harm is possible. This is a genuine product/ops gap for a PHI product, not just a legal one — there is currently no documented breach-response runbook anywhere in this repo's docs.
- **What to do:** now folded into Email 6 (item 6) — get counsel's help drafting a breach-response runbook (detection → 72h SDAIA notification → data-subject notification) before any real-PHI operation. Whether Taweed (processor) or the clinic (controller) owns the SDAIA-facing notification is the same determination as G14, but Taweed as processor must still notify the clinic fast enough for the clinic to hit the 72h clock either way — build the runbook regardless of how G14 resolves.

### G14. 🟡🔒 Controller-vs-processor determination + possible registration/DPO duties — counsel question, not yet confirmed
- **What's confirmed:** controllers processing sensitive data or doing cross-border transfers must register on SDAIA's National Data Governance Platform; DPO appointment is mandatory for large-scale sensitive-data processing or cross-border transfers, with the DPO registered with SDAIA. On its face Taweed's activities (sensitive health data + US cross-border) hit these triggers — **but** these duties attach to the **controller**, and in the clinic-SaaS model the clinic is likely the controller with Taweed as processor, so whether registration/DPO duties land on Taweed at all turns entirely on that determination. Proposed 2025 amendments that would consolidate these rules were still unpublished as of May 2026 — treat as an emerging, not yet fully settled, duty.
- **What to do:** now folded into Email 6 (item 7) — ask counsel to make the controller-vs-processor call first, then confirm whether registration/DPO attaches to Taweed specifically.

---

## Quick action plan (do these first)

| # | Action | Who to contact | Unblocks |
|---|---|---|---|
| 1 | ~~Get annual-report PDFs~~ **DONE — no denial figure inside.** Now file a formal **Data Sharing Request** for denial rate + denied-SAR → **Email 1** | **CHI DMO — `DMO@chi.gov.sa`** (CC `info@chi.gov.sa`; ☎ 19977 / 920001177) | A1, A2 |
| 1b | ~~Self-serve Academy enrollment~~ **BLOCKED — login itself demands a CR number** (confirmed 2026-07-19 by founder's own attempt), not just the vendor-cert submission | **NPHIES Academy** | B1, B2 (now CR-gated, no pre-CR workaround) |
| 2 | Ask PKI issuance + sandbox/conformance steps + KSA-office rule (**B3 RESOLVED: direct is the only path, no clearinghouse shortcut — see below**) → **Email 2** | **NPHIES onboarding — `onboarding@chi.gov.sa`** (☎ 920033808; CC `support@nphies.sa`) — **replied**, asks for CR number, KSA HQ, FHIR awareness | B1, B2 |
| 3 | ~~Get clearinghouse quote~~ **DONE — Waseel called back 2026-07-19: they're a hospital/provider portal, not a vendor path. Not applicable to Taweed. Drop.** | **Waseel — `bdr@waseel.com`** (☎ 9200 120 99) | B3 ✅ (direct-only), D1 (moot) |
| 4 | Review data-flow, write DPA, confirm no PHI leaves Kingdom → **Email 6** (⚠️ referral/meeting beats cold email here) | **KSA privacy counsel** | C1 |
| 5 | **Oracle Riyadh LIVE** — evaluate as in-Kingdom host; recheck AWS/Azure GA at build time → **Email 4** | **Oracle — `contact@oracle.com`** + [sales form](https://www.oracle.com/sa/corporate/contact/) | C3 ✅ |
| 6 | Run free denial audits on real clinic data → **Email 7** | **Design-partner clinics** | A1, A2 (your best path) |
| 7 | Verify branch counts/insured-mix; confirm "Nabda" | **Manual / each clinic** | E1, E2 |
| 8 | 🆕 Get written OK to bundle NPHIES IG artifacts into product/CI → **Email 5** | **`onboarding@chi.gov.sa` / `support@nphies.sa`** (HL7 Saudi Arabia has no public email — still "in establishment") | F3 |
| 9 | ~~State your own nationality~~ **DONE — Saudi confirmed, standard CR path, no MISA** | **You (self-disclosure)** | G3 ✅, G4 ✅ |
| 10 | 🆕 Ask vendor liability/insurance, separate CHI/NPHIES vendor agreement, post-cert compliance regime (Q6-8, now folded into Email 2) | **`onboarding@chi.gov.sa`** (same as #2) | G9 |
| 11 | 🆕 SCC + risk-assessment for the Anthropic transfer, NPHIES ToU business-risk review, 72h breach-notification runbook, controller/processor + DPO call (items 4-7, now folded into Email 6) | **KSA privacy counsel** (same as #4) | G8, G12, G13, G14 |
| 12 | 🆕 Ask HealthOrbit/Ecaresoft actual pricing + current NPHIES depth → **Email 10 / Email 11** | **`sales@healthorbit.ai`** · **`sales@ecaresoft.com`** | D2 |

### 🧍 Better done IN PERSON / by phone than by email *(added 2026-07-02)*
- **#6 design partners** — KSA physician-owners close on **warm referral + WhatsApp + a visit**, not cold email. Use Email 7 only as the door-opener or follow-up after a call; a 15-min in-clinic demo of the free audit beats any sequence.
- **#7 branch counts / insured-mix (E1)** — a **phone call to reception** ("do you take Bupa/Tawuniya?") or walking their **booking flow** answers in 2 minutes what email never will. Confirm "Nabda" (E2) verbally too.
- **#4 privacy counsel** — engage via **referral or a scoping meeting**; cold-emailing law firms gets slow generic replies. Email 6 works as the *follow-up brief* after intro.
- **#5 Oracle** — after the form, push for an **account-exec meeting or LEAP/Riyadh cloud-event contact**; startup credits ("Oracle for Startups") are negotiated live, not over email.
- **#1/#2 CHI + NPHIES** — Saudi gov bodies answer **phones faster than inboxes**: 19977 (CHI), 920033808 (NPHIES onboarding), 920004299 (onboarding call center). Send the email first (paper trail), then call referencing it.

> **Bottom line:** none of these block the **MVP** (file upload → analytics → scrub → appeals, no NPHIES connection). They block **Phase 2 (live NPHIES)**, **the market-size claims on your deck**, and **GA hosting**. Items 1, 1b, 2, 6 are the highest leverage — the Academy self-enrollment + two emails/calls + your first free audit resolve most of the red items.

---

## ✉️ Emails to send (copy-paste ready) — *added 2026-07-02*

> Every address below was pulled from a **primary source** this pass (contact pages, official PDFs, Academy FAQ). Replace `[YOUR NAME]` / `[PHONE]` / `[COMPANY]` before sending. Each email has an **English and Arabic version + a recommendation on which to send** for that specific recipient. General rule found: **Saudi government bodies (CHI/NPHIES) → Arabic gets routed faster and taken more seriously; multinationals (Oracle) → English; Saudi B2B vendors (Waseel) → Arabic for rapport, English acceptable; clinics → Arabic (physician-owners).** Send email first (paper trail), then call the listed number referencing it.

### Email 1 — CHI: formal data request for denial statistics *(unblocks A1 + A2)*
**To:** `DMO@chi.gov.sa` · **CC:** `info@chi.gov.sa` · **Follow-up ☎:** 19977
**🏆 Send the ARABIC version** — this is a Saudi government Data Management Office; Arabic requests get processed through the official channel faster and signal you're a serious local actor. Keep the English version for any follow-up with an English-speaking analyst.

**Arabic (recommended):**
```text
الموضوع: طلب مشاركة بيانات — إحصاءات رفض المطالبات في التأمين الصحي الخاص

السلام عليكم ورحمة الله وبركاته،

تحية طيبة، فريق مكتب إدارة البيانات في مجلس الضمان الصحي،

أنا [YOUR NAME]، مؤسس شركة تقنية صحية سعودية ناشئة تعمل على تطوير حلول لتحسين جودة المطالبات التأمينية لمقدمي الرعاية الصحية عبر منصة نفيس.

بناءً على خدمة "طلب مشاركة البيانات" المتاحة عبر موقع المجلس، أتقدم بطلب الحصول على البيانات الإحصائية المجمّعة التالية (دون أي بيانات تعريفية):

١. النسبة الوطنية لرفض المطالبات (أو إعادتها) في التأمين الصحي الخاص، لآخر سنة متاحة.
٢. إجمالي قيمة المطالبات المرفوضة سنويًا بالريال السعودي.
٣. أبرز أسباب الرفض حسب التصنيف، إن توفرت.

الغرض من الطلب: دراسة سوقية لتطوير منتج وطني يساعد مقدمي الرعاية على خفض نسب الرفض وتحسين جودة الترميز الطبي، بما يتوافق مع مستهدفات التحول الصحي.

وإن كان هناك نموذج رسمي أو إجراء محدد لتقديم الطلب، فأرجو تزويدي به وسأستكمله فورًا.

شاكرًا لكم تعاونكم،
[YOUR NAME]
[COMPANY] — [PHONE]
```

**English (fallback):**
```text
Subject: Data sharing request — private health insurance claim rejection statistics

Dear Data Management Office team,

I'm [YOUR NAME], founder of a Saudi healthtech startup building software that helps healthcare providers improve claims quality on the NPHIES platform.

Under the Council's Data Sharing Request service, I would like to request the following aggregated, non-identifiable statistics:

1. The national claim rejection/denial rate (%) for private health insurance, for the most recent available year.
2. The total annual value of rejected claims (SAR).
3. Top rejection reasons by category, if available.

Purpose: market research for a Saudi-built product that helps providers reduce rejection rates and improve medical coding quality, in line with health-sector transformation goals.

If there is a formal request form or procedure, please point me to it and I'll complete it immediately.

Thank you,
[YOUR NAME]
[COMPANY] — [PHONE]
```

### Email 2 — NPHIES onboarding: vendor certification, PKI, sandbox *(unblocks B1 + B2 + G9)*
**To:** `onboarding@chi.gov.sa` · **CC:** `support@nphies.sa` · **Follow-up ☎:** 920033808 (or onboarding call center 920004299)
**🏆 Send the ARABIC version** — same reasoning as Email 1 (CHI-domain government inbox). Technical terms (PKI, sandbox, FHIR) stay in English inside the Arabic text — that's how NPHIES's own docs write them. **Do 1b (Academy self-enrollment) the same day; don't wait for the reply.**
**🆕 Updated 2026-07-18** with 3 new questions (6-8) from the KSA compliance audit pass — see **§G9** below for why: the System Vendor Certification pack is Academy-login-gated, so these can't be closed by research alone.

**Arabic (recommended):**
```text
الموضوع: استفسار — برنامج اعتماد موردي الأنظمة (System Vendor Certification)

السلام عليكم ورحمة الله وبركاته،

فريق تهيئة منصة نفيس المحترم،

أنا [YOUR NAME]، مؤسس شركة برمجيات سعودية نعمل على تطوير نظام لإدارة المطالبات المرفوضة لمقدمي الرعاية الصحية، ونستعد للانضمام لبرنامج اعتماد موردي الأنظمة. سجّلنا في دورات أكاديمية نفيس ذات العلاقة، ولدينا خمسة استفسارات لاستكمال خطتنا:

١. شهادة PKI: ما الجهة المُصدرة؟ وما المستندات والمتطلبات المسبقة؟ وما المدة المتوقعة والتكلفة (إن وجدت) وآلية التجديد؟
٢. بيئة الاختبار (Sandbox): ما خطوات الحصول على بيانات الدخول للبيئة التجريبية؟
٣. اختبارات المطابقة (Conformance): ما نطاق حالات الاختبار المطلوبة؟ وهل المراجعة آلية أم يدوية؟ وما المدة المعتادة حتى صدور الاعتماد؟
٤. في حال الربط عبر وسيط معتمد (Clearinghouse مثل واصل): هل يظل على المورد استكمال اعتماد موردي الأنظمة وشهادة PKI الخاصة به، أم يغني الربط عبر الوسيط عن ذلك؟
٥. هل يُشترط وجود مكتب رسمي داخل المملكة لاعتماد المورد؟ وما إثباتات ذلك المطلوبة؟
٦. هل يُشترط على المورد حمل تأمين مسؤولية مهنية، أو تقديم ضمان مالي، أو توقيع تعهد بالمسؤولية/التعويض مع مجلس الضمان الصحي/نفيس كشرط لاعتماد النظام؟ وإن وُجد، ما الحدود والصيغة المطلوبة؟
٧. بخلاف الموافقة على شروط استخدام بوابة نفيس، هل يُطلب من المورد المعتمد توقيع اتفاقية منفصلة مع مجلس الضمان الصحي/نفيس — اتفاقية مشاركة بيانات، أو تعهد أمن معلومات، أو اتفاقية عدم إفشاء، أو مدونة سلوك للموردين؟ يُرجى مشاركة النموذج إن وُجد.
٨. بعد الحصول على الاعتماد، هل توجد إعادة اعتماد دورية، أو مراجعة/تدقيق امتثال مستمر، أو التزام بمستوى خدمة (SLA)، أو أساس منشور لتعليق/إلغاء اعتماد المورد؟

نقدّر توجيهنا لأي دليل رسمي يغطي هذه النقاط.

مع خالص الشكر والتقدير،
[YOUR NAME]
[COMPANY] — [PHONE]
```

**English (fallback):**
```text
Subject: System vendor certification — PKI and sandbox questions

Dear NPHIES onboarding team,

I'm [YOUR NAME], founder of a Saudi software company building a denial-management system for healthcare providers. We're preparing to enter the System Vendor Certification Program and have enrolled in the relevant NPHIES Academy courses. Five questions to complete our plan:

1. PKI certificate: who issues it, what documents/prerequisites are required, expected timeline, cost (if any), and renewal process?
2. Sandbox: what are the steps to obtain test-environment credentials?
3. Conformance testing: what is the required test-case scope, is review automated or manual, and what is the typical time to certification?
4. If we route through a licensed clearinghouse (e.g., Waseel): does the vendor still complete its own vendor certification and PKI, or does clearinghouse routing replace those obligations?
5. Is an official office inside Saudi Arabia required for vendor certification, and what proof is needed?
6. Does system-vendor certification require the vendor to hold professional-indemnity insurance, post a financial bond, or sign an indemnity/liability undertaking with CHI/NHIC? If so, what limits/form?
7. Beyond accepting the NPHIES portal's Terms of Use, must a certified system vendor sign any separate agreement with CHI/NHIC/NPHIES — a data-sharing agreement, information-security undertaking, NDA, or vendor code-of-conduct? Please share the template.
8. After certification, is there periodic re-certification, an ongoing compliance/security audit, an uptime/SLA obligation, or a published basis on which a vendor's certification can be suspended or revoked?

We'd appreciate a pointer to any official guide covering these points.

Best regards,
[YOUR NAME]
[COMPANY] — [PHONE]
```

### Email 3 — Waseel: Connect quote + exact scope *(closes B3 nuance + D1)*
**To:** `bdr@waseel.com` · **CC (optional, Riyadh sales):** `motabberib@waseel.com` · **Follow-up ☎:** 9200 120 99
**🏆 Send the ARABIC version** — Waseel is a Saudi company and its sales team works in Arabic; rapport matters because you may become both customer *and* quasi-competitor. English is acceptable if you prefer precision — their team is bilingual. Keep the key scope question blunt in either language.

**Arabic (recommended):**
```text
الموضوع: استفسار عن نطاق خدمة Connect وعرض سعر لمورد أنظمة

مرحبًا فريق واصل،

أنا [YOUR NAME]، مؤسس شركة برمجيات سعودية نطور نظامًا لإدارة المطالبات المرفوضة لمجموعات العيادات متعددة الفروع، وندرس اعتماد Waseel Connect لربط عملائنا بمنصة نفيس في المرحلة الثانية من منتجنا.

اطلعنا على الباقات المعلنة (Basic بـ1,499 ريال وPremium بـ1,999 ريال شهريًا). ثلاثة أسئلة قبل طلب عرض السعر:

١. سؤال النطاق الأهم: عند تمرير معاملات عملائنا عبر Connect، هل تحمل واصل شهادة PKI واعتماد نفيس عن هذه المعاملات، أم يظل على شركتنا — كمورد أنظمة — استكمال برنامج اعتماد موردي الأنظمة وشهادة PKI الخاصة بنا؟
٢. كيف تُحتسب الباقات عندما يخدم مورد واحد عدة منشآت مزودة (multi-tenant)؟ هل هناك تسعير خاص للموردين/الشركاء؟
٣. هل تتوفر وثائق API للتكامل المباشر مع Connect؟

يسعدنا ترتيب مكالمة قصيرة إن كان ذلك أسهل.

شكرًا جزيلًا،
[YOUR NAME]
[COMPANY] — [PHONE]
```

**English (acceptable alternative):**
```text
Subject: Connect scope question + quote for a software vendor

Hi Waseel team,

I'm [YOUR NAME], founder of a Saudi software company building a denial-management system for multi-branch clinic groups. We're evaluating Waseel Connect to link our clients to NPHIES in Phase 2 of our product.

We've seen the published tiers (Basic SAR 1,499 / Premium SAR 1,999 per month). Three questions before requesting a quote:

1. The key scope question: when our clients' transactions route through Connect, does Waseel carry the NPHIES-side PKI certificate and certification for those transactions — or does our company, as a system vendor, still need to complete the System Vendor Certification Program and hold its own PKI?
2. How do the tiers work when one vendor serves multiple provider organizations (multi-tenant)? Is there vendor/partner pricing?
3. Is API documentation available for direct integration with Connect?

Happy to jump on a short call if easier.

Thanks,
[YOUR NAME]
[COMPANY] — [PHONE]
```

### Email 4 — Oracle: in-Kingdom hosting for PHI *(actions C3)*
**To:** `contact@oracle.com` · **Better parallel channel:** the [Oracle KSA sales form / live chat](https://www.oracle.com/sa/corporate/contact/) — routes straight to the KSA team
**🏆 Send the ENGLISH version** — Oracle KSA sales is a multinational org that runs its pipeline in English; an Arabic email to the global contact@ inbox will be machine-triaged anyway. Mention "me-riyadh-1", "healthcare", and "startup" — those three keywords get you routed to the right rep. The Arabic version is only useful if you land a Saudi account exec later.

**English (recommended):**
```text
Subject: KSA healthcare startup — me-riyadh-1 workload

Hi Oracle Cloud team,

I'm [YOUR NAME], founder of a Saudi healthtech startup building claims-analytics software for healthcare providers (PHI workload — must stay in-Kingdom under PDPL).

We're planning our production deployment on the Riyadh region (me-riyadh-1) and I'd like to speak with a KSA-based rep about:

1. Service coverage in me-riyadh-1: managed PostgreSQL, Kubernetes (OKE), object storage.
2. Oracle for Startups / startup credits eligibility.
3. Any healthcare reference architecture for PDPL-compliant PHI hosting.

Worth a short call this week or next?

[YOUR NAME]
[COMPANY] — [PHONE]
```

**Arabic (only for a later Saudi account exec):**
```text
الموضوع: شركة صحية ناشئة سعودية — استضافة على منطقة الرياض me-riyadh-1

مرحبًا فريق Oracle Cloud،

أنا [YOUR NAME]، مؤسس شركة تقنية صحية سعودية ناشئة نطور نظام تحليلات للمطالبات التأمينية لمقدمي الرعاية (بيانات صحية يجب بقاؤها داخل المملكة وفق نظام حماية البيانات الشخصية).

نخطط لإطلاق بيئة الإنتاج على منطقة الرياض (me-riyadh-1) ونود التحدث مع ممثل داخل المملكة حول:

١. تغطية الخدمات في me-riyadh-1: قواعد بيانات PostgreSQL مُدارة، وKubernetes (OKE)، وتخزين الكائنات.
٢. أهلية برنامج Oracle for Startups والأرصدة المخصصة للشركات الناشئة.
٣. أي بنية مرجعية لاستضافة البيانات الصحية بما يتوافق مع نظام حماية البيانات.

هل يمكن ترتيب مكالمة قصيرة هذا الأسبوع أو القادم؟

[YOUR NAME]
[COMPANY] — [PHONE]
```

### Email 5 — NPHIES/HL7 Saudi: written OK to bundle the IG *(closes F3)*
**To:** `onboarding@chi.gov.sa` · **CC:** `support@nphies.sa` *(HL7 Saudi Arabia has no public inbox — it's still "in establishment"; CHI/NPHIES is the copyright holder's channel)*
**🏆 Send the ARABIC version** (government inbox), keeping the technical/legal terms in English. This one needs a **written** answer — say so explicitly.

**Arabic (recommended):**
```text
الموضوع: طلب إذن كتابي — استخدام حزمة دليل التطبيق nphies-fs داخل منتج برمجي

السلام عليكم ورحمة الله وبركاته،

فريق منصة نفيس المحترم،

نحن شركة برمجيات سعودية نطور نظامًا للتحقق من جودة المطالبات لمقدمي الرعاية، ونستخدم دليل التطبيق (Healthcare Financial Services IG — حزمة nphies-fs#1.0.0) للتحقق الآلي من توافق الحزم (validation) داخل بيئة التطوير.

لاحظنا أن حقوق الدليل محفوظة لـ HL7 Saudi Arabia مع ترخيص HL7/FHIR ولا يوجد نص صريح يسمح بإعادة التوزيع. لذلك نطلب تأكيدًا كتابيًا حول:

١. هل يجوز تضمين ملفات الدليل (StructureDefinitions / ValueSets) داخل منتجنا التجاري أو أنظمة الاختبار الآلي (CI) الخاصة بنا؟
٢. إن لم يجز، ما القناة الصحيحة للحصول على ترخيص بذلك؟

نلتزم بأي شروط ترخيص تحددونها، ونقدّر تزويدنا بالرد كتابيًا لاعتماده في ملفات الامتثال لدينا.

مع خالص الشكر،
[YOUR NAME]
[COMPANY] — [PHONE]
```

**English (fallback):**
```text
Subject: Written permission request — bundling the nphies-fs IG package in a software product

Dear NPHIES team,

We are a Saudi software company building a claims-quality validation system for healthcare providers. We use the Healthcare Financial Services IG (package nphies-fs#1.0.0) for automated bundle validation in our development pipeline.

We note the IG is copyright HL7 Saudi Arabia under the HL7/FHIR license, with no explicit redistribution grant. We'd appreciate written confirmation on:

1. May we bundle IG artifacts (StructureDefinitions / ValueSets) inside our commercial product or CI systems?
2. If not, what is the correct channel to obtain such a license?

We'll comply with any license terms you specify, and would appreciate the answer in writing for our compliance records.

Many thanks,
[YOUR NAME]
[COMPANY] — [PHONE]
```

### Email 6 — KSA privacy counsel: PDPL review + DPA *(actions C1 + G8 + G12 + G13 + G14)*
**To:** `[law firm — get a referral first; e.g., a KSA-licensed firm with SDAIA/PDPL practice]`
**🏆 Send the ENGLISH version** — KSA corporate/tech law firms run engagement intake in English, and legal precision matters more than rapport here. ⚠️ **Better in person:** use this email as the follow-up brief after a referral or scoping call, not as the opener (see in-person list above).
**🆕 Updated 2026-07-18** with 4 new scope items (4-7) from the KSA compliance audit pass — see **§G** below for the research behind each. This firm can likely also give a one-line read on the **founder-nationality-dependent business-registration path (§G2/G3)** and the **SAMA perimeter check (§G6)** in the same engagement — worth asking, not urgent enough to be a numbered item here.

**English (recommended):**
```text
Subject: PDPL scoping — health-data SaaS, DPA drafting

Dear [NAME],

I'm [YOUR NAME], founder of [COMPANY], a Saudi SaaS product that analyzes health-insurance claims data (PHI) for clinics, hosted in-Kingdom on Oracle Cloud Riyadh.

We're looking to engage counsel for a fixed-scope review before GA:

1. Data-flow review: confirm no PHI crosses the border (including logging, analytics, backups, and transactional email).
2. Draft our standard Data Processing Agreement (DPA) with clinics under PDPL.
3. Flag any SDAIA registration/notification duties that apply to us as a processor.
4. Confirm the Saudi Standard Contractual Clauses (SCC) form needed for our US-based LLM subprocessor (Anthropic) transfer, and produce the SDAIA cross-border risk assessment required for sensitive/health data transfers (using the dgp.sdaia.gov.sa tool).
5. Review the NPHIES portal's Terms & Conditions (nphies.sa/terms-and-conditions) — it's a binding agreement with a liability waiver, an indemnity clause running in NPHIES's favor, and a suspend-without-notice right; we'd like your read on the business risk before we connect.
6. Help us draft a breach-notification runbook meeting SDAIA's 72-hour notification requirement (no materiality threshold, no exemptions) — detection through SDAIA notification through data-subject notification.
7. Make the controller-vs-processor determination for our clinic relationship, and tell us whether that triggers National Data Governance Platform registration or a mandatory DPO appointment on our side.

Could you share your availability for a 30-minute scoping call and an estimate for the above?

Best regards,
[YOUR NAME]
[COMPANY] — [PHONE]
```

**Arabic (alternative):**
```text
الموضوع: نطاق عمل — مراجعة الامتثال لنظام حماية البيانات الشخصية لمنتج صحي سحابي

الأستاذ/ة [NAME] المحترم/ة،

أنا [YOUR NAME]، مؤسس [COMPANY]، منتج سحابي سعودي يحلل بيانات المطالبات التأمينية الصحية للعيادات، ومستضاف داخل المملكة على Oracle Cloud الرياض.

نرغب بتكليف مستشار قانوني بنطاق محدد قبل الإطلاق العام:

١. مراجعة تدفق البيانات: التأكد من عدم خروج أي بيانات صحية خارج المملكة (شاملًا السجلات والتحليلات والنسخ الاحتياطي والبريد).
٢. صياغة اتفاقية معالجة البيانات (DPA) الموحدة مع العيادات وفق نظام حماية البيانات الشخصية.
٣. تحديد أي التزامات تسجيل أو إشعار لدى سدايا تنطبق علينا كمعالج بيانات.
٤. تحديد الصيغة المناسبة من العقود النموذجية السعودية (SCC) اللازمة لنقل البيانات إلى مزود نموذج اللغة الأمريكي (Anthropic)، وإعداد تقييم مخاطر النقل عبر الحدود المطلوب من سدايا للبيانات الحساسة/الصحية (باستخدام أداة dgp.sdaia.gov.sa).
٥. مراجعة الشروط والأحكام الخاصة ببوابة نفيس (nphies.sa/terms-and-conditions) — فهي اتفاقية ملزمة تتضمن إخلاء مسؤولية، وبندًا للتعويض لصالح نفيس، وحق تعليق الوصول دون إشعار مسبق؛ نرغب برأيكم في المخاطر التجارية قبل الربط.
٦. المساعدة في صياغة خطة استجابة للإبلاغ عن الاختراقات تتوافق مع مهلة الإبلاغ لسدايا خلال ٧٢ ساعة (دون حد أدنى للجسامة ودون استثناءات) — من الاكتشاف إلى إشعار سدايا إلى إشعار أصحاب البيانات.
٧. تحديد ما إذا كنا نُعد "متحكمًا" أو "معالجًا" في علاقتنا مع العيادات، وهل يستوجب ذلك التسجيل في منصة الحوكمة الوطنية للبيانات أو تعيين مسؤول حماية بيانات (DPO) من جانبنا.

هل يمكن ترتيب مكالمة تعريفية لمدة ٣٠ دقيقة مع تقدير مبدئي للتكلفة؟

مع خالص التقدير،
[YOUR NAME]
[COMPANY] — [PHONE]
```

### Email 7 — Design-partner clinic: free denial audit *(unblocks A1/A2 the reliable way)*
**To:** `[clinic owner / medical director — enrich via the §6 target list in 01_market_and_gtm.md]`
**🏆 Send the ARABIC version** — targets are Saudi physician-owners (File 1 §5 persona); Arabic converts better with this segment. ⚠️ **Best used after a warm referral or WhatsApp intro** (see in-person list). Full 5-touch sequence + WhatsApp scripts already live in `01_market_and_gtm.md` §7 — this is the first touch, aligned to that sequence.

**Arabic (recommended):**
```text
الموضوع: مطالبات {{clinic_name}} المرفوضة

مرحبًا د. {{first_name}}،

مع تشغيل {{branch_count}} فروع على التأمين في {{city}}، غالبًا ما يتسرب جزء من الإيرادات في المطالبات المرفوضة — دون أن يظهر بوضوح أي شركة تأمين أو أي كود هو السبب.

نقدم تدقيقًا مجانيًا كاملًا: ترسلون لنا ملفات نفيس (ClaimResponse) لآخر ٦ أشهر، ونعيد لكم خلال أيام تقريرًا يوضح: نسبة الرفض الفعلية لديكم، وأكثر ٥ أسباب تكرارًا، والمبلغ القابل للاسترداد بالريال.

التقرير لكم بالكامل سواء عملنا معًا بعدها أم لا.

هل يهمك الاطلاع على عينة تقرير؟

[YOUR NAME]
[COMPANY] — [PHONE]
```

**English (fallback for English-preferring management):**
```text
Subject: {{clinic_name}} denied claims

Hi Dr. {{first_name}},

Running {{branch_count}} insured branches in {{city}}, some revenue almost always leaks into denied claims — without it being clear which payer or which code is responsible.

We offer a complete free audit: you send us your NPHIES ClaimResponse exports for the last 6 months, and within days we return a report showing your actual denial rate, your top 5 recurring denial reasons, and the recoverable amount in SAR.

The report is yours either way — whether we work together afterwards or not.

Want to see a sample report?

[YOUR NAME]
[COMPANY] — [PHONE]
```

### Email 8 — AWS: me-central-2 GPU access for in-Kingdom LLM hosting *(actions C1/C3, the self-host route)*
**To:** `aws-activate@amazon.com` (verified program inbox) · **Also:** [AWS Contact Sales](https://aws.amazon.com/contact-us/sales-support/) form for a KSA-specific rep
**🏆 Send the ENGLISH version** — AWS runs its startup/sales pipeline in English globally; a KSA-specific rep gets assigned after intake, same pattern as the Oracle email above. Keep the Arabic version for a later Saudi account exec, same treatment as Oracle's Email 4.

**English (recommended):**
```text
Subject: Riyadh region — GPU access question

Hi AWS team,

Saw me-central-2 (Riyadh) went GA in January — good timing. We're building a health-claims SaaS for Saudi clinics and need AI inference to stay entirely in-Kingdom under PDPL, so we're evaluating self-hosting an open-weight model (Qwen3 or a Llama-class model) on GPU/Trainium instances instead of calling a US-based API.

Two questions:
1. Which GPU/Trainium instance types are actually available in me-central-2 today (not just announced elsewhere)?
2. Are we eligible for AWS Activate credits as a pre-revenue KSA startup, and does that apply to me-central-2 workloads specifically?

Worth a short call with a Riyadh-based rep?

[YOUR NAME]
[COMPANY] — [PHONE]
```

**Arabic (only for a later Saudi account exec):**
```text
الموضوع: استفسار — الوصول لمعالجات GPU في منطقة الرياض

مرحبًا فريق AWS،

اطلعنا أن منطقة me-central-2 (الرياض) أصبحت متاحة رسميًا في يناير. نبني منتج SaaS سعودي لتحليل مطالبات التأمين الصحي، ونحتاج إبقاء استدلال الذكاء الاصطناعي داخل المملكة بالكامل وفق نظام حماية البيانات الشخصية، لذا ندرس استضافة نموذج مفتوح المصدر (مثل Qwen3) بدلًا من الاتصال بواجهة أمريكية.

سؤالان:
١. ما أنواع معالجات GPU/Trainium المتوفرة فعليًا في منطقة الرياض اليوم؟
٢. هل نحن مؤهلون لرصيد AWS Activate كشركة ناشئة سعودية قبل الإيرادات، وهل ينطبق على أحمال منطقة الرياض تحديدًا؟

هل يمكن ترتيب مكالمة قصيرة مع ممثل من الرياض؟

[YOUR NAME]
[COMPANY] — [PHONE]
```

### Email 9 — CNTXT: GCP Dammam access for in-Kingdom LLM hosting *(actions C1/C3, alternative self-host route)*
**To:** `contact@cntxt.com` (verified general inbox) · **Also:** [CNTXT Google Cloud reseller program](https://cntxt.com/google-cloud-reseller-program/) contact form for sales routing
**🏆 Send the ARABIC version** — CNTXT is a Saudi company; same reasoning as the Waseel email above.

**Arabic (recommended):**
```text
الموضوع: استفسار — الوصول لمنطقة الدمام لتشغيل نموذج ذكاء اصطناعي

مرحبًا فريق CNTXT،

نبني منتجًا سحابيًا سعوديًا لتحليل مطالبات التأمين الصحي للعيادات، ونحتاج تشغيل نموذج ذكاء اصطناعي مفتوح المصدر (مثل Qwen3) بالكامل داخل المملكة تجنبًا لنقل البيانات عبر الحدود بموجب نظام حماية البيانات الشخصية.

ثلاثة أسئلة قبل التسجيل:

١. ما خطوات التسجيل كعميل ناشئ للوصول إلى منطقة الدمام؟
٢. هل تتوفر معالجات GPU مناسبة لتشغيل نماذج مفتوحة المصدر (حتى فئة 70B معامل) في هذه المنطقة؟
٣. هل توجد باقة أسعار مخفضة أو رصيد تجريبي للشركات الناشئة؟

يسعدنا ترتيب مكالمة قصيرة إن كان ذلك أسهل.

[YOUR NAME]
[COMPANY] — [PHONE]
```

**English (acceptable alternative):**
```text
Subject: Dammam region access — LLM hosting question

Hi CNTXT team,

We're building a Saudi SaaS product analyzing health-insurance claims for clinics, and need to run an open-weight AI model (e.g. Qwen3) entirely in-Kingdom to avoid cross-border data transfer under PDPL.

Three questions before we sign up:
1. What's the onboarding process for a startup to access the Dammam region?
2. Are GPU instances suitable for running open-weight models (up to 70B-class) available there?
3. Is there a startup pricing tier or trial credit?

Happy to jump on a short call if easier.

[YOUR NAME]
[COMPANY] — [PHONE]
```

---

### Email 10 — HealthOrbit: NPHIES-specific pricing *(actions D2 — pricing genuinely not public)*
**To:** `info@healthorbit.ai` (mailto target behind their "sales@healthorbit.ai" link — verified 2026-07-19 via their live site footer; use `sales@healthorbit.ai` in the To: line as displayed, it routes to the same inbox) · **Also:** their self-serve demo form at [healthorbit.ai/schedule-a-demo](https://healthorbit.ai/schedule-a-demo/) — no email needed, but it only books a 30-min product walkthrough (Ambient AI Scribe / ORA reception / Medical Coding Engine / Claim Scrubber) and does not surface pricing or ask what you actually need pricing for; use the email below to get pricing before or instead of booking.
**Note (2026-07-19 site check):** HealthOrbit's listed offices are UK/India/US only (Manchester, Mohali, Austin) — no Saudi/GCC office found on the site. Confirm during the exchange whether they have real NPHIES-market presence or are pitching a generic international claim-scrubber into KSA.

**English:**
```text
Subject: NPHIES-market pricing — Claim Scrubber / Medical Coding Engine

Hi HealthOrbit team,

We're building a Saudi denial-management SaaS for mid-market clinic groups (NPHIES claims). Your Claim Scrubber and Medical Coding Engine look adjacent to what we do, and your pricing isn't published anywhere we could find.

Three questions before we book a demo:
1. Do you have live NPHIES connectivity today (eligibility, pre-auth, claims submission), or is validation/scrubbing the current depth?
2. What does pricing look like for a mid-market KSA clinic group (roughly 5-10 branches)?
3. Any existing Saudi clients or in-Kingdom hosting/data-residency setup, given PDPL?

Happy to jump on a call if that's faster than email.

[YOUR NAME]
[COMPANY] — [PHONE]
```

---

### Email 11 — Ecaresoft: NPHIES-specific pricing + Claims-module status *(actions D2 — pricing genuinely not public, and 2021 doc calling Claims module "in progress" may be stale)*
**To:** `sales@ecaresoft.com` (verified 2026-07-19, live site footer)
**Note:** Ecaresoft's healthcare products are separate branded sites — Cirrus (hospitals, [getcirrus.com](https://www.getcirrus.com/en)) and Nimbo (small/ambulatory clinics, [nimbo-x.com](https://www.nimbo-x.com/)). The clinic-group ICP is closer to Nimbo; mention both so sales routes you correctly.

**English:**
```text
Subject: NPHIES pricing + Claims module status (Cirrus/Nimbo)

Hi Ecaresoft team,

We're building a Saudi denial-management SaaS for mid-market private clinic groups on NPHIES. We've seen documentation that Eligibility + Pre-Auth are live on production for you, with full Claims + Payment reconciliation "in progress" — that reference is from 2021, so:

1. Is the Claims + Payment reconciliation module now fully live on NPHIES production?
2. What does pricing look like for a mid-market KSA clinic group (roughly 5-10 branches) — Nimbo or Cirrus, whichever fits?
3. Any KSA-specific compliance notes (PDPL data residency, SFDA) worth knowing before we compare notes?

Happy to jump on a call if that's faster than email.

[YOUR NAME]
[COMPANY] — [PHONE]
```

---

## H. In-Kingdom LLM-hosting alternatives *(research 2026-07-19 — ties into C1's cross-border question)*

> Triggered by asking "would switching LLM provider to one with an in-Kingdom data center help C1?" Researched Bedrock, AWS Riyadh, GCP Dammam, on-prem, and open-source self-hosting. **Bottom line: switching to genuine in-Kingdom inference kills the cross-border-transfer piece of C1 (no SCC, no SDAIA risk-assessment for that leg) — but does NOT remove general PDPL duties (DPA, breach notification, controller/processor call) which apply regardless of hosting location.**

| Option | What it is | Limitation | Blockers it solves |
|---|---|---|---|
| **AWS Bedrock (Claude via cross-Region inference)** | Anthropic's Claude models reachable from Middle East (UAE/Bahrain) via Bedrock's global cross-Region routing, launched Feb 2026 | **Does NOT solve C1.** Not a dedicated in-Kingdom deployment — AWS's own docs say the request "travels over the AWS Global Network" to wherever Bedrock actually serves that model (undisclosed, not KSA). Same cross-border exposure as calling Anthropic directly, arguably murkier | None — do not use as a C1 fix |
| **AWS me-central-2 (Riyadh) self-hosted open-weight model** | AWS's Saudi region, **GA since Jan 2026**, AI-native (Trainium/Inferentia + Nvidia GPU clusters). Self-host Qwen3/Llama/DeepSeek entirely in-Kingdom | Requires standing up + operating your own inference stack (not a managed API) — new ops surface. Quality vs Claude unverified for AI-2 (appeal drafting) — must eval before committing | **Kills C1's cross-border leg entirely** for AI-2/AI-4 (no SCC, no SDAIA risk-assessment for that transfer). Also actions C3 (in-Kingdom host, alternative to Oracle) |
| **GCP Dammam (via CNTXT)** | Real GCP region since Nov 2023, "Sovereign Controls by CNTXT" GA 2026 | **Gated — not self-serve.** Only accessible through CNTXT (Google's exclusive KSA reseller, CST Class C license). Adds a vendor-relationship/procurement step before you can even provision anything | Same as AWS row, **if** CNTXT relationship is worth the overhead — not yet confirmed whether they support GPU/LLM workloads (Email 9 asks this) |
| **On-premises (owned hardware, in-Kingdom)** | Full physical control, hardware inside your own facility | Heaviest capex/ops lift for a pre-revenue founder-led team — only makes sense once volume justifies owning GPUs | Same cross-border kill as the AWS/GCP self-host rows, with zero ambiguity (data never leaves a building you control) — but not a near-term move |
| **Open-weight models (Qwen3-235B, DeepSeek R1, Llama 4 Scout, medical-tuned Llama variants)** | Mature enough by 2026 for real production use — Qwen3 leads general reasoning/coding, DeepSeek R1 leads math, Llama 4 Scout leads long-context; medical-tuned variants beat general models on healthcare benchmarks | 70B-class needs real GPU (one H100/L40S at INT4 — single-node, not a cluster, but still real infra). No vendor BAA needed since you control the infra — but also no vendor accountability if it underperforms | Removes the **model-vendor transfer question entirely** (you're not sending PHI to any third party) — pairs with the AWS/GCP/on-prem rows above, doesn't stand alone (still needs somewhere in-Kingdom to run) |

---

## I. Zero-CR-needed action list *(compiled 2026-07-19 — what's actually doable before the CR number lands)*

> NPHIES Academy login **confirmed blocked** on CR (founder's own login attempt, 2026-07-19). Waseel **ruled out entirely** regardless of CR (hospital/provider portal, not a vendor path — see B3). This table is what's left that genuinely doesn't need a CR.

| # | Action | Why no CR needed |
|---|---|---|
| 1 | Follow up CHI DMO (Email 1, A1/A2 denial stats) — call 19977 if no reply | Pure data-sharing request, not a vendor relationship |
| 2 | Send Oracle (Email 4, C3 hosting) | Rep/founder conversation, evaluation stage only |
| 3 | Send Email 5 (F3, IG bundling permission) | Written-permission ask — may still bounce back "need CR" like the Academy did, but zero cost to try |
| 4 | Send AWS (Email 8) + CNTXT (Email 9) — new, this pass | Same logic as Oracle — evaluation/credits inquiry, not a contract |
| 5 | ~~HealthOrbit/Ecaresoft demo requests~~ **DONE — neither publishes pricing, no self-serve path exists; drafted Email 10/Email 11 instead** (D2 pricing) | Vendor demos, no CR field on a demo request |
| 6 | Branch counts / insured-mix (E1), confirm "Nabda" (E2) — **research in progress 2026-07-19, see E1/E2 for latest** | Manual research/calls, nothing vendor-facing |
| 7 | KSA privacy counsel — scoping call/referral only (C1, G12-G14) | Consultation ≠ filing; filing needs the entity, the conversation doesn't |
| 8 | ~~Read NPHIES portal ToU yourself~~ **DONE 2026-07-19 — full text pulled directly from the live page, see G8** (G8) | Reading a public page, no acceptance/account action |
| 9 | **Start CR formation now** (G4 — standard CR, no MISA, founder confirmed Saudi) | This is the actual bottleneck — everything above just fills the wait, this is what ends it |

**Confirmed CR-blocked (not worth re-attempting until CR exists):** NPHIES Academy enrollment, B1/B2 PKI+conformance submission, G5 real-PHI ingestion, G8/G9 signing any vendor agreement, G12-G14 filing (SDAIA registration, DPO, DPA/SCC).

> **Send order:** 1b (Academy, self-serve, today) → Emails 1 + 2 same day (gov replies are slow; start the clock) → Email 3 (Waseel) → Email 4 (Oracle) → Email 7 via referral/WhatsApp as soon as one warm intro exists → Email 5 anytime before Phase-2 build → Email 6 after a counsel referral.
