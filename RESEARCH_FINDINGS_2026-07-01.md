# Research Findings — 2026-07-01
### Deep-research pass on `HUMAN_CONFIRMATION_NEEDED.md` (103 agents, 20 sources, 68 claims, 25 adversarially verified)

> **🆕 2026-07-02 third pass (double-check + contact hunt, ~100 agents):** see the appendix at the bottom of this file. Headline: **all remaining ❌/🔒 verdicts STAND**; new finds = `DMO@chi.gov.sa` data-request channel, `onboarding@chi.gov.sa` vendor contact, B1/B2 docs are **NPHIES-Academy-gated** (not secret), the SAR-3B figure's academic echo still traces only to Glance Care (as **3.5–4.5B**), and derived total private claims ≈ **SAR 37.5B/yr** (CHI 2023).

> Method: fan-out web search → fetch → **3-vote adversarial verification** (need 2/3 to kill) → synthesis.
> Synthesis + the last verification/vendor slice **failed on a session limit** (reset 6:10pm Asia/Riyadh). Gaps flagged **⏳ RE-RUN** below.
> Legend: ✅ CONFIRMED (primary) · 🟥 UNCONFIRMED-NO-PRIMARY-SOURCE · 🆕 new vs brief · ⏳ needs re-run.

---

## A. Market & denial economics

### A1 — National denial/rejection rate (~25%) → 🟥 STILL UNCONFIRMED (now with strong evidence)
**CHI annual-report PDFs were FOUND and READ in full** — the core ask.
- **CHI Annual Report 2023** (192 pp): `chi.gov.sa/en/MediaCenter/ANNUAL REPOR/Annual Report 2023.pdf` — full text extracted. Reports NPHIES achievement metrics (243M insurance transactions, 100M through NPHIES, 11.94M coverage services, **96.62% overall KPI achievement**). **No denial/rejection-rate figure of any kind.**
- **CCHI/CHI Annual Report 2020** (60 pp): `chi.gov.sa/en/Studies/AnnualReports/Documents/CCHI Report 2020 v2.0 English.pdf` — reports **loss ratio 83%**, retention 96%, **net claims incurred SAR 17.991B**. **No denial rate.** (Loss ratio = claims cost ÷ premiums — actuarial, NOT a denial rate. Do not conflate.)
- Index of all 17 reports (2007–2024): `chi.gov.sa/en/MediaCenter/Pages/annual-reports.aspx`. 2024 report published 02/06/2025.
- The **"15–25%"** number traces ONLY to a **Glance Care vendor whitepaper** (blog, self-estimated) — `glance.care/whitepapers/saudi-healthcare-providers-denied-billions-sar-insurance`. Not official.

