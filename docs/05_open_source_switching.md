# 05 — Open Source Switching: Anthropic → Self-Hosted In-Kingdom LLM
### Contingency plan — a full provider swap off Anthropic Claude onto a self-hosted open-weight model, IF Oracle/AWS GPU access clears

> Companion to `04_agentic_retrofit_plan.md` (the Claude-based AI build, already shipped) and
> `docs/HUMAN_CONFIRMATION_NEEDED.md` (the live source of truth for every blocker referenced
> below). This plan does NOT replace `04` — the Claude+SCC path (counsel sign-off, `BLK-AI-1`/
> `BLK-AI-2`) can proceed independently and in parallel. This is the alternate branch: what
> building on a self-hosted, genuinely in-Kingdom model would look like, and whether it's
> worth doing once the infrastructure question is actually answered.
>
> Originally seeded from a deep-research pass (`RESEARCH_FINDINGS_2026-07-01.md`, 103+99+99
> agents across three runs) whose findings on CHI denial-rate data, NPHIES onboarding, in-Kingdom
> cloud regions, competitor pricing, and IG licensing have all been folded into
> `docs/HUMAN_CONFIRMATION_NEEDED.md` sections A–F — that file has been retired/renamed into this
> one rather than kept as a second stale copy of information now live elsewhere.

---

## 0. STANDING INSTRUCTION — read this before executing ANYTHING from §9

**Every time you (or a future session) are asked to "execute" or "start building" from this
file, do this FIRST, before touching any code:**

1. Open `docs/HUMAN_CONFIRMATION_NEEDED.md` and re-read, fresh, not from memory:
   - **Email 4 (Oracle)** status — has a reply landed? What does it say about GPU/service
     coverage in `me-riyadh-1` and Oracle for Startups credit eligibility?
   - **Email 8 (AWS)** status — has a reply landed? What does it say about GPU/Trainium
     instance availability in `me-central-2` and AWS Activate credit eligibility?
   - **Section J item 6** (CST Cloud Computing Regulatory Framework applicability) — has
     counsel given a definitive answer on whether self-hosting on rented cloud infrastructure
     triggers CST registration?
   - **Section G4 / §I** — has the CR (Commercial Registration) actually been formed yet?
2. Classify the current state as exactly one of these three:
   - **(A) STILL WAITING** — no reply yet from Oracle or AWS, or counsel hasn't answered the
     CST question yet. → **Do nothing further.** Report back the current wait status (what's
     outstanding, roughly how long it's been) and stop. Do not start building speculatively.
   - **(B) BLOCKED / DISCARD** — a reply came back negative (no adequate GPU availability, no
     viable pricing/credits, CST registration confirmed required and judged not worth the
     overhead, or any other blocker below resolves unfavorably) → **discard this feature
     entirely.** Say so plainly, update this file's own status line to reflect the discard
     decision and why, and do not attempt a partial build.
   - **(C) CLEARED** — at least one of Oracle/AWS gives usable GPU access at viable pricing,
     AND the CST question has a clear "does not apply" or "applies and we're fine with it"
     answer, AND every other blocker in §3 is either cleared or explicitly judged
     non-blocking → **proceed** with the prompts in §9, in order.
3. Only after that classification is explicit should you either (a) report the wait, (b)
   discard, or (c) start executing §9 PROMPT 0 onward. Never skip straight to "PROMPT 1" on
   assumption — PROMPT 0 exists specifically to make this check part of the build itself, not
   just a note someone might forget to reread.

**Current status as of 2026-07-20: (A) STILL WAITING.** Emails 4 and 8 were both sent
2026-07-19; no reply from either as of this writing. CST question is logged in Section J,
unanswered (no counsel engagement scheduled yet — also blocked on the counsel-meeting blocker
in the confirmation doc). **Do not proceed past PROMPT 0 until this line is updated.**

---

## 1. Why this plan exists

Taweed's AI features (see `04_agentic_retrofit_plan.md`) currently call Anthropic's Claude API.
Real PHI use requires either:
- **(a)** Counsel-cleared Standard Contractual Clauses + a SDAIA cross-border risk assessment
  for the transfer to Anthropic's US-hosted endpoint (the `04`/`BLK-AI-1`/`BLK-AI-2` path,
  proceeding independently), **or**
