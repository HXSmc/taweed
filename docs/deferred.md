# Deferred — `DEF-*` registry of deliberately-parked build decisions

> **What this file is:** the single place that tracks work we have **consciously chosen not to build
> yet** — optimizations and features whose absence is a *decision*, each with the rationale and the
> concrete condition that would flip it to "worth doing." This is distinct from:
>
> - **`docs/blocker.md`** (`BLK-*`) — *external/human* gates that prevent real-data operation. A
>   blocker is something we're waiting on someone else for; a deferral is something we've decided not
>   to spend our own effort on yet.
> - **`docs/review.md` §2.11** — known issues/risks *in code that already exists*.
> - **`TODO(ai-route)` / `TODO(deploy)` seams in source** — the mechanical swap points; this file
>   records the *decision* behind the ones that are a judgment call, not just the marker.
>
> Status key: 🅿️ parked (decided-not-now, revisit on trigger) · ▶️ promoted (moved into active work).
> Last updated **2026-07-16**.

---

## Status at a glance

| ID | What | Why parked | Trigger to revisit | Status |
|---|---|---|---|---|
| **DEF-1** | Text-layer-first extraction routing for born-digital EOB PDFs | Dollar savings negligible at pre-pilot volume; no compliance benefit as designed; not the highest-value next step | Sustained volume ≳10k EOBs/month **or** a deterministic (LLM-free) born-digital parse becomes possible | 🅿️ parked |

Related deferrals already tracked elsewhere (not duplicated here): adjustment/withholding **bucket
persistence** into `ClaimRow`/`DenialRow` (`apps/web/lib/eob-to-normalized.ts`, `TODO(ai-route)` — see
`review.md` §2.11/§2.14); **Presidio pseudonymization sidecar** (`04_agentic_retrofit_plan.md` §… —
free-text PHI, deferred by design); **AI-5 orchestration** (deferred on an in-Kingdom frontier
endpoint, `04_agentic_retrofit_plan.md` §6); real **XLSX parser** for ingest (`review.md` §2.10, a
documented later swap).

---

## DEF-1 — Text-layer-first extraction routing (born-digital EOB PDFs) 🅿️ parked

### The idea

Today AI-4 sends **every** EOB PDF to a vision model (Sonnet-first, Opus-escalation — see
`packages/ai/src/adapters/claude-vision-ocr.ts`). For **born-digital** PDFs (those with an embedded
text layer), we already have a free, deterministic text extractor —
`packages/ingest/src/pdf-text-layer.ts`'s `extractPdfTextLayer()` — but it's used only as a
*validation cross-check* (the `text-layer-match` signal in `eob-validators.ts`), never as a primary
extraction path.

The proposed optimization: for born-digital docs, try a **cheaper structuring pass** (Haiku 4.5 on the
extracted text, no image) first, gate it through the **existing** deterministic validator
(`eob-validators.ts`), and fall back to the full vision path only when the cheap pass fails to
cross-total. It drops cleanly into the existing `EobExtractionAdapter` seam
(`packages/ingest/src/eob-extraction-adapter.ts`) — no seam rewrite, and the validator is the safety
net for the text layer's known table-scramble weakness on RTL remittances.

### Why it was in the plan already — as a *verifier*, not an *extractor*

The text layer was **not** omitted from the AI-4 design; it was deliberately scoped to verification
(`plan 04` §9, `review.md` §2.9/§801). AI-4 exists *for the case the text layer can't handle* —
scanned/image Arabic remittances with no text layer at all (Tesseract-class OCR fails those, ~60%
worse CER; that's the capability hole AI-4 was built to fill). A text layer also yields *text*, not
*structure*, and on 2-D RTL tables that text can detach an amount from its claim line — which is
exactly why the plan trusts it only as a "does this value appear verbatim?" matcher. Using it as a
*primary extractor* is a cost/latency tuning of the existing pipeline, not a missing feature.

### The calculation (2026-07-16)

Pricing (per MTok, standard rates; Sonnet 5 has intro pricing through 2026-08-31):

| Model | Input | Output |
|---|---|---|
| Sonnet 5 (extraction default) | $3.00 | $15.00 |
| Opus 4.8 (escalation) | $5.00 | $25.00 |
| Haiku 4.5 (proposed text-structuring) | $1.00 | $5.00 |

Per-EOB estimate (1-page remittance: prompt + page image + text layer in, structured JSON out):
**~5,000 in / ~1,500 out**.

- **Current path** (Sonnet vision + ~15% Opus retry): **≈ $0.047 / document**.
- **Proposed path** for born-digital (Haiku text-structuring $0.0105 + ~20% vision fallback):
  **≈ $0.020 / document**. Scanned docs are unchanged at $0.047.
- **Savings ≈ $0.027 per born-digital document (~57% on that slice).**

Blended savings = `volume × born-digital-fraction × $0.027`. At 50% born-digital (~$0.0135/doc):

| Stage | Volume/mo | Annual savings | Payback vs ~$4k build (2–4 eng-days) |
|---|---|---|---|
| Pilot (2 clinics) | ~1,000 | ~$160 | ~25 years ❌ |
| Growth (20 clinics) | ~10,000 | ~$1,600 | ~2.5 years ⚠️ |
| Scale (100 clinics) | ~100,000 | ~$16,200 | ~3 months ✅ |

The project is **below the pilot row**: per `blocker.md`, there is no real partner data yet (BLK-1),
no real EOB volume, and the pipeline is synthetic-only until the compliance route clears. At today's
volume the absolute savings round to zero. The token/volume estimates are assumptions — but the
conclusion is robust to being off several-fold, because current real volume is ~0.

### The correction that removes the strategic case

Sending the extracted text to **Haiku is still an Anthropic API call carrying document content** —
same cross-border/PHI posture as the vision call. So this is a **cost + latency** optimization, **not**
a compliance one. The only variant that removes the LLM (and the cross-border transfer) is a
**deterministic** parse of the text layer — but that is payer-format-specific and blocked on **BLK-2**
(no real NPHIES/payer formats yet). So the one thing that would make this urgent for *this* project
does not materialize with the Haiku-structuring approach.

### Decision: parked

Fails on all three axes that matter here: **cost** (negligible pre-volume), **compliance** (no benefit
as designed), and **priority** (the real next step is *running* the `AI_EVALS_LIVE=1` scored pass —
`review.md` §1.11/§2.9 — and the BLK-AI-1/2 compliance work, not a micro-optimization).

### Triggers to revisit

Promote DEF-1 to active work when **any** of these becomes true:

1. Sustained volume **≳10k EOBs/month** (payback drops under ~3 years and keeps improving with scale).
2. A **deterministic** born-digital parse becomes possible (real payer formats land — BLK-2) — that
   version is a genuine **zero-cross-border** path and is worth building even at low volume.
3. Reviewer **latency** on born-digital docs becomes a UX complaint (Haiku-on-text is materially
   faster than Sonnet-vision) — a latency-driven, not cost-driven, reason to build it.

Whenever it's promoted, it's a drop-in behind `EobExtractionAdapter` — there is no cost to waiting.
