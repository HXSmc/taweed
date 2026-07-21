# CST Cloud Computing Regulatory Framework — Applicability Question for Counsel

**Status:** genuinely ambiguous from public sources alone. Source: `HUMAN_CONFIRMATION_NEEDED.md`
G4 — confirmed via direct fetch of `cst.gov.sa`'s own registration page, not recited from memory.

## The question

Does CST's Cloud Computing Regulatory Framework apply to Taweed — a SaaS product that **consumes**
cloud infrastructure (Oracle/AWS) rather than **provides** it?

## What's confirmed, and where the ambiguity is

- CST's own registration criteria state the framework applies to providers who "directly or
  effectively control the data center or critical infrastructure."
- CST's public pages separately state the framework was "expanded to expressly cover SaaS" —
  **without a clear carve-out** distinguishing a SaaS product built on someone else's
  infrastructure from a SaaS product that itself operates the underlying cloud/data center.
- Taweed does not control any data center or critical infrastructure — it rents compute from
  Oracle `me-riyadh-1` / AWS `me-central-2` like any other application.
- This does **not** block CR formation (already done) — the CR's ISIC economic activity code
  (`620111`, Application Development) was deliberately chosen to avoid the 631xxx "provide cloud
  computing services" category precisely to not trigger this ambiguity at the registration level
  (`HUMAN_CONFIRMATION_NEEDED.md` G4). But the CST filing question is separate from the ISIC code
  and remains genuinely open.

## [COUNSEL TO CONFIRM]

1. Does the "expanded to expressly cover SaaS" language actually pull in a SaaS company that has
   no data-center/infrastructure control, or is that expansion aimed at a different fact pattern
   (e.g. SaaS providers who also operate their own hosting)?
2. If ambiguous even to counsel, is there a formal CST inquiry/ruling-request channel worth using
   before GA, rather than guessing?
3. If the framework does apply: what's the actual registration/licensing burden, and does it
   change any part of the current architecture (which already runs entirely on rented Oracle/AWS
   infrastructure, no owned data center)?

## What to do

Fold into the same counsel engagement as the DPA/SCC work (already scoped as agenda item 6 in
`docs/counsel-scoping-checklist.pdf`) — needs a definitive answer before GA, not resolved by
research alone.