- **(b)** Genuine in-Kingdom self-hosted inference, which removes the cross-border transfer
  question for the AI layer entirely — no SCC, no SDAIA risk assessment needed for *that*
  specific transfer (general PDPL duties — DPA, breach notification, controller/processor —
  still apply either way; see `HUMAN_CONFIRMATION_NEEDED.md` §H's own bottom line on this).

This document is the **(b) contingency plan** — evaluated in parallel, not instead of, the
counsel-cleared Claude path. Its entire premise rests on infrastructure that doesn't exist yet
for Taweed: real GPU access at a real price in an in-Kingdom cloud region. Until Oracle or AWS
answers that, this is a plan to have ready, not a plan to build against.

---

## 2. Swap difficulty — already scoped at the code level (verified 2026-07-20)

A GLM spoke did a read-only investigation of the actual codebase (task `t17845675274036`,
spot-checked against source by the hub before trusting it). Verified findings:

- **The Anthropic SDK is imported in exactly ONE file**: `packages/ai/src/anthropic-1p.ts`.
  Every other package/app in the repo is clean of it.
- **A provider-neutral interface already exists and is load-bearing**: `LlmProvider` /
  `LlmClient` / `StructuredRequest<T>` in `packages/ai/src/provider.ts`. Every AI feature
  (`explainFlag.ts`, `authorRule.ts`, `assistAppeal.ts`, `extractEob.ts`) routes through one
  audited runner (`run.ts`) that holds a reference to an `LlmProvider` — never the raw SDK.
  The header comment at `provider.ts:4-9` states the design intent verbatim: *"Bedrock / Vertex
  / self-hosted providers implement the same LlmClient later without touching feature code."*
- **A stub seam for exactly this swap already exists**: `packages/ai/src/adapters/
  selfhosted-vlm-adapter.ts`, dated 2026-07-08 — pre-built, throws a `TODO(ai-route)` error,
  waiting to be wired.
- **Real swap surface is small**: `run.ts`'s `resolveAiProvider()` default (currently
  `createAnthropicProvider()`), `config.ts`'s `ANTHROPIC_API_KEY` check, `models.ts`'s model-ID
  map, and the new provider implementation itself. **~3-5 files of real change.** No feature
  file, no test, no audit/pseudonymization code needs to change.
- **The two genuinely hard parts** are behavioral, not structural:
  1. **Structured output moves client-side.** Claude's `messages.parse()` + `zodOutputFormat`
     is a server-side guarantee; a self-hosted model needs grammar-constrained/guided decoding
     (vLLM/TGI + a library like Outlines/XGrammar) to get the same JSON-schema-conformant
     output. The `StructuredResult.parsed: T | null` contract already tolerates a parse
     failure — no feature code changes, but failure rates may differ.
  2. **AI-4 (EOB vision extraction) needs a different document-input pipeline.** Claude
     accepts a raw PDF `document` content block natively; a self-hosted VLM on vLLM/TGI needs
     PDF-rasterized-to-images instead. This is real, separate engineering — exactly what the
     `selfhosted-vlm-adapter.ts` stub is reserved for.
- **No test in the repo pins an exact Claude output.** CI runs against a record/replay fixture
  provider re-validated by zod schema, not the network. Live evals are gated
  (`AI_EVALS_LIVE=1`) and score field-level accuracy — a model swap changes the score, not
  whether any test passes/fails.

**Bottom line: this is an adapter-level swap, not a rewrite.** The real cost is (a) getting
GPU infrastructure at all (§3), (b) the AI-4 vision port, and (c) proving self-hosted output
quality is good enough on real domain tasks (§3, `BLK-OSS-4`) — not fighting the codebase.

---

## 3. Blockers — check `HUMAN_CONFIRMATION_NEEDED.md` for current status, not this table

This table is a snapshot as of 2026-07-20. **The confirmation doc is the live source of truth
— re-read it per §0 before trusting any status below.**

