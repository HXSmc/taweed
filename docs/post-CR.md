# Post-CR Action List
### What the Commercial Registration actually unlocks — and what still doesn't

> Companion to `HUMAN_CONFIRMATION_NEEDED.md` (the live source of truth this list is built
> from — every item below cites the section it comes from; re-read that doc if a citation's
> full context is needed, this file doesn't re-derive the research). Written 2026-07-21, the
> day the CR number landed.
> Status key: 🔴 do this now — the CR was the only thing stopping it · 🟡 now possible but
> sequence matters (do a prerequisite first) · 🟢 still blocked, and NOT by the CR — don't
> mistake "I have a CR now" for "this is unblocked."
> Priority tag meanings match `HUMAN_CONFIRMATION_NEEDED.md`'s own legend (🔴 blocks a real
> decision · 🟡 important before scaling · 🟢 cleanup / nice-to-have) — kept alongside the
> unlock-status tags above since they answer different questions (what changed vs. how
> important it is).

---

## The one thing to internalize before working this list

**The CR removes exactly one blocker: "no legal entity exists."** It does NOT remove:
- The need for **KSA privacy counsel sign-off** before any real PHI flows (`C1`, `G5`) — a CR
  gives you an entity to sign a DPA with, it doesn't write the DPA or clear PDPL.
- The need for **NPHIES's own vendor certification** (`B1`/`B2`) — the CR unblocks *enrolling*
  in it, not completing it; that's still a real process with real steps ahead.
- Any of the **counsel-gated compliance items** (`G12`-`G14`, the CST question in `G4`) — these
  need a lawyer's answer, not a CR number.

Concretely: **do not ingest a real clinic's `ClaimResponse` data yet** (`G5` still applies —
entity existing is necessary but not sufficient; counsel sign-off per `C1` is the other half).
The CR is the bottleneck that was blocking everything *else* from starting — it was never the
last blocker on its own.

---

## A. 🔴 Do this now — the CR was the only thing stopping it

### A1. ~~Reply to NPHIES onboarding with the CR number~~ ✅ DONE — sent 2026-07-21
**Unlocks:** `B1` (PKI issuance), `B2` (sandbox/conformance), `G9` (vendor liability/agreements)
- Replied in-thread to `onboarding@chi.gov.sa` (CC `support@nphies.sa`) with: CR/National
  Number `7054836007` (**Taweed Establishment**, released 21/07/2026, Active), confirmation
  that the company is Saudi-based with all founders Saudi nationals but no physical office yet,
  and confirmed FHIR/NPHIES-IG awareness. Re-asked the original PKI/sandbox/conformance questions
  that never got answered.
- **🔴 Answered 2026-07-22 06:54 — a physical KSA office IS required.** NPHIES's reply: *"يشترط
  وجود مقر رئيسي للشركة في المملكة العربية السعودية، مع توفر سجل تجاري ساري المفعول"* ("a main
  headquarters for the company in the Kingdom of Saudi Arabia is required, along with a valid
  commercial registration"). This is a **new real requirement, not previously confirmed** — the
  CR alone isn't sufficient for vendor certification; a registered physical address is also
  needed. **Human decision needed:** whether to lease a physical office/registered address now
  (cost + timeline), or explore whether a virtual office / registered-agent address satisfies
  "مقر رئيسي" (NPHIES's reply doesn't specify — worth a direct follow-up question before assuming
  either way).
  - The reply did **not** answer any of the original PKI/sandbox/conformance/clearinghouse
    questions — those remain open. It just pointed back to the same `onboarding@chi.gov.sa` /
    `19977` contact already being used, so a further email to the same address risks the same
    circular non-answer pattern seen already (see the boilerplate-close cycle in `A2` below) —
    worth trying the call center (19977) directly instead next time, per this doc's own note.
  - **2026-07-22 11:22:** founder forwarded this exact reply to an external contact
    (`Abdullahalsaadoun7@gmail.com`) — no note attached, so likely someone being looped in to help
    resolve the office-requirement decision above (e.g. office space, or a registered-agent
    option). No action needed from this log; just recording that the human decision above may
    already be in motion outside this doc.

