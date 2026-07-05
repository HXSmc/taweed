# RESUME — agentic-retrofit plan session (heartbeat checkpoint)

> Purpose: if this session hits the usage limit / dies, paste this file into a fresh session
> to continue exactly where it stopped. Updated after every milestone (heartbeat method).
> Session started 2026-07-05. Task: create `docs/04_agentic_retrofit_plan.md` (agentic-AI
> retrofit implementation plan + research + paste-ready prompts).

## Task spec (from user)

1. Create proper implementation-plan MD in `docs/` for converting Taweed's architecture to a
   selectively-agentic AI system (LLM only where it improves the design — NOT everywhere).
   Include all research necessary (web research on in-Kingdom LLM hosting/PDPL, vision-PDF
   extraction, Arabic LLM quality, integration patterns, cost).
2. Use `docs/handoff.md` for the current standpoint (read: EXECUTE buildable pass merged to
   `main` at `ac91034`; back-up at `44e0e13`; next was A2/A3 UI tail + BLK-1/2/9 real-data headline).
3. End the plan MD with paste-ready prompts (style: `docs/NEXT_STEP_PROMPT.md` — self-contained,
   blockers table, DoD, toolchain quirks). Best-judgment count; quality over quantity.
4. Keep this resume.md updated (heartbeat) so nothing is lost on cutoff.

## Progress checkpoints

- [x] Read handoff.md + NEXT_STEP_PROMPT.md (context loaded)
- [x] Codebase seam analysis done (prior turn, 3 Explore agents) — key results snapshotted below
- [x] claude-api skill read. Banked facts: model IDs claude-opus-4-8 ($5/$25 per MTok, 1M ctx),
      claude-sonnet-5 ($3/$15, intro $2/$10 thru 2026-08-31), claude-haiku-4-5 ($1/$5, 200K ctx);
      TS SDK `@anthropic-ai/sdk`: `client.messages.parse()` + `zodOutputFormat` for structured
      outputs, `betaZodTool` + `toolRunner` for agent loops, native PDF document blocks (base64,
      32MB/600pp), prompt caching (5m TTL, prefix-match), Batches API 50% off, `inference_geo`
      top-level param (data residency, 1P + P-AWS only), provider clients AnthropicVertex /
      AnthropicBedrockMantle (Bedrock IDs prefixed `anthropic.`), adaptive thinking only on 4.7+.
- [x] Research workflow LAUNCHED (4 lenses: hosting/PDPL, vision-PDF, Arabic-LLM, integration+cost).
      Task ID wvzzgg9bj · Run ID wf_4cb4fff7-e4e · script:
      `.claude/projects/.../workflows/scripts/agentic-retrofit-research-wf_4cb4fff7-e4e.js`
      If session died mid-run: resume with Workflow({scriptPath, resumeFromRunId:"wf_4cb4fff7-e4e"});
      completed agents replay from cache; check journal.jsonl in the transcript dir first.
      ⚠️ FIRST RUN FAILED 2026-07-05: all 4 agents hit "session limit · resets 10:10am Asia/Riyadh"
      (0 done, 0 cached results). Resumed after reset via resumeFromRunId — all 4 re-run live.
- [x] Research results read + synthesized (all 4 lenses complete after limit-reset resume; full
      output: tasks/wn9szbke3.output + journal.jsonl). Headline findings:
      · NO in-Kingdom frontier LLM exists (inference_geo = global/us only; Bedrock ME = global
        CRI — inference leaves region; me-central-2 GA ~Jan-2026 but NO Claude; Azure KSA Q4-2026;
        OCI Riyadh GenAI has no Claude). End-state watch: Claude in-region on Bedrock me-central-2.
      · PDPL: no adequacy list → SCCs + mandatory risk assessment for transfers; true anonymization
        exits PDPL; pseudonymized still personal data. Route: PHI-free features → Claude 1P
        ZDR+inference_geo:us; appeal assist on pseudonymized structured fields (counsel gate
        BLK-AI-1); PDF extraction dual-gated (self-host VLM on OCI Riyadh vs SCC vs wait).
      · Arabic: frontier good enough for SME-reviewed MSA drafts; hallucination concentrates in
        numbers/dates/codes → slot-filling + digit-diff check + glossary + verify pass + AR
        post-processor (digits/tashkeel/bidi).
      · Rule authoring: no recursive schemas (bounded all/any ≤3); enum-constrained operator/fact;
        engine dry-run + payer-golden gate; authored_by:'llm' metadata.
      · Cost: $25–90/mo pilot — noise. Batches NOT ZDR-eligible; Fable-class needs 30-day
        retention — both banned on PHI paths. CI = FixtureProvider replay, zero live calls.
