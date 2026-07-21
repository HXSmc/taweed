# NPHIES Portal Terms & Conditions — Business-Risk Summary for Counsel

**Status:** research complete (not a legal read yet). Source: `HUMAN_CONFIRMATION_NEEDED.md` G8 —
full text pulled directly from every accordion section of `nphies.sa/terms-and-conditions`
(Arabic, live page, 2026-07-19), not a summarized fetch. This is a **real, binding agreement**,
not boilerplate — access to the portal constitutes unconditional acceptance, effective from first
use, changeable anytime at NPHIES's sole discretion with no obligation to announce updates.

## The two clauses flagged specifically for counsel's read

**1. Confidentiality-disclaimer wording.** The ToU states that user communications sent through
the portal carry no ownership right or confidentiality guarantee on NPHIES's part. This *appears*
to be a generic disclaimer about portal-support channels (contact forms, chat) — not the FHIR
claims-transaction data itself, which would be governed by separate technical/security specs, not
this ToU page. **[COUNSEL TO CONFIRM]** the wording doesn't extend further than that in practice —
don't let engineering assume this based on the plain-language read above.

**2. IP clause's bearing on IG bundling.** All portal content (software and information) is
protected under Saudi copyright/trademark/IP law and owned by NPHIES — no sale, license, rent,
modification, copy, reproduction, redistribution, or derivative works for public/commercial
purposes without prior written NPHIES approval. This independently confirms the same restriction
already found in the NPHIES Implementation Guide's own copyright notice (`HUMAN_CONFIRMATION_NEEDED.md`
F3) — two independent sources now say the same thing. **What to do:** do not bundle/redistribute
the IG into the product or CI without written NPHIES approval — already actioned, just flagging
the ToU as a second, independent basis for the same conclusion.

## Other clauses on file (lower priority, still worth a lawyer's eyes once)

- **Jurisdiction:** exclusive submission to Saudi courts for all portal-use disputes.
- **Liability limitation:** portal explicitly framed as only "facilitating manual procedures," not
  a replacement for official channels; disclaims responsibility for connection/equipment/software
  failures or reliance on portal content.
- **Termination:** NPHIES may terminate/restrict/suspend access at its sole discretion, without
  notice, for any reason including a ToU violation — treat this as a live operational dependency,
  not just a legal formality (Email 2 to `onboarding@chi.gov.sa` separately asks whether there's a
  published basis for suspension).
- **Indemnity:** users waive compensation claims against NPHIES/its staff for anything arising from
  the user's own breach of the ToU or KSA regulations.
- **Usage restrictions:** standard acceptable-use terms (no malware, no unlawful content, no
  excessive load on infrastructure, KSA anti-cybercrime law compliance).

## What to do

Get this in front of counsel as part of the same engagement drafting the DPA/SCC (already folded
into the original Email 6 scope) — it's a business-risk document worth a lawyer's read, not
something engineering can resolve. No code change implied by this file.
