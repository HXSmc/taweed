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
- **2026-07-23, founder-directed retry with a real technical lead — still fails, lead disproven.**
  Inspected the actual POST payload via chrome-devtools network panel: the form silently submits
  a `national_id` field that has **no visible input control anywhere on the page** — it exists in
  the DOM (`type="number"`, hidden) but nothing lets a user fill it, so it's always sent empty.
  Looked like a strong candidate for the real bug. **Tested by injecting the founder's actual
  national ID into that field via the browser console and resubmitting — 4th attempt, byte-for-
  byte identical failure**, `{"status":false,"msg":"CR number الرجاء التأكد من "}`, national_id
  correctly present in the request this time. **This disproves the hidden-national_id theory** —
  the rejection is happening entirely server-side against `mediator_code` itself, unrelated to
  any client-side field we can influence. Confirms this is NPHIES's own platform bug, not
  something fixable from our end. The `mediator_code` field name itself is the strongest lead
  left unexplored — worth asking `onboarding@chi.gov.sa` directly whether this endpoint expects
  an actual NPHIES-issued mediator/vendor code (obtained through some other registration step we
  haven't done yet) rather than the plain MoC CR number, since a *direct-integration* vendor like
  Taweed may not fit whatever "mediator" concept this field was built around. **Do not retry
  again** without a real answer from NPHIES on what `mediator_code` is actually supposed to
  contain — this is now the 4th confirmed identical failure, more attempts add no new signal.

### A3. ~~Register as a taxpayer (ZATCA)~~ ✅ DONE — 2026-07-22
**Unlocks:** nothing blocked on it, but it's a real clock now running
- `G6`: general taxpayer registration (Zakat, since Saudi-owned) is required **at CR issuance,
  regardless of revenue, within ~60 days.** Done, clock satisfied.
- VAT/e-invoicing registration isn't due yet (only kicks in above SAR 375,000 annual taxable
  supplies, roughly the 3rd-5th paying client per `G6`'s modeling) — taxpayer registration is
  separate from VAT; put VAT on the radar for later, no action needed now.

### A4. ~~Open a business bank account~~ ✅ DONE — 2026-07-23
**Unlocks:** invoicing, any future vendor contract requiring a company bank account (Oracle/AWS
credit disbursement, clinic invoicing once revenue starts)
- Company account open, IBAN + account number on file (Secrets vault, Taweed section — not
  reproduced here). Bank name not yet logged — add if it comes up.
- Clears the assumption several downstream items depend on: ZATCA registration, eventual clinic
  invoicing, AWS/Oracle billing.

### A5. File the SAIP trademark application for "Taweed"/"تعويض" — 🔴 time-sensitive, doesn't need counsel or the office decision first
**Unlocks:** protects the brand name before any competitor first-files it; independent of `B1`
(office/counsel) and `A2` (NPHIES) — can run in parallel, no blocker.
- From `HUMAN_CONFIRMATION_NEEDED.md` §N (`/research`, accuracy-audited 2026-07-22): Saudi Arabia
  is **first-to-file**, not first-to-use. The Ministry of Commerce trade-name reservation done
  during CR formation does **not** cover this — it's a separate registry that only blocks an
  identical company name, not a trademark filed by someone else in a different entity form.
- Government fee ~SAR 6,500 flat for one Nice class (confidence 4 — sourced from law-firm
  summaries, not a primary SAIP fee schedule; worth a direct SAIP portal check before paying).
  File under Class 42 (SaaS/software) at minimum; consider Class 9 (apps) and Class 44 (medical
  services) too given Taweed's healthtech positioning.
  Timeline: 3-5 months uncontested, 8-12 if opposed. Protection: 10 years, renewable (confirmed
  directly on saip.gov.sa).
- **Human decision needed:** file directly via SAIP's portal, or have counsel/an IP agent handle
  it — either way, don't let this sit behind the office-address or counsel-meeting decisions,
  since none of those block it.

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
- **Status (updated 2026-07-22 ~17:30): meeting is set to happen, remote-friendly, exact
  date/time still TBD.** Full history — see `docs/counsel-whatsapp-log.md` for the message-by-
  message log, this is the condensed version:
  - Counsel asked which parts of the project are on track vs. need adjusting, flagged **part #2 —
    US-hosted AI approval difficulty** — as the hard one (same open question as `C1`/`BLK-AI-1`).
  - Counsel independently raised the same two NPHIES ToU gaps `docs/counsel-docs/
    06-nphies-tou-business-risk.md` had already flagged: (1) who "the user" means in the
    liability-disclaimer clause (Taweed, the clinic, or the medical facility — NPHIES needs to
    answer this, not us), and (2) Taweed needs a **separate trademark-use agreement/MOU with
    NPHIES** before referencing their brand commercially.
  - Founder confirmed: a direct email to NPHIES asking exactly the "who is the user" question was
    **sent** (Gmail thread `19f8a0a0db892b7a`, 2026-07-22 13:56, to `onboarding@chi.gov.sa` cc
    `support@nphies.sa`) — logged as verified-sent, not just drafted.
  - Founder confirmed with counsel: the NPHIES trademark-use question will also be asked directly
    to NPHIES, reply to follow.
  - **Meeting confirmed as remote-friendly** — counsel offered virtual, founder accepted; a
    specific date/time (tomorrow vs. later) is still being nailed down. A partner ("خالد") joins
    remotely either way.
  - Founder sent counsel the Arabic SDAIA/SCC document (`scc-controller-to-processor-ar.pdf`) —
    resent once after the first copy reportedly didn't open (same filename, `SCC-عربي-تعويض.pdf`;
    not confirmed whether this was the pre-fix or post-fix version of the WhatsApp PDF-mimetype
    bug fixed earlier 2026-07-22 — worth a quick "did it open this time?" check with counsel).
  - **Home-address question — RESOLVED, answered by counsel on a call (not WhatsApp text):
    a home address CANNOT be used as the registered "مقر رئيسي."** This is exactly why the
    office-space research (§M / `[[office-space-dammam-khobar-dhahran-hq]]`) was commissioned —
    a real registered office is now a confirmed requirement, not a maybe. Move to picking one of
    §M's options (Sharik Hub recommended first) rather than treating this as still open.
  - Update this section again once an exact meeting date/time is locked in.
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