| # | Blocker | Status (2026-07-20) | Unblocks | Confirmation-doc anchor |
|---|---|---|---|---|
| `BLK-AI-3` (existing, broadened) | Oracle Riyadh (`me-riyadh-1`) **and/or** AWS Riyadh (`me-central-2`) real GPU service coverage + startup credit pricing | 🔴 open — Email 4 (Oracle) and Email 8 (AWS) both sent 2026-07-19, no reply yet | GPU infra decision — without this, there is nothing to self-host on | Section I item 4; Emails 4/8 |
| `BLK-OSS-CST` | CST Cloud Computing Regulatory Framework — does self-hosting on rented cloud (not owning a data center) require CST registration as a cloud services provider? | 🔴 open — genuinely ambiguous from CST's own public pages, routed to counsel, not yet answered (no counsel meeting scheduled yet) | Legal green light to self-host at all | Section G4; Section J item 6 |
| `BLK-OSS-QUALITY` | Model quality eval — is the recommended self-hosted model (see §4) actually good enough for AI-2 (appeal drafting) and AI-4 (EOB vision extraction) vs. Claude? | 🔴 open — no eval run possible until GPU infra exists; the eval harness already exists in-repo (`extractEob.eval.ts`, `scoring.ts`) and can score a self-hosted provider the same way it scores Claude | Production go-ahead (infra alone is not sufficient — a bad model is worse than staying on Claude) | — (new, tracked here) |
| `BLK-OSS-DATA` | Real labeled data for any fine-tuning pass (as opposed to prompt/decoding-only tuning) needs real, de-identified clinic claims — which needs the CR + DPA to exist first | 🔴 open — blocked on CR formation, same gate as everything else real-PHI (`G5`) | Any fine-tuning quality-improvement work (not the base self-host switch itself) | Section G5; Section I item 9 |
| `BLK-AI-1` (existing, applies here too) | KSA privacy counsel sign-off on the overall data-handling posture | 🔴 open — counsel meeting not yet scheduled | Real-PHI operation on ANY provider, self-hosted or not | Section C1; Section J |

**Read `BLK-AI-3`, `BLK-OSS-CST`, and `BLK-AI-1` as the three hard gates on even STARTING §9
PROMPT 1.** `BLK-OSS-QUALITY` gates going to *production* once built (build-and-eval on
synthetic data is fine before that, mirroring how `04`'s AI-4 was built synthetic-only ahead of
its own route decision). `BLK-OSS-DATA` only matters if a fine-tuning pass is ever attempted —
guided decoding (§4) is a training-free fix for structured output and doesn't wait on this.

---

## 4. Model recommendation

> **Research completed 2026-07-20** — 5-agent cross-reviewed via Antigravity, 10 verified
> claims / 0 disputed. Full citations and raw findings:
> `~/Desktop/ObsidianVault/Brain/Research/taweed-self-hosted-llm-migration.md`. Re-run this
> research if this plan sits unbuilt for more than ~2-3 months — the open-weight landscape
> moves fast and a mid-2026 pick may be stale by build time.

### Primary recommendation: **Qwen family, 72B class**

- **Text (AI-1, AI-2, AI-3)**: Qwen 2.5/3 72B-Instruct. Verified strongest open-weight option
  on native Arabic instruction-following, formal/legal register, and schema-constrained JSON
  output — outperforms Llama and DeepSeek on these axes specifically. Concrete quantized
  reference checkpoint that exists today: `Qwen/Qwen2.5-72B-Instruct-AWQ`. **Check at build
  time whether an equivalent Qwen3-72B-class AWQ checkpoint has since landed** — this family
  moves fast and the research treated 2.5/3 as roughly interchangeable rather than picking one
  specific point release.
- **Vision (AI-4)**: **Qwen2.5-VL**, with **Baseer** (a Misraj fine-tune specialized for Arabic
  documents/tables) as the concrete variant to evaluate first. Note: Claude's own vision
  remains the out-of-the-box gold standard per this research — Qwen2.5-VL needs a LoRA
  fine-tuning pass on Arabic layouts (e.g. against KITAB-Bench-style data) to close that gap,
  not a zero-shot swap. This is exactly `BLK-OSS-QUALITY`'s open question — build and eval
  before trusting it.
