# Research Findings — 2026-07-01
### Deep-research pass on `HUMAN_CONFIRMATION_NEEDED.md` (103 agents, 20 sources, 68 claims, 25 adversarially verified)

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
