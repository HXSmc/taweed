# 04 — Agentic-AI Retrofit Plan
### Selective LLM layer on the deterministic core ("AI phase" — post-EXECUTE)

> Companion to `02_product_build_plan.md` (build plan) and `docs/handoff.md` (current state).
> Written 2026-07-05 from a 3-agent codebase seam analysis + 4-lens adversarial web research
> (hosting/PDPL, vision-PDF, Arabic-LLM, integration/cost). Confidence tags **(H/M/L)**;
> **VERIFIED** = primary source, **REPORTED** = secondary. All research URLs inline.
>
> **Thesis: the deterministic core is the moat — the LLM layer bolts on at existing seams,
> additively, and never touches the money-number path.** Nothing in this plan rewrites a
> module. Every LLM surface stays decision-support + human-in-the-loop (SFDA carve-out, `02` §6).

---

## 1. Current standpoint (from `docs/handoff.md`, 2026-07-05)

> **Update 2026-07-08:** §9 PROMPT 3 (AI-4) is now also built and merged — see §6's phase table below for the current state of every row. This section's body text is left as the 2026-07-05 snapshot for history; `docs/handoff.md` is the live state doc.

- CREATE ✅ · IMPLEMENT ✅ · **EXECUTE buildable pass ✅ merged to `main`** (B5–B8, C swaps, A1/A4).
- **AI-0 + AI-1 ✅ merged to `main` (2026-07-05):** `@taweed/ai` foundation + the bilingual scrub-flag
  explainer — PHI-free, additive, fail-closed OFF by default. 266 unit + 6 integration green, coverage 92%,
  build green. Next in this plan = §9 PROMPT 2 (AI-3 + AI-2). `back-up` = pre-AI-phase `main` tip.
- Still pending from the old track: **A2 first-run corridor, A3 free-audit report** (UI tail, synthetic
  data) and the **real-data headline** (gated BLK-1 partner data / BLK-2 real codes / BLK-9 SME sign-off).
- **Zero AI dependencies in the lockfile today.** `packages/appeals` explicitly "NO LLM by design".
- This plan ADDS a phase; it does not replace the A2/A3 tail or the headline. Recommended order:
  A2/A3 can proceed in parallel or after AI-1 — they don't conflict (different files).

### Why the codebase is ready (seam analysis, verified against source)

| Seam | Location | Coupling |
|---|---|---|
| OCR/vision adapter (stub, throws until injected) | `packages/ingest/src/pdf-ocr.ts:15` (`OcrAdapter`), `xlsx.ts:12` | **CLEAN — purpose-built** |
| Appeal generation boundary | `packages/appeals/src/generate.ts:32` (`generateAppeal(ctx) → AppealDraft`); spare `clinicalNote?` input at `types.ts:18` | **CLEAN** (policy: additive, human-in-loop) |
| Scrub-flag post-processing | after `scrub()` `packages/rules-engine/src/scrub.ts:72-145`; flags carry `ruleId`/`field`/bilingual messages | **CLEAN — read-only downstream** |
| Rule authoring as data | `ScrubRule` conditions are pure JSON (`types.ts:47`); `selectRulesForClaim` scope+version (`select.ts:31`); regression gate `test/payer-golden.test.ts` | **CLEAN→MODERATE** |
| Tenant-safe DB access | single gate `withSession`/`withTenant` (`apps/web/lib/db.ts:47`, `packages/db/src/client.ts:22`, RLS) | **CLEAN** |
| Audit trail | `packages/audit` — append-only, PHI-leak guard | **reuse for LLM calls** |

Nothing rates HARD. The retrofit is **~4–8 weeks additive engineering**; the real cost is the
compliance envelope (§3).

---

## 2. Scope — where LLM goes, where it never goes