- **Structured output**: vLLM with **XGrammar** as the guided-decoding backend (the 2026
  default in vLLM, ~5x throughput vs. earlier backends) — Outlines as a reliable fallback if
  XGrammar has gaps against this codebase's actual schema shapes (verify against
  `packages/ai/src/schemas/` during OSS-1, not assumed from research alone).
- **GPU sizing**: 72B at 4-bit (AWQ/GPTQ) needs ~36-40GB VRAM for weights alone — a single
  L40S (48GB) is too tight once KV-cache/context overhead is added (would cap context to
  ~4-8K tokens). **A single H100 (80GB) is the realistic target**, supporting 32K+ context
  and reasonable batching. Confirmed available as a bare-metal shape in **Oracle Riyadh
  (`me-riyadh-1`)**: `BM.GPU.H100.8`, ~$10/GPU-hr (pricing is OCI's globally uniform rate,
  not a special local rate — verify this holds for me-riyadh-1 specifically once Oracle
  actually replies). AWS `me-central-2` reportedly has H100 (`p5.48xlarge`) on its roadmap but
  availability is capacity-constrained and often requires EC2 Capacity Blocks — **this is
  exactly the kind of thing Email 8's reply needs to confirm or refute**, don't assume it's
  available on-demand.
- **License**: Qwen 2.5/3 is Apache 2.0 for most checkpoints (some smaller ones carry a Qwen
  Community License capped at 100M MAU — irrelevant at Taweed's scale). No commercial-use
  blocker for a paid B2B SaaS.

### Fallback if Qwen doesn't clear the eval bar (`BLK-OSS-QUALITY`)

- **DeepSeek V3/R1 is disqualified for the single-GPU constraint** — the full model needs
  ~350-400GB VRAM even at 4-bit quantization, nowhere near a single H100. Only relevant if
  Taweed's infra scope ever grows to a multi-GPU cluster, which is explicitly out of scope
  for a pre-revenue startup per this plan's own framing (§1).
- **ALLaM-34B (SDAIA, Saudi sovereign model)** is the realistic fallback: royalty-free
  SDAIA-issued license (reportedly inheriting Llama 2-style terms), genuinely in-Kingdom in
  spirit, but this research confirms it **lags Qwen 72B on complex multi-step reasoning and
  schema-constrained JSON output** — the exact two things AI-2/AI-3/AI-4 lean on hardest.
  Worth an A/B during OSS-4 regardless, since it may be the only option if Qwen's license
  terms or hosting characteristics change.
- **Unconfirmed, single-source, worth a look if time allows but not load-bearing**: Falcon
  Arabic (lightweight candidate), Chandra/AtlasOCR (specialized Arabic layout extraction
  models) — neither reached multi-agent corroboration in this pass.

### Benchmarks to actually run the eval against (OSS-4)

BALSAM (SDAIA/KSGAAL, 78 tasks), AraGen (MBZUAI, 3C3H metric), and QIMMA (قِمّة, a
quality-first 2026 leaderboard) are the standing Arabic-LLM evaluation frameworks this
research surfaced — useful as an external sanity check alongside Taweed's own in-repo eval
harness (`extractEob.eval.ts`, `scoring.ts`), not a replacement for it.

---

## 5. Architecture (mirrors `04`'s pattern — same interface, new provider)

```
packages/ai/
├── src/provider.ts                    # UNCHANGED — LlmProvider/LlmClient/StructuredRequest iface
├── src/anthropic-1p.ts                # UNCHANGED (kept as the counsel-cleared-path provider)
├── src/adapters/
│   └── selfhosted-vlm-adapter.ts      # WIRE (currently a throwing stub) — vision path for AI-4
├── src/selfhosted-vllm.ts             # NEW — LlmProvider implementation for the recommended
│                                        model via vLLM/TGI HTTP client + guided-decoding schema
│                                        enforcement (replaces messages.parse/zodOutputFormat)
├── src/run.ts                         # EDIT — resolveAiProvider() becomes env-driven
│                                        (TAWEED_AI_PROVIDER=anthropic|selfhosted), not hardcoded
├── src/config.ts                      # EDIT — env contract for the self-hosted provider
│                                        (endpoint URL, optional auth token — no API key model)
├── src/models.ts                      # EDIT — model-ID map gains a selfhosted tier alongside
│                                        opus/sonnet/haiku
└── test/                              # anthropic-1p.test.ts untouched; new pure-helper tests
                                         for selfhosted-vllm.ts follow the same pattern
```

Both providers can coexist behind the `TAWEED_AI_PROVIDER` env var — this is a **parallel
option, not a forced migration**. The counsel-cleared Anthropic path stays the default until
the self-hosted path has cleared its own eval bar (`BLK-OSS-QUALITY`).

---

## 6. Phased plan

| Phase | Builds | Gates | Est |
|---|---|---|---|
| **OSS-0 — Infra provisioning** | Provision the actual GPU instance (Oracle or AWS, whichever cleared in §3) in the in-Kingdom region; stand up vLLM/TGI serving the recommended model (§4) at the chosen quantization | `BLK-AI-3` cleared | ~2-4 days once infra access exists |
| **OSS-1 — Provider implementation** | `selfhosted-vllm.ts` implementing `LlmProvider`; guided/constrained decoding wired for structured output (replacing `messages.parse`); env-driven provider selection in `run.ts`/`config.ts`/`models.ts` | OSS-0 done | ~3-5 days |
| **OSS-2 — AI-1/AI-2/AI-3 cutover (text-only features)** | Point `explainFlag`, `assistAppeal`, `authorRule` at the self-hosted provider behind a feature flag; run existing fixture/integration tests against it | OSS-1 done | ~2-3 days |
| **OSS-3 — AI-4 vision port** | Wire `selfhosted-vlm-adapter.ts` for real: PDF rasterization pipeline + image-message format for the vision variant of the recommended model; re-run the existing synthetic EOB eval harness against it | OSS-1 done; vision variant of the chosen model confirmed in §4 | ~1-1.5 wk (the hardest part, per §2) |
| **OSS-4 — Eval + go/no-go** | Score the self-hosted provider through the SAME eval harness already scoring Claude (`extractEob.eval.ts`, `scoring.ts`, plus a new equivalent for AI-2 quality) on synthetic data; compare against Claude's existing scores | OSS-2/OSS-3 done | ~2-3 days — this is the decision point, not a rubber stamp |
| **OSS-5 — Production cutover (conditional)** | Only if OSS-4's eval clears a bar the hub sets before running it (not after seeing the score) — flip default provider, keep Anthropic as fallback | `BLK-OSS-QUALITY` cleared; `BLK-AI-1` (counsel) cleared for real-PHI operation regardless of provider | — |

**If OSS-4's eval does NOT clear the bar:** stay on the counsel-cleared Claude path. This whole
plan was a contingency, not a commitment — a self-hosted model that performs worse than Claude
on appeal-drafting or EOB-extraction accuracy is not worth the compliance-sovereignty gain,
given the general PDPL duties don't go away either way (§1).

---

## 7. Risks

| Risk | L | I | Mitigation |
|---|---|---|---|
| Oracle/AWS reply is negative or pricing is unviable for a pre-revenue startup | M | H | This is exactly what §0/§3 gate — discard cleanly, no sunk-cost building |
| Self-hosted model underperforms Claude on Arabic appeal-letter quality or EOB extraction accuracy | M | H | OSS-4's eval gate is mandatory before any production cutover; bar set BEFORE seeing results |
| CST registration turns out to be required and adds real overhead | M | M | `BLK-OSS-CST` resolved via counsel before OSS-0 starts, not discovered mid-build |
| Guided decoding doesn't support the schema shapes this codebase already uses (nested/enum-heavy) | L | M | Verify during OSS-1 against the actual `schemas/` in `packages/ai/src/schemas/`, not assumed from research alone |
| Maintaining two providers (Anthropic + self-hosted) long-term doubles the audit/test surface | L | M | Self-hosted stays behind a flag; if it doesn't clear OSS-4, remove rather than maintain indefinitely |

---

## 8. What changed from `RESEARCH_FINDINGS_2026-07-01.md`

This file replaces `docs/RESEARCH_FINDINGS_2026-07-01.md` (git-renamed, not deleted — history
preserved). That file's findings (CHI denial-rate absence, NPHIES onboarding contacts, Oracle
Riyadh GA, Waseel/HealthOrbit/Ecaresoft pricing, IG license restriction) were all cross-checked
against `docs/HUMAN_CONFIRMATION_NEEDED.md` on 2026-07-20 and confirmed already present there
(sections A, B, C3, D1, D2, F1-F3) — nothing from the old file was lost, it was fully absorbed
before this rename.