### A2. Self-enroll in NPHIES Academy — 🔴 BLOCKED on a platform bug, not us
**Unlocks:** the self-serve half of `B1`/`B2`
- Founder's own login attempt confirmed the Academy itself demands a CR number (not just the
  vendor-certification submission) — see `HUMAN_CONFIRMATION_NEEDED.md` §B intro box,
  2026-07-19. That's gone now.
- Enroll in both courses immediately: **"System Vendors Onboarding Course"** (course 11,
  v-academy.nphies.sa) and **"Registering in nphies Platform"** (course 6, academy.nphies.sa —
  unlocks the *"nphies Registration Guide V1.3"* and *"nphies Readiness & Activation Guide
  V1.2"* PDFs on completion). This likely answers most of B1/B2 directly, faster than waiting
  on A1's email reply.
- **2026-07-21: registration confirmed broken.** `v-academy.nphies.sa/register/complete`
  rejects our valid, Active CR (7054836007) with `"CR number الرجاء التأكد من"` — reproduced
  twice via chrome-devtools MCP, identical error both times, ruling out a one-off glitch.
  Network inspection shows the POST field is literally named `mediator_code`, not `cr_number` —
  may expect a different code than the plain MoC CR number, or the registry hasn't propagated
  yet (CR was issued the day before). Emailed `support@nphies.sa` (cc `onboarding@chi.gov.sa`)
  same day describing the exact error, CR number, name, phone.
- **2026-07-21, later:** `support@nphies.sa` replied with a boilerplate ticket-close (no actual
  fix/explanation) — replied in-thread pushing back, asking them not to close before answering.
  Then got a **phone callback**: ticket was looped to `onboarding@chi.gov.sa` since they own the
  Academy site — real answer expected tomorrow (2026-07-22).
- **2026-07-22 ~12:04 Riyadh: 3rd identical failure, registry-lag theory now disproven.** Scheduled
  retry ran (>24h after CR issuance) — same exact response, byte-for-byte:
  `{"status":false,"msg":"CR number الرجاء التأكد من "}`. Checked the `support@nphies.sa` thread
  first — still no real explanation, just the same boilerplate close. This rules out "the
  registry just hadn't synced yet" as the cause; it's either the `mediator_code` field expecting
  something other than the plain MoC CR number, or a genuine unfixed platform bug.
  **Do not retry again unattended.** Genuinely stuck pending an actual answer from
  `onboarding@chi.gov.sa` (they were the ones who confirmed the physical-office requirement on
  this same thread family — worth asking them directly about `mediator_code` too, since
  `support@nphies.sa` has produced nothing but auto-closes across 3 attempts now) or a follow-up
  call to 19977/920033808.

### A3. ~~Register as a taxpayer (ZATCA)~~ ✅ DONE — 2026-07-22
**Unlocks:** nothing blocked on it, but it's a real clock now running
- `G6`: general taxpayer registration (Zakat, since Saudi-owned) is required **at CR issuance,
  regardless of revenue, within ~60 days.** Done, clock satisfied.
- VAT/e-invoicing registration isn't due yet (only kicks in above SAR 375,000 annual taxable
  supplies, roughly the 3rd-5th paying client per `G6`'s modeling) — taxpayer registration is
  separate from VAT; put VAT on the radar for later, no action needed now.

### A4. Open a business bank account
**Unlocks:** invoicing, any future vendor contract requiring a company bank account (Oracle/AWS
credit disbursement, clinic invoicing once revenue starts)
- Not explicitly researched in `HUMAN_CONFIRMATION_NEEDED.md` (standard post-CR housekeeping,
  not a compliance gap) — but flagging since several downstream items (ZATCA registration,
  eventual clinic invoicing, AWS/Oracle billing) assume one exists.

---

## B. 🟡 Now possible, but sequence matters

### B1. ~~Schedule the counsel meeting~~ 🟡 IN PROGRESS — contacting via WhatsApp, 2026-07-22
**Actions:** `C1`, `G8`, `G12`, `G13`, `G14`, the CST question in `G4`
- The counsel engagement (`Email 6` / Section `J`'s meeting checklist) was always "referral or
  scoping meeting beats cold email" — see `HUMAN_CONFIRMATION_NEEDED.md`'s in-person notes. A
  real entity existing makes this conversation concrete rather than hypothetical (a lawyer can
  now actually draft a DPA *for* something, not in the abstract). **This is the single highest-
  leverage next step after A1/A2** — everything in section C below stays blocked until this
  happens.
- **Status: actively engaged, not yet a scheduled meeting.** Real KSA privacy counsel contact
  confirmed over WhatsApp (a WhatsApp MCP connector is now set up in this environment, added
  2026-07-22 — this thread is now checked hourly, see the loop note below). Full history so far
  (chat started 2026-07-21 17:19):
  - Counsel asked which parts of the project are on track vs. need adjusting, and specifically
    flagged **part #2 — the difficulty of getting approval for using US-hosted AI** — as the hard
    one.
  - After the CR landed, counsel asked for a voice-note walkthrough of the project (something in
    a sent file wasn't clear). Founder sent 4 voice notes explaining it.
  - **One was transcribed** (Whisper, run locally — the WhatsApp MCP's `download_media` tool has
    a caching bug that returned byte-identical audio for all 4 distinct message IDs, so only one
    of the 4 notes' actual content was recoverable, not all four). It covers: (1) the need for a
    data-processing agreement over the data flow feeding the product, and (2) the exact same open
    question already tracked as `C1`/`BLK-AI-1` here — using Anthropic (US-hosted) and whether
    that's hard to clear, versus the in-Kingdom self-hosted fallback in
    `docs/05_open_source_switching.md`.
  - Founder has since sent counsel the SDAIA-guideline-type document and the NPHIES ToU PDF (both
    sourced from `docs/counsel-docs/official-sources/`).
  - Update this section again once an actual meeting gets booked — being responsive over chat
    isn't the same as having a scoping call scheduled.
- **Autonomous hourly loop (started 2026-07-22):** Gmail and this WhatsApp thread are checked
  every hour; on a genuinely new counsel message, a next-step (requested document, or an
  Arabic-drafted reply) is prepared and logged in `docs/counsel-whatsapp-log.md` for review —
  nothing is sent to counsel autonomously, founder has final say on every reply.
- Bring `docs/counsel-docs/` (the full pack — DPA/SCC/risk-assessment/breach-runbook drafts +
  `official-sources/`) **and** `docs/counsel-scoping-checklist.pdf` (or the Arabic version) —
  both already built, self-contained, ready to hand over. Don't reconstruct either by hand.
- **Do not wait for a referral to materialize before doing A1-A4** — those don't need counsel,
  this does. Run them in parallel.

### B2. Submit B1/B2's actual PKI + conformance application
**Depends on:** A2 (Academy enrollment) completing first — the guides gate the actual steps
- Once the Academy courses are done and A1's reply lands, the real PKI certificate request and
  sandbox/conformance test registration become the next concrete NPHIES-side action. Don't
  start this before A1/A2 — you'd be guessing at a process the Academy materials will just
  hand you directly.

### B3. Revisit the AWS Activate Credits application with the real CR
**Depends on:** A1-A4 not required for this one, but worth doing once a company bank account
exists (B3 may ask for company banking details)
- The AWS Startups Founders-tier application (in progress per the AWS thread in this session)
  didn't have a real CR number when started. If the application form has a company-registration
  field, go back and fill it in now — a real CR number is a stronger credit-eligibility signal
  than "pre-registration."

---

## C. 🟢 Still blocked — and NOT by the CR (don't let the CR high make you skip these)

These all need **counsel's actual answer**, not just an entity to exist. Doing B1 (schedule the
meeting) is the only way any of these move. **Starting drafts for every row below now exist in
`docs/counsel-docs/`** (built 2026-07-22) — they save counsel time but don't substitute for their
review; see that folder's README for what's still marked `[COUNSEL TO CONFIRM]` in each.

| Item | What's needed | Source | Draft |
|---|---|---|---|
| Real-PHI ingestion (the free-audit GTM's actual first move) | Counsel sign-off on data-flow + DPA, on top of the entity now existing | `G5`, `C1` | `counsel-docs/05-dpa-template.pdf` |
| SCC + SDAIA risk assessment for the Anthropic transfer | Counsel drafts the SCC form + runs the `dgp.sdaia.gov.sa` risk-assessment tool | `G12` | `counsel-docs/01-scc-controller-to-processor.pdf`, `02-sdaia-risk-assessment.pdf` |
| Breach-notification runbook (72h SDAIA requirement) | Counsel helps draft it — no runbook exists yet | `G13` | `counsel-docs/03-breach-notification-runbook.pdf` |
| Controller-vs-processor determination | Counsel's actual determination, not our assumption | `G14` | `counsel-docs/04-controller-processor-determination.pdf` — **resolve this one first**, the others depend on it |
| NPHIES ToU business-risk read (indemnity, suspend-without-notice, confidentiality-disclaimer scope) | Counsel's read, specifically the two flagged sub-questions in `G8` | `G8` | `counsel-docs/06-nphies-tou-business-risk.pdf` |
| CST Cloud Computing Regulatory Framework applicability | Counsel's answer — genuinely ambiguous from CST's own public pages | `G4`, `Section J` item 6 | `counsel-docs/07-cst-cloud-computing-applicability.pdf` |
| Signing any NPHIES vendor agreement (if one exists beyond the portal ToU) | Real content is Academy-gated; `G9`'s questions are folded into `Email 2` (see A1) — but actually *signing* anything still wants a counsel read first | `G9` | `counsel-docs/08-nphies-vendor-agreement.pdf` |

---

## D. Standing follow-ups — unaffected by the CR either way

These were already in motion before the CR landed and don't change because of it. Listed here
only so this doc is a genuinely complete "what's outstanding" snapshot — full detail lives in
`HUMAN_CONFIRMATION_NEEDED.md`, not repeated here.

- **CHI DMO (Email 1)** — sent, auto-acknowledged, no data yet. Follow up by phone (19977) if
  quiet past ~1-2 weeks from 2026-07-20.
- **Oracle (Email 4)** — sent 2026-07-19, no reply yet.
- **CNTXT (Email 9)** — sent 2026-07-19, no reply yet.
- **Ecaresoft (Email 11)** — sent, no reply yet.
- **HealthOrbit** — replied; a response draft answering their 3 discovery questions is sitting
  in Gmail, ready to review and send.
- **AWS** — Startups signup confirmed (portal + $200k credit *offer*); Sales Support form
  submitted, no reply; the actual Activate Credits application itself not yet submitted (see B3
  above once a CR number can go on it).
- **Target-list tail (E1)** — a handful of clinics still need a direct call for branch-count/
  insured-mix (the ones web research couldn't resolve); drop duplicate row #5.
- **`docs/05_open_source_switching.md`** — its own §0 still gates on Oracle/AWS GPU replies
  (separate from the CR) — unaffected by this list; check that file directly before executing
  anything from it.

---

## E. Docs this unlock should also update (cross-reference hygiene)

The CR landing makes a few status lines elsewhere in the repo stale. Worth a quick pass:
- `HUMAN_CONFIRMATION_NEEDED.md` §G4's "engage a standard CR formation agent" line, §I row 9,
  and §I's "Status check" bottom line all say CR formation "not yet started" — update once
  this list's A-items are underway.
- `05_open_source_switching.md`'s PROMPT 0 checklist and `BLK-OSS-DATA`'s status both ask "has
  the CR been formed" — flip to done, but note `BLK-OSS-DATA` still also needs the DPA (Section
  C above), so it doesn't fully clear just from this.