- [x] `docs/04_agentic_retrofit_plan.md` WRITTEN — standpoint, seam table, compliance envelope
      (§3 routing decision per feature), research digests (§4), @taweed/ai architecture (§5),
      phases AI-0..AI-5 (§6), risks (§7), new blockers BLK-AI-1..4 (§8), 3 paste-ready prompts
      (§9): P1 = AI-0+AI-1 (PHI-free, start now) · P2 = AI-3+AI-2 · P3 = AI-4+eval harness.
- [x] resume.md final update — TASK COMPLETE.

## STATUS: DONE ✅

Deliverable: `docs/04_agentic_retrofit_plan.md`. Next session: paste PROMPT 1 from its §9
(AI-0 foundation + AI-1 explainer — zero PHI, zero legal gates, buildable immediately).
This file can be deleted or kept as a session record.

## Key findings already banked (do NOT redo)

### Codebase ground truth (3-agent explore, this session)
- All 5 MVP modules REAL + tested; zero AI deps anywhere in lockfile; packages pure/typed.
- **Insertion seams (coupling ratings):**
  - Vision-LLM EOB/PDF extraction → `OcrAdapter` iface `packages/ingest/src/pdf-ocr.ts:15` (throws until injected) — CLEAN, purpose-built stub. Same for `XlsxAdapter` (`xlsx.ts:12`).
  - Appeal-draft assist → behind `generateAppeal(ctx)` `packages/appeals/src/generate.ts:32`; `AppealContext.clinicalNote?` spare input exists (`types.ts:18`) — CLEAN mechanically; policy says additive suggestion field, keep deterministic body + human review.
  - Flag explainer (EN/AR prose on scrub flags) → post-process `ScrubResult.flags` after `scrub()` (`scrub.ts:72-145`) — CLEAN, read-only downstream.
  - NL→rule authoring → emit `ScrubRule` JSON (conditions already `unknown` pure data, `types.ts:47`); `selectRulesForClaim` (`select.ts:31-42`) picks up versioned/scoped rules; `payer-golden.test.ts` = regression gate for generated rules — CLEAN-to-MODERATE.
  - Denial-reason classification → new output field/mapping needed — MODERATE.
  - NL→SQL analytics agent → MODERATE, must run inside `withSession`/`withTenant` RLS txn (`apps/web/lib/db.ts:47`, `packages/db/src/client.ts:22`); injection surface — recommend DEFER.
- DB entry: single sanctioned gate `withTenant` (RLS GUC). Audit lib on every PHI path.
- Effort est: selective retrofit ~4-8 wks additive, zero teardown. Nothing rated HARD.

### Compliance envelope (from docs/02 §6 + prior analysis)
- PDPL: health data = sensitive; PHI → cloud LLM = cross-border sensitive transfer = the ONE
  gating problem. Need in-Kingdom endpoint OR robust de-identification before the call.
- SFDA carve-out: keep LLM decision-support + human-in-loop; never auto-interpret clinical
  data to diagnosis; never auto-submit → stays out of medical-device regime.
- Audit: every LLM call logged (model, prompt hash, output hash, actor); LLM stays OUT of the
  money-number path (deterministic ROI is the sales motion).

## If resuming: next action

Read the checkpoints above; do the first unchecked item. Research workflow script (if it was
launched and died) persists under
`.claude/projects/-Users-alimc-Desktop-web-apps-taweed/*/workflows/scripts/` — resumable via
Workflow({scriptPath, resumeFromRunId}); check journal.jsonl for cached agent results first.

## Toolchain quirks (copy of handoff)

pnpm at `~/.local/bin/pnpm`; fish shell → `env VAR=val cmd`; RTK hook compresses stdout → write
to file + read; Node v20.2.0 (Next 15). This task is docs-only — no build needed.
