# Counsel Review Pack

Everything in this folder is a **starting draft**, assembled from the non-legal research already
done in `HUMAN_CONFIRMATION_NEEDED.md` (sections C1, G8, G9, G11-G14). None of it is a finished
legal document — each file has `[COUNSEL TO CONFIRM]` / `[COUNSEL TO DRAFT]` markers wherever a
real lawyer's judgment, not research, is what's actually missing. The point is to save counsel
time (reviewing/correcting a structured draft is faster than starting from a blank page), not to
skip hiring one.

**Do not use anything here in production, sign anything based on it, or treat a gap as filled
just because a file exists.** Every item is still 🔒 gated in `docs/post-CR.md` §C until counsel
actually signs off.

## Contents

| File | Covers | Source |
|---|---|---|
| `01-scc-controller-to-processor.md` | Draft Saudi SCC (Controller-to-Processor form) for the Anthropic cross-border transfer | C1, G11 |
| `02-sdaia-risk-assessment.md` | Draft SDAIA cross-border risk assessment (Feb 2025 guideline) for the Anthropic transfer | G12 |
| `03-breach-notification-runbook.md` | Draft 72-hour breach detection/notification runbook | G13 |
| `04-controller-processor-determination.md` | Memo laying out the facts for counsel's controller-vs-processor call | G14 |
| `05-dpa-template.md` | Draft Data Processing Agreement (Taweed ↔ clinic) | C1, G14 |
| `06-nphies-tou-business-risk.md` | Condensed risk summary of NPHIES's binding portal Terms & Conditions | G8 |
| `07-cst-cloud-computing-applicability.md` | The open CST Cloud Computing Regulatory Framework question | G4 |
| `08-nphies-vendor-agreement.md` | What's known/unknown about a separate NPHIES vendor agreement | G9 |

## Also bring to the meeting

- `docs/counsel-scoping-checklist.pdf` / `-ar.pdf` — the standalone scoping checklist already
  built for the first counsel meeting (`docs/post-CR.md` §B1). That's the agenda; this folder is
  the supporting material once the engagement actually starts drafting.

## Why these determinations matter to each other

Several files depend on the same unresolved question (`04`) — Taweed's role (controller vs.
processor) for the clinic-data relationship. `01`, `02`, and `05` all have a `[COUNSEL TO
CONFIRM]` marker tied to whatever `04` resolves to. Don't fill those in independently; resolve
`04` first, then the rest follow from it.
