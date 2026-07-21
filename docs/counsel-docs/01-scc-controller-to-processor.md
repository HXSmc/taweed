# Draft — Saudi SCC (Controller-to-Processor Form) for the Anthropic Transfer

**Status:** skeleton only. Source: `HUMAN_CONFIRMATION_NEEDED.md` C1/G11 — no SDAIA adequacy list
exists, so every cross-border transfer of sensitive/health data needs an Appropriate Safeguard;
Saudi SCCs (Controller-to-Processor form) is the one that applies to a third-party vendor like
Anthropic (Binding Common Rules excludes third-party vendors).

**Role note:** this form is named "Controller-to-Processor," which per PDPL usually means the
Saudi party is the controller transferring to a foreign processor. Whether that Saudi party is
Taweed or the clinic depends on `04-controller-processor-determination.md` — **do not finalize
this document until that's resolved.**

## 1. Parties

- **Data exporter (Saudi party):** [COUNSEL TO CONFIRM — Taweed, or the clinic, per `04`]
- **Data importer (foreign party):** Anthropic PBC (or its relevant contracting entity for API
  customers — confirm the exact legal entity name from Anthropic's own commercial terms, not
  assumed).

## 2. Description of the transfer

- **Categories of data subjects:** patients whose insurance claims are processed through the
  clinic's NPHIES submissions.
- **Categories of personal data transferred:** whatever subset of a `ClaimResponse`/EOB payload is
  included in an AI-2 (appeal-drafting) or AI-4 (EOB-extraction) request — [COUNSEL/ENGINEERING TO
  JOINTLY CONFIRM exact field list actually sent, not assumed from the schema]. Likely includes
  claim identifiers, denial-reason codes, and monetary amounts; **should not include full patient
  demographic PHI beyond what's operationally necessary** — confirm this against the real request
  payloads before finalizing, this is a factual/engineering question as much as a legal one.
  Explicitly flagged as sensitive/health data under PDPL — no lighter derogation applies (G12).
- **Purpose of the transfer:** AI-assisted appeal-letter drafting and EOB document extraction, as
  a processing step within the service Taweed provides to the clinic; no onward use, no
  cross-client training, no resale.
- **Duration:** transient, per-request — no persistent storage of PHI at the data importer beyond
  Anthropic's own API data-retention policy [COUNSEL TO CONFIRM current retention terms directly
  from Anthropic's commercial/DPA documentation, not assumed to still match what's cited in
  `HUMAN_CONFIRMATION_NEEDED.md`, which may be stale by the time of signing].
- **Frequency:** per clinic transaction, ongoing for the life of the contract with each clinic.

## 3. Safeguards / security measures at the importer

[COUNSEL TO CONFIRM against Anthropic's actual DPA/security documentation — do not draft this
section from assumption]:
- Encryption in transit (TLS) and at rest.
- Access controls / least-privilege on API infrastructure.
- No training on API inputs by default (per Anthropic's standard API terms — verify current
  wording at signing time, this is exactly the kind of vendor-facing detail that changes).
- Confirm whether Anthropic will execute its own DPA/BAA-equivalent as the importer-side
  commitment referenced by this SCC.

## 4. Sub-processing

Confirm whether Anthropic itself uses any sub-processors (e.g., underlying cloud infrastructure)
that would make this a chain rather than a single hop — [COUNSEL TO CONFIRM current subprocessor
list from Anthropic's trust/security documentation].

## 5. Liability and indemnity

[COUNSEL TO DRAFT] — standard SCC liability allocation between exporter and importer; align with
whatever Anthropic's own commercial terms already state so this document doesn't create a
conflicting obligation.

## 6. Term and termination

Tied to the underlying commercial relationship with Anthropic. On termination: confirm Anthropic's
data-deletion commitment for any transiently retained data.

## 7. Governing law and dispute resolution

Saudi Arabia, per SDAIA's SCC framework requirements. [COUNSEL TO CONFIRM whether the official
SDAIA-published SCC template — if one has been formally released beyond the Feb 2025 guideline —
should be used verbatim instead of this custom draft; check `dgp.sdaia.gov.sa` for the current
official form before finalizing, since regulatory drafting authority is the safer default here
over Taweed's own or generic drafting.]

## Open items before this can be signed

1. Resolve `04-controller-processor-determination.md` — decides who signs as exporter.
2. Confirm whether SDAIA has published an official fillable SCC template (this should be checked
   fresh at drafting time — `dgp.sdaia.gov.sa`, since this area moves fast and a guideline from
   Feb 2025 may have been superseded by an actual form since).
3. Get the real field-level data inventory of what AI-2/AI-4 actually send to Anthropic, from
   engineering, before describing "categories of personal data" definitively.
4. Get Anthropic's current DPA/security/subprocessor documentation directly — do not rely on
   anything cited here as still-current by the time of signing.