### In scope (this phase)
| # | Feature | Seam | Why it improves the design |
|---|---|---|---|
| **AI-1** | Bilingual plain-language scrub-flag explainer | post-`scrub()` | Clinical buyers read *why*; rules give trace, LLM gives prose. PHI-free by construction. |
| **AI-2** | EN/AR appeal-draft assist (additive suggestion; deterministic template stays; human reviews + submits) | behind `generateAppeal` | Arabic fluency is the documented gap (`02` §12.3 #2); templates are stiff. |
| **AI-3** | NL → JSON rule authoring (SME types English/Arabic → validated `ScrubRule`, golden-gated) | emits `ScrubRule`; `payer-golden.test.ts` gate | Rules-as-data already versioned/scoped (B7); LLM output executes deterministically. |
| **AI-4** | Vision-LLM EOB/PDF extraction | implements `OcrAdapter` | Tesseract-class OCR fails Arabic tables (~60% worse CER, KITAB-Bench). The genuine capability hole. |
| **AI-0** | `@taweed/ai` foundation package (provider swap, audit, pseudonymizer, kill switch, fixtures) | new package | Everything above routes through one audited gate. |

### Explicitly OUT of scope (do not build)
- **NL→SQL analytics agent** — highest injection+RLS risk, dashboards already work. Deferred indefinitely.
- **LLM anywhere in the money path** — money-at-risk / recovered-SAR stay 100% deterministic (`resolveRecovery`, analytics SQL). ROI provability is the sales motion.
- **Auto-submission of anything.** SFDA carve-out (`02` §6): decision-support only, human submits.
- **ML denial prediction** — still deferred per `02` §1 until labeled data accumulates from pilots.
- **Autonomous multi-step agent orchestration (AI-5)** — revisit after AI-1..4 land and an in-Kingdom
  frontier endpoint exists; the typed feature functions built here become its tool surface.

---

## 3. The compliance envelope (RESEARCH — the gating layer)

### 3.1 Hosting reality, July 2026: **there is no in-Kingdom frontier-LLM endpoint. Anywhere.**

| Option | Status | Verdict |
|---|---|---|
| Anthropic 1P `inference_geo` | **VERIFIED (H)**: only `"global"` and `"us"` (US = 1.1×, ZDR-eligible). No KSA/GCC/EU. KSA is on the supported-countries list (legal to buy). [docs](https://platform.claude.com/docs/en/manage-claude/data-residency) | Cross-border to US. Usable only on de-identified payloads. |
| Claude on Bedrock ME (Bahrain/UAE) | **VERIFIED (H)**: served ONLY via **global cross-region inference** — compute runs OUTSIDE the Middle East; only data-at-rest stays regional. [AWS blog](https://aws.amazon.com/blogs/machine-learning/introducing-amazon-bedrock-global-cross-region-inference-for-anthropics-claude-models-in-the-middle-east-regions/) | Does NOT avoid the transfer. Changes counterparty only. |
| AWS KSA `me-central-2` | REPORTED (M): GA ~Jan 2026. **VERIFIED (H): no Claude there** (absent from Bedrock region table). Bedrock promised via AWS–HUMAIN AI Zone. | **The most plausible 12–18-mo end-state. Watch quarterly.** |
| Claude on Vertex / GCP Dammam | Vertex core live in Dammam (sovereign/CNTXT), **no Claude endpoint in ME** (M). | No. |
| Azure Saudi East | **VERIFIED (H)**: customer workloads **Q4 2026**; Foundry Claude is US-pinned residency. | Watch item, not a path now. |
| Oracle Riyadh (current host) | **VERIFIED (H)**: OCI GenAI live in Riyadh since Aug 2025 — catalog is Cohere/Llama/Grok, **no Claude**. GPU shapes exist (quota unverified, ~3–4× US pricing, M). | **Self-host open-weight VLM here = only zero-cross-border option today.** |
| Saudi sovereign (ALLaM/HUMAIN) | ALLaM 34B serves HUMAIN Chat in-Kingdom (M); mid-tier Arabic specialist, not frontier. **No Anthropic–KSA hosting exists or is announced** (M). | PDPL-clean fallback for Arabic prose only; A/B before trusting. |

### 3.2 Legal routes under PDPL (REPORTED H, consistent across firms — counsel must confirm)

- **No SDAIA adequacy list published** → every cross-border transfer needs a safeguard: Saudi-form
  SCCs + **mandatory pre-transfer risk assessment** + minimization. Some exemption routes are
  **expressly unavailable for sensitive (health) data**. [K&S](https://www.kslaw.com/news-and-insights/international-personal-data-transfers-under-saudi-arabias-data-protection-law) · [Dentons](https://www.dentons.com/en/insights/alerts/2025/may/15/saudi-arabias-framework-for-cross-border-data-transfers)
- **Anonymization** (direct AND indirect identifiers removed, re-identification "permanently
  impossible") takes data **out of PDPL entirely**. **Pseudonymized data remains personal data.**
  [securiti](https://securiti.ai/saudi-arabia-personal-data-protection-law/) · [SDAIA guide](https://dgp.sdaia.gov.sa/wps/wcm/connect/f579bc32-fda8-47bd-bc6f-66b8cb77985c/ENG-Guide+to+the+saudi+PDP+law+for+controllersprocessors.pdf?MOD=AJPERES)

### 3.3 The routing decision (per feature)

| Feature | Payload | Route NOW | Rationale |
|---|---|---|---|
| AI-1 explainer | rule id + code + field + generic message — **PHI-free by construction** | Claude 1P (ZDR + `inference_geo:"us"`) | No personal data in prompt at all. |
| AI-3 rule authoring | SME's English/Arabic sentence + schema — **PHI-free** | Claude 1P (same) | Same. |
| AI-2 appeal assist | claim-shape data (codes, amounts, denial reasons) with **deterministic field-level pseudonymization** — direct identifiers replaced by opaque tokens from structured DB columns pre-call, re-substituted post-call; **free-text columns excluded by default**; DOB → age band | Claude 1P (ZDR + US) after **counsel sign-off (BLK-AI-1)** | Pseudonymized ≠ exempt, but "no direct identifiers to the model" + ZDR + SCC-fallback posture is the defensible stricter path (M — legal call). |
| AI-4 PDF extraction | the document IS identifiers — cannot pseudonymize pre-call | **Dual-gated**: build adapter + eval on synthetic docs now; production = (a) self-hosted VLM (Qwen2.5-VL-class via vLLM) on OCI Riyadh GPUs, or (b) Claude+ZDR under SCC route with counsel, or (c) wait for in-Kingdom Claude on `me-central-2` | The one feature that genuinely forces the sovereignty decision. Don't let it block AI-0..3. |

**Hard rules encoded in `@taweed/ai`:** ZDR org config; **no Batches API on any PHI-adjacent call**
(Batches is explicitly NOT ZDR-eligible — VERIFIED H); **never Fable-5-class models requiring 30-day
retention on PHI paths**; every call writes an audit row; kill switches per feature + per tenant;
no PHI in the audit table (hashes only).

### 3.4 SFDA guardrail (unchanged from `02` §6)
All four features: decision-support, human-in-the-loop, never auto-interpret clinical data toward
diagnosis, never auto-submit. Explainer prose explains *billing rules*, not clinical judgment.

---

## 4. Research digests (what the implementation must encode)

### 4.1 Vision-PDF extraction (AI-4)
- Claude PDF: 32MB/request, 600pp (100pp on Haiku), page = image + text layer, no PDF surcharge,
  ~1.5–3K tok/page + image tokens (VERIFIED H, [pdf-support](https://platform.claude.com/docs/en/build-with-claude/pdf-support.md)).
  Structured outputs GA — `json_schema` guarantees shape, **not truth**; no recursive schemas, no
  numeric constraints; **citations incompatible with structured outputs** (H).
- Arabic: frontier VLMs beat Tesseract/Surya by **~60% avg CER** on Arabic; Tesseract fails tables;
  best model on Arabic PDF→Markdown only ~65% (KITAB-Bench, VERIFIED H, [arXiv 2502.14949](https://arxiv.org/abs/2502.14949)).
  **No public Claude-Arabic-OCR benchmark exists** → own 30–50-doc ground-truth eval is the gate.
- Confidence routing: logprobs weak (0.705 ROC AUC on DocILE); use multi-signal — model per-field
  self-confidence + deterministic validators. Deterministic validators (do ALL): cross-total checks
  (Σ lines = totals), verbatim text-layer match after digit normalization ٠-٩→0-9 + RTL-mark strip,
  code enums in schema, any failure ⇒ human review.
- Cost at pilot: even all-Opus 2,000 docs < $400; Sonnet-first + Opus-escalation is the sweet spot.
  **Batches −50% conflicts with ZDR — pay sync price on real docs.**
- Non-LLM alternates: AWS Textract has **no Arabic** (disqualified, H); Azure Doc Intelligence has
  Arabic + Qatar/UAE regions (still cross-border); fully in-Kingdom floor = self-hosted OSS OCR
  (much worse on tables).

### 4.2 Arabic appeal drafting (AI-2)
- **Frontier models are good enough for SME-reviewed MSA drafts** (H for fluency/register, M for
  terminology): they top AraGen/BALSAM/AR-IFEval; EN appeal-letter studies show GPT-4-class drafts
  "closer to ready for submission" under clinician review ([medRxiv](https://www.medrxiv.org/content/10.1101/2024.04.30.24306634.full.pdf)).
- Measured risks: Arabic hallucination ~10% relative worse than English, concentrated in **factual/
  value/named-entity errors — exactly claim numbers, dates, codes** (AraHalluEval, VERIFIED H,
  [arXiv 2509.04656](https://arxiv.org/html/2509.04656v1)); terminology inconsistency; digit-set/bidi defects.
- Evidence-backed guardrails (encode all): **direct MSA generation** (translation pipelines lag +
  drift, H); **slot-filling** — facts injected as immutable tokens, LLM writes only argumentative
  prose, post-generation regex diff: every slot verbatim + **zero new digits/dates/codes invented**;
  **glossary injection** (soft prompt constraint + post-hoc term check — hard constrained decoding
  degrades Arabic fluency, H); **second-model verify pass** (3C3H-style rubric) before human sees
  draft; deterministic post-processor (normalize to Western digits per design-brief §4.3 digit law,
  strip stray tashkeel, RLM/LRM isolation around Latin codes); **SME edit tracking** as the ongoing
  eval metric. BLK-9 (SME sign-off) still gates anything reaching a clinic.
- ALLaM-34B (HUMAIN, in-Kingdom) = PDPL-clean fallback endpoint, unbenchmarked for formal
  correspondence — A/B via SME edit distance before trusting (M).

### 4.3 Rule authoring (AI-3)
- `client.messages.parse()` + `zodOutputFormat` (from `@anthropic-ai/sdk/helpers/zod`). Guard
  `parsed_output` null.
- Pitfalls (H, VERIFIED): **recursive schemas rejected** → bound `all`/`any` nesting to 2–3 explicit
  levels; **enum-constrain `operator` and `fact`** to registered names (else runtime engine throw);
  zod refinements for value types (SDK strips min/max from wire schema — client-side only).
- Gate chain (mandatory): LLM draft → zod parse → **engine dry-run** on fixture claim →
  **golden-corpus regression** (`payer-golden.test.ts` extended) → human approve in UI → persist
  with `authored_by:'llm'`, prompt hash, model, version. Never hot-load.

### 4.4 Integration + cost (AI-0)
- Provider abstraction is cheap: 1P/Bedrock/Vertex SDKs expose identical `messages.*` surface —
  thin factory (`LlmProvider`), mirrors the existing `OcrAdapter`/platform typed-swap pattern.
  Gate Batches/Files usage behind provider capability flags (Bedrock/Vertex lack both, H).
- Audit: no legal-grade TS library exists — own append-only `llm_calls` table (RLS, hashes not raw
  text) is the compliance record; self-hosted Langfuse (in-VPC, optional) is debug/eval infra only.
- PII redaction: **no Presidio equivalent in TS**; Arabic NER ~82–83% F1 — **statistical NER cannot
  be the load-bearing control**. Deterministic field-level pseudonymization from structured columns
  IS load-bearing; free text excluded by default; Presidio-sidecar deferred.
- Testing: two tiers — **CI = fixture replay, zero live calls** (a `FixtureProvider` implementing
  `LlmProvider` gives record/replay free); **scheduled live evals** via promptfoo or evalite
  (vitest-native) on golden corpora, weekly + on prompt/model change.
- **Cost envelope at pilot (1–3 clinics): ~$25–35/mo recommended mix; <$90/mo all-Opus worst case.
  Token spend is noise; compliance plumbing + evals are the real cost.** Mix: Sonnet 5 (extraction),
  Opus 4.8 (appeals/rules), Haiku 4.5 + dedupe-by-rule-version (explainers, → <$1/mo).

---

## 5. Architecture

```
packages/ai/                      # NEW — the only place that talks to an LLM
├── src/provider.ts               # LlmProvider iface + anthropic-1p.ts (now) / bedrock.ts vertex.ts selfhosted-vllm.ts (typed swaps)
├── src/client.ts                 # factory: kill-switch (env+feature+tenant) → provider → audited wrapper
├── src/audit.ts                  # writeLlmCall() → llm_calls table (append-only, RLS, hashes)
├── src/pseudonymize.ts           # field-level tokenize/detokenize; pure; 100% unit-testable
├── src/postprocess-ar.ts         # digit normalization, tashkeel strip, RLM/LRM isolation
├── src/schemas/                  # zod: FlagExplanation, AppealAssist, ScrubRuleDraft, EobExtraction
├── src/features/                 # explainFlag.ts, assistAppeal.ts, authorRule.ts, extractEob.ts
└── test/fixtures/                # recorded responses; FixtureProvider for CI

migration 0006: llm_calls(id, tenant_id, actor_id, purpose, model, provider, prompt_sha256,
                output_sha256, input_tokens, output_tokens, cache_read_tokens, request_id,
                latency_ms, flags_state, created_at)  -- RLS, append-only
```

Invariants: raw client never exported; every feature fn takes `{actor, purpose, tenantId}` so audit
is unskippable; `TAWEED_AI_ENABLED=false` (default) → typed `AiDisabledError` → callers fall back to
the deterministic path (which always exists); deterministic outputs (template body, scrub flags,
money numbers) are never replaced, only augmented.

---

## 6. Phased plan

| Phase | Builds | Gates | Est |
|---|---|---|---|
| **AI-0 Foundation ✅** | `@taweed/ai` package, `llm_calls` migration (0006), pseudonymizer, FixtureProvider, kill switches, eval scaffold — **DONE 2026-07-05** (merged to `main`; 266 unit + 6 integration green, coverage 92%) | none — PHI-free infra; Anthropic org w/ ZDR (BLK-AI-2) needed only for live calls | ~1 wk → done |
| **AI-1 Explainer ✅** | `explainFlag` (Haiku, dedupe by (tenant,rule,version)), UI popover on scrubber flags, both locales/themes — **DONE 2026-07-05** (multi-lens review + fixes: pool-exhaustion, NUL bytes, audit-on-failure, SFDA prompt hardening) | none — PHI-free | ~3–4 d → done |
| **AI-2 Appeal assist ✅** | `assistAppeal` (Opus): additive `suggestedParagraphs` on `AppealDraft` (template body untouched), digit-free slot-fill + no-invented-number gate + glossary + Sonnet verify pass + AR post-processor + detokenize-last, SME edit-distance metric (`appeal_suggestions`) — **DONE 2026-07-06** (unit+int green, multi-lens review) | **BLK-AI-1 counsel** + **BLK-AI-2 ZDR** gate live PHI calls (per-feature flag OFF until cleared); synthetic operation unrestricted; BLK-9 gates clinic shipping | ~1–1.5 wk → done |
| **AI-3 Rule authoring ✅** | `authorRule` (Opus) + bounded non-recursive schema + `validateAuthoredRule` gate (shape → engine dry-run → golden regression) + persist DISABLED + approval UI (rcm/owner/admin) + approved rules feed the live scrubber — **DONE 2026-07-06** (unit+int green) | none for build (PHI-free); golden corpus shared with the regression test | ~1–1.5 wk → done |
| **AI-4 PDF extraction ✅** | `ClaudeVisionOcrAdapter` (sonnet-first, opus escalation on validator failure OR a thrown call) behind the `EobExtractionAdapter` seam, `validateEobExtraction`/`validateEobExtractionArithmetic` (cross-totals, text-layer match, enum defense-in-depth), `eob_extractions` review-queue UI (re-validates on approve), eval harness scaffold — **DONE 2026-07-08** (unit 444/444 + integration 37/37 green, multi-lens review + fixes). **Two things NOT yet done, tracked as follow-ups, not blockers on this row:** the synthetic corpus has no HTML→PDF rasterizer yet, so the eval harness has never scored a real pass against the 98%/95% targets; and the extraction schema's 4-bucket money model (billed/paid/patient-share/rejected) has no adjustment/withholding case, so a real remittance with a contractual write-off won't cross-total (`docs/review.md` §2.11). | **Production route = decision gate** (§3.3), unchanged: counsel + hosting pick (BLK-AI-1/3/4); build and eval remain synthetic-only until it clears | ~1.5–2 wk build + eval — build done, eval-scoring not yet possible |
| **AI-5 Orchestration** | deferred — typed feature fns become the tool surface later | in-Kingdom frontier endpoint exists | — |

Order: AI-0 → AI-1 (proof, zero risk) → AI-3 and AI-2 in parallel → AI-4 last (dual-gated). **All of AI-0 through AI-4 are now built** (synthetic/PHI-free-by-policy); AI-5 remains deferred on an in-Kingdom endpoint.
A2/A3 UI tail (old NEXT_STEP) is independent — can interleave, and is now the nearest un-started unit since the AI phase itself is fully built.

## 7. Risks

| Risk | L | I | Mitigation |
|---|---|---|---|
| Counsel rejects pseudonymization posture for AI-2 | M | M | AI-2 ships on synthetic data regardless; fallback = in-Kingdom ALLaM A/B or defer to in-Kingdom Claude |
| Claude Arabic-table extraction underperforms on real remittances | M | M | Ground-truth eval gate BEFORE production; Azure-DI hybrid + self-host VLM fallback ladder |
| LLM-authored rule regresses payer behavior | M | H | golden-corpus gate blocks merge; `authored_by` metadata; human approval; versioned rollback |
| Digit/bidi defect ships in an AR letter | M | M | deterministic post-processor + digit-diff check + design-brief §4.3 law + SME review |
| Vendor/ToS drift (ZDR, retention, pricing) | L | M | provider typed-swap; quarterly Bedrock region-table check; kill switch |
| Scope creep into money path | L | H | §2 hard rule; review checklist item on every AI PR |

## 8. New blockers (append to `docs/blocker.md`)

| # | Blocker | Stops |
|---|---|---|
| BLK-AI-1 | KSA privacy counsel sign-off: pseudonymization posture (AI-2) + PDF route (AI-4) + SCC fallback | real-PHI LLM calls (not synthetic builds) |
| BLK-AI-2 | Anthropic org: commercial API from KSA, ZDR arrangement, DPA | any live LLM call |
| BLK-AI-3 | OCI Riyadh GPU quota + pricing (only if self-host VLM route chosen for AI-4) | AI-4 self-host route |
| BLK-AI-4 | Watch: Claude in-region on Bedrock `me-central-2` (quarterly check of the region table) | end-state migration |

---

## 9. Paste-ready prompts

> Style per `docs/NEXT_STEP_PROMPT.md`. Three prompts = three sessions, in order. Each assumes a
> fresh Claude Code session at the repo root `~/Desktop/web apps/taweed`, `main` checked out, and
> reads `docs/handoff.md` first.
>
> **Shared invariants baked into every prompt below (non-negotiable):**
> 1. **Build IN THIS DIRECTORY on an in-place branch** (`git checkout -b <branch>`), NOT a separate
>    worktree — local-only gitignored docs (`docs/NEXT_STEP_PROMPT.md`, `docs/blocker.md`,
>    `design/`, `ECC_GUIDE.md`) do not sync between worktrees (handoff §Git). The finished work
>    must end up merged into `main` in this directory on this device.
> 2. **Docs sync at the end of EVERY session (mandatory, before the final push):** update
>    `docs/handoff.md` (state + repo map), keep `docs/blocker.md` in sync (incl. BLK-AI-1..4),
>    rewrite `docs/NEXT_STEP_PROMPT.md` for the next step, update `docs/04_agentic_retrofit_plan.md`
>    phase table if scope shifted, and update the **Obsidian brain**
>    `~/Desktop/ObsidianVault/Projects/Taweed (NPHIES).md` → "Build progress" section.
> 3. **Git ritual — exact order, no exceptions:** commit on the feature branch → merge into `main`
>    in this dir → **BEFORE pushing the new main**: `git branch -f back-up <old-main-tip>` (the
>    commit main pointed at before your merge) `&& git push -f origin back-up` → then
>    `git push origin main`. `back-up` stays exactly one step behind `main` as the restore point
>    (restore: `git reset --hard back-up`).
> 4. **Toolchain quirks:** pnpm at `~/.local/bin/pnpm`; fish shell → `env VAR=val cmd`; RTK hook
>    compresses test/tsc stdout → write to a file and read it (`vitest run --reporter=json
>    --outputFile <path>`; `tsc ... 2><file>`); Node v20.2.0 (Next 15); integration tests run
>    single-fork and destructively migrate the shared Postgres (re-seed after);
>    `docker compose up -d` for local Postgres; `rm -rf apps/web/.next` if disk fills.
> 5. **Tooling roster — use them, don't wing it:** `superpowers:brainstorming` →
>    `superpowers:writing-plans` → `superpowers:test-driven-development` per feature;
>    `claude-api` skill BEFORE writing any Anthropic SDK call (exact model IDs / params);
>    `docs-lookup` (Context7 MCP) for @anthropic-ai/sdk, zod, json-rules-engine, evalite API
>    questions; ECC flow `/orch-add-feature` → `/react-test` → `/react-review`;
>    `typescript-reviewer` + `security-reviewer` + `healthcare-reviewer` agents on every diff
>    touching an LLM/PHI boundary; `/santa-loop` on any rules-engine or appeals change;
>    `/checkpoint` at each phase exit; **chrome-devtools MCP** for every UI surface (EN+AR RTL ×
>    light/dark, a11y, reduced-motion); `superpowers:verification-before-completion` before
>    declaring done. `rtk` proxies dev commands automatically (see quirks above).

### PROMPT 1 — AI-0 foundation + AI-1 explainer (start here; zero PHI, zero legal gates)

```
Read docs/handoff.md, then docs/04_agentic_retrofit_plan.md §3–§6 and §9 shared invariants.
Build phases AI-0 + AI-1 — the @taweed/ai foundation package and the bilingual scrub-flag
explainer — on an IN-PLACE branch in this directory: `git checkout -b ai-phase-0-1` (NO separate
worktree — gitignored local docs don't sync; the result must land in main in THIS dir).
Process per feature: superpowers:brainstorming → superpowers:writing-plans →
superpowers:test-driven-development (tests first; pseudonymizer and post-processors are pure
functions — 100% coverage there). Invoke the claude-api skill BEFORE writing any SDK call;
use docs-lookup (Context7) for @anthropic-ai/sdk + zod API questions.

AI-0 — packages/ai:
1. LlmProvider typed-swap interface (mirror packages/ingest/src/pdf-ocr.ts OcrAdapter pattern +
   packages/platform swaps): { client, mapModelId, capabilities: {batches, files} }. Implement
   anthropic-1p.ts with @anthropic-ai/sdk (models: claude-opus-4-8, claude-sonnet-5,
   claude-haiku-4-5 — exact IDs, no date suffixes) and fixture.ts (FixtureProvider: records/replays
   JSON fixtures; CI NEVER calls the live API — no ANTHROPIC_API_KEY in CI).
2. Kill switches: TAWEED_AI_ENABLED (default OFF, fails closed like the B5 data_origin gate),
   per-feature env flags, per-tenant DB flag. Off → typed AiDisabledError; every caller must
   handle it by falling back to the deterministic path.
3. Migration 0006 llm_calls (append-only, RLS, same pattern as audit): tenant_id, actor_id,
   purpose enum, model, provider, prompt_sha256, output_sha256, token counts from response.usage,
   request_id, latency_ms, flags_state, created_at. HASHES ONLY — never raw prompt/output, never
   PHI (extend the packages/audit PHI-leak guard). Feature fns take {actor, purpose, tenantId};
   raw client is not exported — audit is impossible to skip.
4. pseudonymize.ts: deterministic field-level tokenize/detokenize from STRUCTURED columns only
   ([PATIENT_1], [MEMBER_ID_1]; DOB → age band). Free-text columns are excluded by an explicit
   allowlist. Pure, exhaustively unit-tested incl. Arabic names round-trip.
5. postprocess-ar.ts: Arabic-Indic→Western digit normalization (design-brief §4.3 digit law),
   stray-tashkeel strip, RLM/LRM isolation around Latin codes/numbers. Table-driven tests.
6. Eval scaffold: evalite (vitest-native) wired as a separate vitest project that only runs with
   env AI_EVALS_LIVE=1 — never in CI.

AI-1 — explainFlag:
7. features/explainFlag.ts: input = ScrubFlag (ruleId, ruleName, field, severity, message_en/ar —
   PHI-FREE BY CONSTRUCTION, assert no claim/patient fields in the prompt type); output = zod
   FlagExplanation {explanation_en, explanation_ar, suggested_fix_en, suggested_fix_ar} via
   client.messages.parse() + zodOutputFormat. Model claude-haiku-4-5. Prompt-cache the system
   prompt. DEDUPE: cache by (ruleId, ruleVersion, locale) in a table — each rule explained once,
   not per claim. Wording constraint in the system prompt: explain BILLING rules, never suggest
   diagnoses or clinical judgment (SFDA carve-out, 02 §6).
8. UI: explanation popover/expandable on scrubber flag rows (apps/web scrubber surface), both
   locales, both themes, reduced-motion, WCAG AA, design-brief §13 anti-slop + §4.3 digit law.
   Graceful absence when AI disabled (deterministic messages still shown — additive only).
9. Verify with chrome-devtools MCP: EN+AR RTL, light/dark, a11y. Seeded local Postgres.

DoD: pnpm build green; unit+integration green (fixture provider only in CI); coverage 80%+;
llm_calls rows written on every call in dev; kill switch verified OFF-by-default; typescript-
reviewer + security-reviewer + healthcare-reviewer agents on the diff (LLM boundary = PHI
path); /santa-loop on any rules-engine-adjacent change; /checkpoint at phase exit;
superpowers:verification-before-completion before declaring done.

ON COMPLETION (mandatory, in this order — §9 invariants 2+3):
a. Docs sync: update docs/handoff.md (state + repo map: add packages/ai, migration 0006,
   AI-0/AI-1 status); sync docs/blocker.md (add BLK-AI-1..4 from plan §8); rewrite
   docs/NEXT_STEP_PROMPT.md to point at PROMPT 2 of docs/04_agentic_retrofit_plan.md §9;
   update the Obsidian brain ~/Desktop/ObsidianVault/Projects/Taweed (NPHIES).md
   "Build progress" section (AI-0+AI-1 shipped, findings, next step).
b. Commit all of it on ai-phase-0-1 (conventional commits), merge into main IN THIS DIR.
c. Push ritual: OLD=<main tip before your merge>; git branch -f back-up $OLD &&
   git push -f origin back-up; THEN git push origin main. Verify: back-up is exactly one
   step behind main.
Blockers: none for this prompt (PHI-free). BLK-AI-2 (Anthropic org+ZDR) needed only to flip
TAWEED_AI_ENABLED=true against the live API in dev — fixture path works without it.
```

### PROMPT 2 — AI-3 rule authoring + AI-2 appeal assist (PHI-free build; pseudonymized live use gated)

```
Read docs/handoff.md + docs/04_agentic_retrofit_plan.md §3–§6, §4.2–4.3, §9 shared invariants.
Prior session delivered @taweed/ai (AI-0) + explainer (AI-1) — do NOT rebuild; extend.
IN-PLACE branch in this directory: `git checkout -b ai-phase-2-3` (no worktree; result merges
to main in THIS dir). Process: brainstorming → writing-plans → TDD per feature; claude-api
skill before SDK code; docs-lookup (Context7) for json-rules-engine internals; ECC flow
/orch-add-feature → /react-test → /react-review on UI work.

AI-3 — authorRule (NL → ScrubRule):
1. schemas/scrubRuleDraft.ts: zod schema for a ScrubRule draft. NO RECURSION (structured outputs
   reject recursive schemas): explicit bounded all/any nesting, max 3 levels. operator = z.enum of
   json-rules-engine built-ins + our registered custom operators; fact = z.enum of registered
   ClaimFacts keys (import from @taweed/rules-engine types — single source of truth). Per-operator
   value-type refinements (SDK strips numeric constraints from the wire schema — zod refinements
   are the only enforcement; re-validate client-side always).
2. features/authorRule.ts (claude-opus-4-8, messages.parse, guard parsed_output null): SME text
   (EN or AR) + tenant/payer scope → ScrubRuleDraft. PHI-free (assert prompt type).
3. Gate chain, in code, mandatory: zod parse → engine dry-run (instantiate Engine, addRule, run
   fixture claims — catches runtime-only errors) → golden-corpus regression (extend
   packages/rules-engine/test/payer-golden.test.ts pattern: new rule must not change any pinned
   payer golden outcome unless explicitly expected) → persist DISABLED with authored_by:'llm',
   prompt_sha256, model, version → human approval flips active (rcm/admin only, server-enforced
   RBAC via lib/authz.ts).
4. Approval UI: draft rule view (condition tree rendered readable), golden-run diff report,
   approve/reject. Both locales/themes.

AI-2 — assistAppeal (ADDITIVE to deterministic templates — do not touch the template path):
5. Extend AppealDraft with optional suggestedParagraphs field (packages/appeals types) — the
   deterministic bilingual template body stays the primary output; NO LLM text is required for an
   appeal to work. generateAppeal signature unchanged.
6. features/assistAppeal.ts (claude-opus-4-8): input = pseudonymized claim-shape context
   (pseudonymize.ts from AI-0; free text EXCLUDED; DOB → age band) + denial reason + payer +
   AppealContext.clinicalNote? if present (pseudonymized). Direct MSA generation for Arabic — no
   EN→AR translation pipeline. Slot-filling: all facts (claim id, amounts, dates, codes) are
   immutable [SLOT_N] tokens; LLM writes ONLY argumentative prose around them.
7. Guardrail chain, in code: (a) post-generation diff — every slot token present verbatim, ZERO
   new digits/dates/codes invented (regex over Arabic+Western digits) — fail closed to template-
   only; (b) glossary injection (NPHIES/denial-code EN↔AR terms from packages/shared) + post-hoc
   term-presence check; (c) second-model verify pass (claude-sonnet-5 judge: factual consistency
   vs the pseudonymized record, formal MSA register, completeness — low score ⇒ suppress
   suggestion, log); (d) postprocess-ar.ts on all AR output; (e) detokenize LAST, after all checks.
8. UI: suggestions rendered as clearly-labeled DRAFT blocks the reviewer can insert/edit/discard
   inside the existing appeal review surface. Track SME edits (edit-distance log per suggestion —
   this is the ongoing quality metric). Human reviews, exports, submits manually — unchanged.
   Wordmark rule (BLK-9): تعويض stays Latin-isolated on AR surfaces.
DoD: build+tests green (fixtures in CI), coverage 80%+, golden suite green, reviewers
(typescript+security+healthcare) run, /santa-loop on the rules/appeals changes, /checkpoint
at each phase exit, chrome-devtools MCP verify EN/AR × light/dark + a11y,
superpowers:verification-before-completion.

ON COMPLETION (mandatory, in this order — §9 invariants 2+3):
a. Docs sync: docs/handoff.md (AI-2/AI-3 status, new surfaces, SME-edit-tracking metric);
   docs/blocker.md (BLK-AI-1/2 state, BLK-9 note on AR letters); rewrite
   docs/NEXT_STEP_PROMPT.md to point at PROMPT 3 of docs/04_agentic_retrofit_plan.md §9;
   update Obsidian brain ~/Desktop/ObsidianVault/Projects/Taweed (NPHIES).md "Build progress".
b. Commit on ai-phase-2-3, merge into main IN THIS DIR.
c. Push ritual: OLD=<main tip before merge>; git branch -f back-up $OLD &&
   git push -f origin back-up; THEN git push origin main. Verify one-behind.
Blockers honored in code: live pseudonymized-PHI calls stay OFF (per-feature flag) until
BLK-AI-1 (counsel) + BLK-AI-2 (ZDR org) recorded in docs/blocker.md as cleared. Synthetic-data
operation is unrestricted. BLK-9 still gates any AR letter reaching a real clinic.
```

### PROMPT 3 — AI-4 vision extraction + ground-truth eval (dual-gated; build now, route later)

```
Read docs/handoff.md + docs/04_agentic_retrofit_plan.md §3.3, §4.1, §6, §9 shared invariants.
Prior sessions delivered AI-0..AI-3 — extend, don't rebuild. IN-PLACE branch in this directory:
`git checkout -b ai-phase-4` (no worktree; result merges to main in THIS dir). Process:
brainstorming → writing-plans → TDD; claude-api skill before SDK/vision code; docs-lookup
(Context7) for pdf tooling; chrome-devtools MCP on the review-queue UI.

Goal: ClaudeVisionOcrAdapter behind the existing OcrAdapter seam (packages/ingest/src/
pdf-ocr.ts:15) + the validation/review pipeline + the eval harness that GATES production use.
The production data route (self-host VLM vs Claude-ZDR vs wait for in-Kingdom) is a separate
human decision (BLK-AI-1/3/4) — this session builds everything up to that gate using SYNTHETIC
and de-identified sample documents only.

1. Synthetic EOB corpus first: generator producing 30–50 realistic bilingual remittance PDFs
   (EN/AR headers, RTL tables, mixed Arabic-Indic/Western digits, multi-claim, partial denials,
   a few low-quality scan simulations) + ground-truth JSON per doc. Extend test/synthetic-fhir
   patterns; no real PHI anywhere.
2. schemas/eobExtraction.ts: zod schema — claims[], lines[], amounts in integer halalas (match
   @taweed/shared money conventions), payer/denial codes as z.enum from shared code sets, per-
   field confidence. No recursion, no numeric wire constraints (client-side refinements).
3. ClaudeVisionOcrAdapter implements OcrAdapter: single-shot PDF→JSON per doc (docs are 3–10pp),
   claude-sonnet-5, structured outputs, prompt-cached system+schema, page images downsampled
   ~1568px (hi-res only on escalation), SYNCHRONOUS API only (Batches is not ZDR-eligible — hard
   rule from plan §3.3; enforce via provider capability flag). Escalation tier: validator-failing
   docs re-run on claude-opus-4-8 hi-res; still failing ⇒ review queue.
4. Deterministic validators (ALL, fail ⇒ review, never auto-accept): cross-total checks (Σ line
   paid = remittance paid; billed = paid + rejected + patient-share); verbatim text-layer match
   for every amount/claim-id on born-digital PDFs (pdftotext layer, after ٠-٩→0-9 normalization +
   RTL-mark strip); schema enums for codes; flag mixed-digit-set anomalies.
5. Review-queue UI: side-by-side page image + extracted fields, per-field confidence coloring
   (money-semantics colors per design-brief), correct-and-approve flow writing to the existing
   B6 field-mapping/dimension-resolution path, audit on every approve. Both locales/themes.
6. Eval harness (the production gate): field-level exact-match on amounts/codes/ids over the
   synthetic corpus, per-model per-tier report (evalite, AI_EVALS_LIVE=1 only). Record the
   target threshold in the report output (suggest ≥98% on amounts, ≥95% overall — tune with
   the golden data). Also wire the fallback-ladder seams: AzureDocIntelOcrAdapter and
   SelfHostedVlmAdapter as typed stubs (same OcrAdapter iface, TODO(ai-route) tags) so the
   route decision is a swap, not a rewrite.
7. Wire into Ingest UI behind the AI_FEATURE_EXTRACTION flag: PDF drop → adapter → validators →
   review queue → B6 mapping. When flag off, current typed-stub behavior (throw → manual path)
   is unchanged.
DoD: build+tests green (fixtures in CI; live eval behind AI_EVALS_LIVE), eval report generated
on the synthetic corpus with per-field scores, validators table-driven-tested, reviewers run
(healthcare-reviewer MANDATORY — this is THE PHI-heavy surface; plus typescript+security),
/santa-loop on ingest-path changes, /checkpoint, chrome-devtools MCP verify both locales/themes,
superpowers:verification-before-completion.

ON COMPLETION (mandatory, in this order — §9 invariants 2+3):
a. Docs sync: docs/handoff.md (AI-4 status, adapter ladder, eval scores, route decision =
   PENDING BLK-AI-1/3/4); docs/blocker.md (record route options + what unblocks each); rewrite
   docs/NEXT_STEP_PROMPT.md (next = route decision + A2/A3 tail or real-data headline, whichever
   is unblocked); update Obsidian brain ~/Desktop/ObsidianVault/Projects/Taweed (NPHIES).md
   "Build progress" with the full AI-phase summary.
b. Commit on ai-phase-4, merge into main IN THIS DIR.
c. Push ritual: OLD=<main tip before merge>; git branch -f back-up $OLD &&
   git push -f origin back-up; THEN git push origin main. Verify one-behind.
Hard blocks: NO real partner documents through any cloud LLM until the route decision + counsel
sign-off are recorded in docs/blocker.md. Real-doc eval (30–50 de-identified partner remittances)
happens only after BLK-1 partner data exists AND counsel approves the de-identification protocol.
```

---
*Sources: 3-agent codebase seam analysis (this repo, 2026-07-05) + 4-lens web research workflow
(hosting/PDPL, vision-PDF, Arabic-LLM, integration/cost), adversarially tagged VERIFIED/REPORTED
with H/M/L confidence. Key primary sources inline. Cost figures from Anthropic published pricing
(cached 2026-06-24): Opus 4.8 $5/$25, Sonnet 5 $3/$15 (intro $2/$10 to 2026-08-31), Haiku 4.5
$1/$5 per MTok. Re-verify quarterly: Bedrock me-central-2 region table (BLK-AI-4), Azure Saudi
East GA, inference_geo geo list, SDAIA adequacy list.*