---

## 9. Paste-ready prompts

> Style per `04_agentic_retrofit_plan.md` §9. **PROMPT 0 is mandatory and comes first, every
> time** — it operationalizes §0's standing instruction as an actual build step, not just a
> note someone has to remember to reread.

### PROMPT 0 — Blocker check (run this FIRST, every single time, before any other prompt)

```
Read docs/05_open_source_switching.md §0 and §3 in full. Then read
docs/HUMAN_CONFIRMATION_NEEDED.md fresh — specifically: Email 4 (Oracle) status, Email 8 (AWS)
status, Section J item 6 (CST applicability), Section G4/§I (CR formation status), and any
counsel-meeting outcome if one has occurred.

Classify the current state as exactly one of:
(A) STILL WAITING — no reply from Oracle/AWS yet, or CST question unanswered by counsel.
(B) BLOCKED/DISCARD — a reply or counsel answer came back unfavorable (no GPU access, no
    viable pricing, CST registration required and not worth it, or any other blocker in §3
    resolved unfavorably).
(C) CLEARED — GPU access + viable pricing confirmed from at least one of Oracle/AWS, AND CST
    question resolved favorably or ruled inapplicable, AND BLK-AI-1 (counsel) is far enough
    along that real-PHI operation isn't itself the blocker.

Update docs/05_open_source_switching.md §0's "Current status as of <date>" line to reflect
today's actual finding, with today's date. If (A): report the wait status back to the user in
one paragraph and STOP — do not proceed to PROMPT 1. If (B): update §0 and §3 to record the
discard decision and why, tell the user this feature is being discarded, and STOP. If (C):
report that the plan is cleared to build, and proceed to PROMPT 1 only if explicitly asked to
continue in the same session (do not auto-chain into a multi-day build without a fresh
go-ahead).
```