**Verdict:** No national private-insurance denial rate exists in any CHI primary source. Keep leading with the **free audit** (clinic's own `ClaimResponse` number). Never quote a national %.

### A2 — National denied-claim value (~SAR 3B/yr) → 🟥 UNCONFIRMED / effectively DENIED
The **"3 billion SAR" appears only in the Glance Care whitepaper TITLE** — unsubstantiated in its body. Zero CHI figure. No primary source. Do not put a SAR TAM number on a deck.

### A3 — Najran coding-error study → ✅ CONFIRMED (exists + correctly scoped)
Confirmed across 4 primary sources (PMC11342027, PMC10727934, PubMed 38111668, ScienceDirect S1319016423003894):
- Single **50-bed public-sector hospital**, Najran (Armed Forces Hospital network). July 2021–Feb 2022. ICD-10-AM.
- Primary-dx miscoding **26.8%** (57/213), secondary **9.9%** (21). Loss **SAR 12,927** (~USD 3,443) at that one hospital.
- Measures **clinical coding accuracy vs DRG reimbursement — NOT a national insurance denial rate.**
**Verdict:** always cite as "single-hospital coding study." Never as a market-wide rate. (Brief was correct.)

---

## B. NPHIES technical onboarding

### B3 — Clearinghouse REQUIRED vs direct allowed → ⚠️ PARTIAL (vendor source only)
Direct integration **OR** clearinghouse — **both allowed, clearinghouse NOT mandatory.** Source: Cirrus vendor blog (`getcirrus.com/en-blog/nphies-for-hospitals-and-clinics-in-saudi-arabia`): *"organizations will either need to complete a direct integration of the HIS to NPHIES or … use a clearing house solution."* **Not yet confirmed from an NPHIES primary doc** (the onboarding-docs fetch agent errored mid-stream).

### Your added question — "Does a clearinghouse SOLVE B1 (PKI cert) + B2 (conformance)?" → 🟥 NOT SUPPORTED (2nd pass, salvaged from run `wswpzwi2m`)
**Answer: no primary source supports "clearinghouse removes your B1/B2" — and the evidence points the other way.**
- **Waseel Connect page is SILENT** (verified 3-0, `waseel.com/connect/` + `waseel.com/resources/seamless-nphies-integration/`): it does **not** state that routing through Waseel removes a vendor's own NPHIES PKI cert (B1) or its own conformance/sandbox testing (B2), and makes no licensed/accredited-clearinghouse claim.
- **PKI is issued PER-ORGANIZATION** (Cirrus blog: *"every NPHIES-connected organization receives its own PKI"*).
- **NPHIES runs an official "System Vendor Certification Program"** — a vendor onboarding/certification track (incl. "Vendor Certification and Onboarding" + FHIR training) that vendors complete **themselves, independent of any clearinghouse**.
- **NPHIES IG intro + conformance pages** (primary) are silent on B1/B2/B3 — they don't resolve it either way.
**Verdict:** the earlier "clearinghouse = less PKI/conformance lift" assumption is **UNCONFIRMED and partially contradicted**. Even via a clearinghouse, a software vendor likely still faces NPHIES's own vendor certification. Confirm the exact scope with NPHIES onboarding + Waseel directly.

### B3 — direct vs clearinghouse → ✅ direct integration IS permitted (not clearinghouse-mandated)
Confirmed across sources (Cirrus, NPHIES IG intro doesn't prohibit direct): NPHIES connectivity is achievable **either** by direct HIS-to-NPHIES integration **or** via a clearinghouse — direct is a permitted option, not forced through a middleman.

### B1 (PKI issuance) / B2 (sandbox+conformance steps) → 🔒 still human-action (unchanged)
No public primary source resolves the exact steps. Still a phone/portal task to NPHIES onboarding (`portal.nphies.sa`).

---

## C. Compliance & hosting

### C1 — PDPL cross-border → ✅ framework holds
KSA is **not** a localization-ban jurisdiction; cross-border transfer permitted under conditions; **stricter path for sensitive/health data**. Source: King & Spalding legal analysis (`kslaw.com/.../international-personal-data-transfers-under-saudi-arabias-data-protection-law`). Keep PHI in-Kingdom = clean. Human sign-off (counsel + DPA) still required.

### C2 — CBAHI → ✅ accredits facilities/providers, NOT software vendors. No requirement on you. (Confirmed, gmsarabia.)

### C3 — In-Kingdom cloud regions → 🆕 MATERIAL UPDATE
- **AWS KSA:** GA target **2026, NOT yet live.** $5.3B invest. (Amazon press, primary.)
- **Azure KSA (Saudi Arabia East):** **Q4 2026, not yet GA.** (Microsoft, Feb 2026, primary.)
- **🆕 Oracle Cloud Riyadh (`me-riyadh-1`): LIVE / GA since Aug 6 2024.** (Oracle, primary.) **Brief said Oracle "unconfirmed" — it now has a confirmed, operational in-Kingdom region TODAY.** → viable interim residency host before AWS/Azure go GA. Biggest new finding.

---

## D. Competitors

### D1 — Waseel Connect pricing → ✅ CONFIRMED (primary, `waseel.com/connect`)
- **Basic SAR 1,499/mo** (≤500 transactions)
- **Premium SAR 1,999/mo** (≤1,500 transactions)
- **Enterprise** — custom quote (unlimited)
Matches the brief. A denial-management vendor's tier depends on transaction volume — confirm in a Waseel scoping call.
*(Insta KSA HMS SAR 190–225/user/mo — not re-verified this run; vendor agent errored. Treat as prior.)*

### D2 — HealthOrbit / Ecaresoft pricing + NPHIES depth → ✅ RESOLVED (2nd pass)
- **HealthOrbit:** **no pricing published** (only a pricing-page link, zero rates in-content). NPHIES depth = an **NPHIES "validation" tool + native schema mapping** — but **no documented live claims submission, eligibility, PKI, conformance, or Waseel connectivity.** Holds HIPAA/GDPR/ISO27001/SOC2 certs — **none NPHIES-specific.** The "130M+ transactions" it cites = NPHIES portal throughput, not HealthOrbit's own volume. → shallow/validation-tier NPHIES, pricing unconfirmed.
- **Ecaresoft (Cirrus/Nimbo HIS):** **no pricing disclosed.** NPHIES: **Eligibility + Pre-Authorization LIVE on production; full Claims management + Payment reconciliation "in progress"** (per its 2021 brochure). Readiness via **internal code-mapping** to NPHIES/CCHI-BS/SFDA — no clearinghouse/Waseel/PKI/FHIR architecture mentioned. Says its systems were NPHIES-tested and passed admin + transactional use cases. → partial live NPHIES, pricing unconfirmed.

---

## F. Research artifacts → ✅ RESOLVED (2nd pass)
- **F1 arXiv:2602.05374 → EXISTS but MISATTRIBUTED.** The ID resolves (HTTP 200) to *"Cross-Lingual Empirical Evaluation of Large Language Models for Arabic Medical Tasks"* — **NOT** a claim-denial thesis. Do not cite it for denial content. The **SUNY Binghamton three-stage-denial thesis** remains **UNCONFIRMED** (no stable citation found; the real US denial paper is `arXiv:2007.06229` "Deep Claim", unrelated to Binghamton).
- **F2 `Fadil369/NPHIES` → CONFIRMED EXISTS** (GitHub API): public, **MIT license**, **0 stars / 2 forks / 3 open issues**, created 2025-08-13, last push 2025-08-14 (~16 commits single-day burst, inactive since), Go, ~158 KB. Early-stage/low-adoption — safe as a *reference sketch only*, not an architecture dependency. (Separate `Fadil369/HealthLinc` = architectural template, ~1★, not production.)
- **F3 NPHIES IG license → RESTRICTED, as feared.** Copyright *"IG © 2024+ HL7 Saudi Arabia"*; StructureDefinition pages carry *"Used by permission of HL7 International, all rights reserved"* + a Creative Commons reference + the FHIR License; **no unrestricted open-source grant.** Each terminology artifact carries its **own** license terms. **Commercial redistribution/bundling into your product/CI is NOT clearly permitted — confirm with NPHIES/HL7 before bundling.**

---

## Bottom line
- **CHI PDFs read directly → the ~25% denial rate and ~SAR 3B both remain UNCONFIRMED; both trace to a single vendor whitepaper.** You now have proof you looked at the primary source.
- **Najran study confirmed and correctly scoped** (single-hospital coding, not denial rate).
- **🆕 Oracle Riyadh cloud region is live now** — a real in-Kingdom hosting option today.
- **Waseel pricing confirmed from primary.**
- **2nd pass (run `wswpzwi2m`, salvaged from transcripts — synthesis crashed but agents completed):** clearinghouse does **NOT** confirmedly remove B1/B2 (Waseel silent, PKI per-org, NPHIES has its own vendor-certification program); direct integration permitted (B3). D2 pricing unpublished for both; Ecaresoft has partial-live NPHIES, HealthOrbit validation-tier only. F1 arXiv misattributed, F2 repo exists (MIT, early-stage), F3 IG license restricted.

### Sources (primary)
CHI 2023 · CHI 2020 · CHI report index · waseel.com/connect · PMC11342027 · PMC10727934 · PubMed 38111668 · ScienceDirect S1319016423003894 · Amazon AWS KSA press · Microsoft Azure KSA · Oracle me-riyadh-1 · King & Spalding PDPL.

---

## 🆕 Appendix — Third pass, 2026-07-02 (double-check + contact-email hunt)

> Method: same harness (fan-out search → fetch → 3-vote adversarial verify → synthesize). First run died on a session limit mid-verify (~60 votes lost); claims below carry **direct quotes from primary URLs**; votes marked where completed. Re-run launched after 6am reset.

### Part 1 — remaining claims re-tested: ALL VERDICTS STAND

**A1 (national denial rate) — still ❌, evidence now stronger:**
- CHI open-data **Statistics & Indicators** page ([chi.gov.sa/en/open-data](https://www.chi.gov.sa/en/open-data/Pages/Indicators-and-statistics.aspx)) lists only beneficiary stats + "Number of Claims in Nafis" — **no denial/rejection figures** (✅ 3-0).
- CHI Annual Report 2023: rejections appear only **qualitatively** ("Rejected Committee", rejection-reduction workshops) — no %.
- Peer-reviewed **Al-Kahtani, Nov 2025** (*Insurance Markets & Companies*, [businessperspectives.org PDF](https://www.businessperspectives.org/images/pdf/applications/publishing/templates/article/assets/23345/IMC_2025_02_Al-Kahtani.pdf)): "empirical data on claim rejection rates in Saudi Arabia is sparse" in the literature.
- 🆕 Lever: CHI runs a formal **Data Sharing Request** channel — **Data Management Office, `DMO@chi.gov.sa`** ([access-data page](https://www.chi.gov.sa/en/open-data/Pages/access-data.aspx), ✅ 3-0).

**A2 (national denied-SAR value) — still ❌, vendor-trace academically corroborated:**
- The Al-Kahtani paper cites the figure as **SAR 3.5–4.5B** — and its ONLY source (ref 22) is the **Glance Care 2022 vendor knowledge-center page**. The academic echo is NOT independent; do not cite it as such.
- 🆕 Derived context now usable: CHI 2023 states medicines = SAR 6B = **16% of total claims value → total private claims ≈ SAR 37.5B/yr** (cite as "derived from CHI 2023").

**B1/B2 (PKI + sandbox/conformance) — still 🔒, but the gate is LOCATED:**
- [portal.nphies.sa/ig/conformance.html](https://portal.nphies.sa/ig/conformance.html): FHIR profile SHALL/SHOULD only — **zero** PKI/sandbox/test-procedure content.
- Docs are **Academy-gated, not secret**: [v-academy course 11 "System Vendors Onboarding Course"](https://v-academy.nphies.sa/courses/11/system-vendors-onboarding-course?lang=en) — completing it is **a requirement for linking with the platform** (mandatory vendor-certification track confirmed); [academy course 6 "Registering in nphies Platform"](https://academy.nphies.sa/courses/6/registering-in-nphies-platform?lang=en) includes downloadable **"nphies Registration Guide V1.3"**. Detailed steps sit behind course completion + unified-portal registration.
- ⚠️ Reported (nphies.sa FAQ content): system vendors must maintain an **official office inside Saudi Arabia** — verify on call.
- nphies.chi.gov.sa (vendor-cert program site) unreachable this pass (ERR_EMPTY_RESPONSE) — retry later.

**Waseel-scope — still unconfirmed (unchanged):** [waseel.com/connect](https://waseel.com/connect/) remains silent on carrying a vendor's PKI/conformance; tiers re-confirmed (SAR 1,499 / 1,999 / Enterprise).

### Part 2 — contact roster (all from primary sources)

| Target | Email | Phone | Source |
|---|---|---|---|
| CHI data requests | **DMO@chi.gov.sa** | 19977 / 920001177 | chi.gov.sa access-data page (✅ 3-0) |
| CHI general | info@chi.gov.sa | 19977 | chi.gov.sa Contact page + 2023 report back matter |
| NPHIES onboarding / vendor cert | **onboarding@chi.gov.sa** | 920033808 | NPHIES Academy FAQ (academy.nphies.sa/page/7) |
| NPHIES onboarding (variant) | onboarding@cchi.gov.sa | 920004299 | CHI public-provider onboarding PDF (chi.gov.sa/Rules/article11) |
| NPHIES platform support | support@nphies.sa | 920033808 | nphies.sa |
| CHI billing standards / unlisted codes | cchi-bs@cchi.gov.sa | — | CHI onboarding PDF |
| Waseel business | **bdr@waseel.com** | 9200 120 99 | waseel.com/contact-us |
| Waseel care / regional sales | customercare@ · abbodmo@ (Jed) · salamahna@ (Kho) · motabberib@ (Riy) @waseel.com | WhatsApp 011 510 0517 | waseel.com/contact-us |
| Oracle KSA | contact@oracle.com (+ sales form/chat) | — | oracle.com/sa/corporate/contact |
| HL7 Saudi Arabia | **none public** — still "in establishment" (HL7 Confluence 2024); route via onboarding@chi.gov.sa | — | confluence.hl7.org ADDC |

> Copy-paste-ready outreach emails (EN + AR, per-recipient language recommendation): see `HUMAN_CONFIRMATION_NEEDED.md` → "✉️ Emails to send".

### 🆕 Third-pass verification completed after 6am reset (run 2 of 2026-07-02) — 14 claims formally verified
- **A1/A2 absence in CHI sources: now 3-0 VERIFIED** (open-data page, annual-reports index, 2023 report qualitative-only, complaints-stats news page).
- **🆕 CHI Annual Report 2024** (published 02/06/2025, 70 pp, **Arabic-only**) — downloaded + full-text-searched locally this session (normalized Arabic search): **zero occurrences of رفض/مرفوض**; KPIs = "% paid claims" (المطالبات المدفوعة), % Saudi-Billing-System claims, NPHIES alert counts. **2020 + 2023 + 2024 all read → all silent on denial rate/value.**
- **Al-Kahtani Nov 2025 paper (3-0):** BOTH the "20–25% SME-hospital rejection rate" AND the "SAR 3.5–4.5B annual loss" cite **only Glance Care (2022)** — no official source. Paper also projects KSA healthcare market → SAR 141B by 2030 (same vendor cite).
- **Denominator (3-0):** CHI 2023 medicines SAR 6B = 16% of claims value → **total ≈ SAR 37.5B**; a ~3B denied value ⇒ **~8% of claims value** (sanity-scale only, still unsourced).
- **info@chi.gov.sa** printed on CHI 2023 report back cover (p.192) — 3-0.
- ⏳ **Still pending re-verify (session limit hit again, resets 11am Riyadh):** ~27 B-series votes (conformance-page silence, Academy gating, onboarding email provenance) + final synthesis. Claims all carry direct primary quotes; resume queued.

### ✅ Third-pass FINAL synthesis (run 3, completed 2026-07-02 ~11:30 Riyadh after limit reset) — workflow fully done
All 5 target claims formally synthesized, **high confidence, votes mostly 3-0 unanimous**:
- **A1 — no national denial rate exists in ANY accessible primary source** (6 independent sources checked incl. CHI TPA/claims-management-company regulation — also silent). ⚠️ New nuance: CHI 2023 carries a **"91.36% Paid claims" KPI** — a CHI *performance metric*, NOT a denial-rate complement; never derive "8.64% denied" from it.
- **A2 — vendor-only, final.** Al-Kahtani (2025) cites CHI + Insurance Authority elsewhere for other stats yet cites **only Glance Care 2022** for the 3.5–4.5B figure — vendor provenance is deliberate-looking, not accidental. SAR 37.5B denominator arithmetic verified (6B/0.16); "value of claims" undefined (submitted vs paid) → the ~8% ratio is indicative only.
- **B1 — PKI issuance NOT in any freely accessible source** (conformance page: 0 hits for PKI/certificat*/X.509/TLS/mTLS across 164KB HTML, grep-verified twice; Academy public pages mention only training-completion certificates).
- **B2 — gated, not public.** The **System Vendors Onboarding Course is a 39-lesson mandatory program**; "Registering in nphies Platform" (course 6) is the **mandatory registration course** with **13 attachment PDFs incl. "nphies Registration Guide V1.3 - English" + "nphies Readiness & Activation Guide V1.2 - English"** — verified live; downloads unlock after **free Academy registration** (anonymous sees titles only). ⚠️ 2 refuter votes correctly flagged: conformance-page silence alone doesn't *prove* B2 is unpublished — the synthesis verdict rests on the Academy gating, which held 3-0.
- **Waseel-scope — no official document answers it** (conformance page grep: 0 hits for waseel/clearinghouse/intermediar*). Still a Waseel + NPHIES call question.
- **Contacts (synthesis-graded):** `info@chi.gov.sa` (multiple primary CHI sources, high) · `onboarding@chi.gov.sa` + 920033808 (official Academy Contact-Us page + FAQ, medium-high — one refuter found it ALSO on academy.nphies.sa/page/6 اتصل-بنا) · Waseel/Oracle emails verified separately in-session from their own contact pages (see roster above).
**Run stats:** 3 runs × 99 agents, ~4.3M subagent tokens total, ~880 tool calls. Runs 1–2 died on session limits mid-verify; run 3 resumed from journal cache (search/fetch/extract replayed free) and completed everything.