### PROMPT 1 — Self-hosted provider implementation (only after PROMPT 0 returns CLEARED)

```
Read docs/05_open_source_switching.md in full (§2-§6 especially) and
docs/04_agentic_retrofit_plan.md §5 (architecture) for the existing LlmProvider pattern.
Confirm PROMPT 0 was run this session and returned CLEARED before starting — if not, stop and
run PROMPT 0 first.

Build OSS-1 on an IN-PLACE branch in this directory (`git checkout -b oss-switch-provider`, no
separate worktree — gitignored local docs don't sync). Process: superpowers:brainstorming →
superpowers:writing-plans → superpowers:test-driven-development.

1. Confirm the exact model + quantization from §4's (by-then-filled) recommendation and the
   vLLM/TGI + guided-decoding library it names. Verify current API/config syntax via
   docs-lookup (Context7) or a fresh /research check if anything looks stale — do not assume
   the July-2026 research is still current if this session runs materially later.
2. packages/ai/src/selfhosted-vllm.ts: implement LlmProvider/LlmClient per provider.ts's
   existing interface (mirror anthropic-1p.ts's shape). parseStructured() enforces the zod
   schema via the guided-decoding mechanism identified in §4, not a post-hoc regex parse.
   Handle the StructuredResult.parsed: null path on a guided-decode failure — this already has
   a contract, don't invent a new one.
3. packages/ai/src/run.ts: make resolveAiProvider() read TAWEED_AI_PROVIDER (default
   "anthropic", so nothing changes for existing callers unless explicitly flipped).
4. packages/ai/src/config.ts: add the self-hosted env contract (endpoint URL + optional auth
   token) alongside the existing ANTHROPIC_API_KEY check.
5. packages/ai/src/models.ts: add the self-hosted model-ID mapping.
6. New pure-helper tests for selfhosted-vllm.ts mirroring test/anthropic-1p.test.ts's pattern
   (no network — this is CI-safe).

DoD: existing fixture-based tests for AI-1/AI-2/AI-3 all pass against the NEW provider too (run
them with TAWEED_AI_PROVIDER=selfhosted against a real dev instance of the model, not just
fixtures, at least once manually); build green; typescript-reviewer + security-reviewer on the
diff.

ON COMPLETION: update docs/handoff.md, docs/blocker.md (BLK-AI-3 status), and this file's §6
phase table (mark OSS-1 done). Do NOT merge to main without the hub reviewing the diff first —
this touches the AI/PHI boundary.
```

### PROMPT 2 — AI-4 vision port (only after PROMPT 1 is merged and OSS-2 text features are validated)

```
Read docs/05_open_source_switching.md §2's AI-4 discussion and
docs/04_agentic_retrofit_plan.md §4.1 (vision-PDF research digest) + §9 PROMPT 3 (the original
Claude-based AI-4 build, for the validator/eval pattern to mirror).

Build OSS-3 on an in-place branch (`git checkout -b oss-switch-vision`). Wire
packages/ai/src/adapters/selfhosted-vlm-adapter.ts for real (currently a throwing stub):

1. PDF rasterization: convert each page to an image (reuse or extend whatever the synthetic-EOB
   corpus generator already uses for Playwright-based PDF creation, per 04 §9 PROMPT 3 note on
   test/synthetic-fhir patterns — check what rasterization tooling, if any, already exists
   before adding a new dependency).
2. Vision-model call via the self-hosted provider's vision variant (confirmed in §4), image
   message format per that model's actual API (verify current syntax — do not assume from
   July-2026 research if this runs later).
3. Reuse the EXISTING deterministic validators (eob-validators.ts — cross-total checks,
   text-layer verbatim match, enum defense-in-depth) unchanged — these are provider-agnostic
   by design already.
4. Re-run the existing synthetic EOB eval harness (extractEob.eval.ts, scoring.ts) against this
   new adapter. Do NOT modify the eval's scoring/threshold logic to make the new provider look
   better — if the score is worse, that's real information for OSS-4's decision.

DoD: eval report generated comparing self-hosted-vision vs Claude-vision on the same synthetic
corpus; healthcare-reviewer + security-reviewer on the diff (this is the PHI-heaviest surface).

ON COMPLETION: update docs/handoff.md, this file's §6 (mark OSS-3 done, record the eval
numbers), and flag the OSS-4 decision explicitly — do not silently treat a passing build as a
passing eval.
```

### PROMPT 3 — Eval + go/no-go decision (the actual decision point — run manually, not just by a spoke)

```
Read docs/05_open_source_switching.md §6 (OSS-4) and §7 (risks). This is a HUB decision, not a
spoke task — the hub sets the acceptance bar BEFORE looking at the numbers (per §6's own
warning against a rubber stamp), then compares:
- AI-2 (appeal draft) quality: self-hosted vs Claude, scored however the existing SME
  edit-distance metric or an equivalent judge-model rubric works today.
- AI-4 (EOB extraction) accuracy: self-hosted vs Claude on the synthetic corpus, field-level
  exact-match, per the existing eval harness output from PROMPT 2.
- Structured-output failure rate: how often does guided decoding fail to produce valid JSON
  compared to Claude's server-side guarantee, across all four features.

Decide, and record the decision AND its reasoning in this file's §6 table and in
docs/handoff.md: (a) production cutover — self-hosted becomes the default provider behind
TAWEED_AI_PROVIDER, Anthropic stays as an explicit fallback; or (b) stay on Claude — record why,
and either archive this plan as "evaluated, not adopted" or leave it flagged for a future
re-run once the self-hosted model landscape moves (re-run §4's research pass again — this
market changes fast, per the same warning in the original research prompt).

Do NOT proceed to (a) without BLK-AI-1 (counsel sign-off for real-PHI operation) also cleared —
that gate is provider-independent and still applies.
```

---
*This plan supersedes `docs/RESEARCH_FINDINGS_2026-07-01.md` (renamed 2026-07-20, findings
absorbed into `HUMAN_CONFIRMATION_NEEDED.md` first — see §8). Re-run §4's model research
periodically if this plan sits unbuilt for more than ~2-3 months — the open-weight landscape
moves fast enough that a mid-2026 recommendation may be stale by the time GPU access clears.*
