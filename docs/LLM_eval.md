# Taweed — LLM Provider Evaluation (Claude vs Gemini vs GLM)

> **Who this is for:** anyone deciding whether Taweed's AI layer should stay
> single-provider (Anthropic Claude) or add Gemini/GLM as alternatives —
> for cost, redundancy, or latency reasons.
>
> **Scope:** all 4 AI features (AI-1 `explainFlag`, AI-2 `assistAppeal`,
> AI-3 `authorRule`, AI-4 `extractEob`), scored against the same corpora with
> the same scorers across 3 providers. Written 2026-07-24. Two build phases:
> (1) an AI-4-only trial (`gemini-trial`/`glm` branches, prior sessions),
> (2) extending genuine scoring evals to the other 3 features and re-running
> everything (`main` + both branches, this session).
>
> **Branch map** (see §5 for exactly what lives where):
> - `main` — shared eval-suite infrastructure + Claude-backed evals for all
>   4 features. **Pushed** (commit `aae37c7`).
> - `glm` — adds `glm-1p.ts` (the GLM provider) + GLM-backed evals for all
>   4 features. **Local only, never pushed, never merged to main.**
> - `gemini-trial` — adds `gemini-1p.ts` (the Gemini provider) + Gemini-backed
>   evals for all 4 features. **Local only, never pushed, never merged.**
>
> Neither `glm` nor `gemini-trial` is a production migration — this is a
> research/eval exercise. Anthropic remains the sole live-path provider
> (`resolveAiProvider` in `packages/ai/src/run.ts`) unless a future decision
> changes that.

---

## 1. Final scores — all 4 features, all 3 providers

Same synthetic corpora, same scoring modules, live-verified against real
provider APIs on 2026-07-24 (after fixing the 2 bugs in §3).

### 1.1 explainFlag (AI-1) — objective/heuristic checks, N=15 (real shipped rule set)

| | Claude (haiku) | Gemini (3.1-pro) | GLM (5.2) |
|---|---|---|---|
| Pass rate | 66.7% (10/15) | **93.3% (14/15)** | **93.3% (14/15)** |
| All-fields-valid rate | 100% | 100% | 100% |
| Digit-law OK rate | 100% | 100% | 100% |
| Clinical-language flag rate | 33.3% | 6.7% | 6.7% |
| Upcoding-language flag rate | 0% | 0% | 0% |
| Avg latency/call | ~6-12s (run-to-run variance) | ~11.7s | ~12.3s |

**Read this carefully:** Claude's lower number is a measurement artifact, not
a capability gap. `explainFlag.ts` never pins `temperature` for Claude
(Gemini/GLM's provider files hardcode `temperature:0` for every call), so
Claude's real production behavior has genuine run-to-run sampling variance —
repeated runs during this session ranged 66.7%-93.3% on the identical
corpus. The `clinicalLanguageFlag`/`upcodingLanguageFlag` checks are keyword
heuristics (see `packages/ai/evals/explainFlagScoring.ts`), not semantic
understanding — a compliant explanation that happens to say "diagnosis code"
as a data-entry field name can trip a false positive.

### 1.2 assistAppeal (AI-2) — objective paragraph-gate pass rate is the PRIMARY metric, N=8

| | Claude (opus) | Gemini (3.1-pro) | GLM (5.2) |
|---|---|---|---|
| Objective gate pass rate | **100% (8/8)** | **100% (8/8)** | 37.5% (3/8) |
| ok rate (incl. self-verify) | 100% | 87.5% | 37.5% |
| Self-verify-suppressed rate | 0% | 12.5% | 0% |
| Schema-invalid rate | 0% | 0% | **62.5%** |
| Avg latency/call | ~24-28s | ~28.1s | **~52.0s** (2 model calls/item) |

The **objective gate pass rate** — not the pipeline's own self-judge
`verifyScore` — is the fair cross-provider metric here. `assistAppeal()`
injects ONE provider for both generation AND its internal verify-judge step,
so a provider grading its own output isn't comparable to another provider
doing the same to ITS OWN output (see `packages/ai/evals/assistAppealScoring.ts`
header for the full reasoning). GLM's remaining 62.5% failure is real and
specific to the `AppealVerify` (judge) call — confirmed NOT a truncation
issue (already has 4096+ token headroom, see §3.2) — a genuine model-accuracy
miss on that particular schema, not chased further.

### 1.3 authorRule (AI-3) — real deterministic gate, zero model involved, N=13

| | Claude (opus) | Gemini (3.1-pro) | GLM (5.2) |
|---|---|---|---|
| Gate pass rate (`validateAuthoredRule`) | **100% (13/13)** | **100% (13/13)** | **100% (13/13)** |
| Severity match rate | 69.2% | 76.9% | 69.2% |
| Field match rate | 100% | 100% | 92.3% |
| Avg leaf coverage rate | 100% | 100% | 100% |
| Avg latency/call | ~6.5-8.6s | ~6.9-12.8s | ~8.6-10.2s |

The primary metric (`validateAuthoredRule` — shape check → engine dry-run →
golden-corpus regression, `packages/rules-engine/src/author.ts`, no model
involved at all) is fully objective and all 3 providers clear it every time.
Severity/field/leaf-coverage are secondary structural-similarity checks
against a hand-authored expected draft.

### 1.4 extractEob (AI-4) — field-level exact-match, established in prior sessions, unchanged this round

| | Claude (sonnet) | Gemini (3.1-pro, tuned) | GLM (5v-turbo, tuned) |
|---|---|---|---|
| Overall | **98.1%** | 96.0% | 55.6% |
| Amounts | 100% | 100% | 57.6% |
| Hallucinated claims/lines | 0/0 | 0/0 | 13/88 |
| Avg latency/call | ~16.3s (derived) | ~20s (derived) | 31.2s |

Full history (multiple tuning rounds, bugs found/fixed, model escalations)
in the vault notes referenced in §6 — this table is the final state only.

---

## 2. Verdict

**Claude** — strongest, most consistent leader on the one feature with
genuine per-field exact-match difficulty (extractEob). Its lower explainFlag
number this round is noise (unpinned temperature), not a real weakness.

**Gemini** (`gemini-3.1-pro-preview`, paid tier) — the most consistently
strong alternative. Matches or ties Claude on 3 of 4 features (explainFlag,
assistAppeal, authorRule) after fixing the thinking-token bug (§3.1), and
lands close behind on extractEob (96.0% vs 98.1%). The best candidate if
Taweed ever wants multi-provider redundancy or a cost/latency tradeoff.

**GLM** (`glm-5.2` text / `glm-5v-turbo` vision) — clearly third. Matches
Claude/Gemini on the two features gated by a deterministic non-model check
(authorRule) or simple heuristics (explainFlag), but has a real, specific
weakness on assistAppeal's judge call and a substantial gap on extractEob's
exact-match vision task. Also consistently the slowest across every feature
(roughly 1.5-3x the other two). Not recommended as a Claude replacement;
viable only for cost-insensitive, low-precision-tolerant use cases.

No provider hit balance/quota exhaustion during this comparison — every
number above is a complete run, never a partial/excluded one.

---

## 3. Real bugs found and fixed (engineering findings, not model limits)

All of the following were found via live runs against real APIs, root-caused
with a targeted diagnostic before assuming a fix, and re-verified against the
real production code path (not a synthetic test) before being trusted.

### 3.1 Gemini: thinking-token truncation (found 2026-07-24)

`gemini-3.1-pro-preview` is a "thinking" model — its internal reasoning
tokens are billed against `maxOutputTokens` **before** any visible output
text. `gemini-1p.ts` passed each feature's `req.maxTokens` straight through
to the API; every feature's token budget (1024 for explainFlag, 1024/2048
for assistAppeal's two calls) was tuned assuming Claude's behavior (no hidden
thinking cost), so responses truncated mid-JSON on nearly every call —
diagnosed via `usageMetadata.thoughtsTokenCount` (1204 tokens of thinking
alone, on a 1024-token budget, for a 4-field bilingual prompt). This produced
a false ~0% pass rate that had nothing to do with model capability.

Tried `thinkingConfig:{thinkingBudget:0}` first (disable thinking for this
mechanical structured-output task) — the live API rejects it outright for
this model: `"Budget 0 is invalid. This model only works in thinking mode."`
Fixed instead with a `maxOutputTokens` floor of 4096, independent of the
caller's cross-provider budget (`packages/ai/src/gemini-1p.ts`, `gemini-trial`
branch only).

Before/after (same corpus, same scorer):
- explainFlag: 0% → 93.3% (14/15)
- assistAppeal: 0% → 100% (8/8) objective gate pass rate

### 3.2 GLM: verbosity truncation (found 2026-07-24)

Same symptom (truncated mid-JSON), different mechanism — GLM has no hidden
"thinking" token cost, but its persuasive-prose generation for `assistAppeal`
genuinely ran longer than Claude's typical output for the same prompt,
exhausting a 2048-token budget. Same fix shape: a `max_tokens` floor of 4096
in `glm-1p.ts` (`glm` branch only).

Before/after:
- assistAppeal: 0% → 37.5% (3/8) objective gate pass rate (remaining 62.5%
  is real, `AppealVerify`-specific, confirmed not a truncation artifact —
  see §1.2)
- explainFlag: 66.7% → 93.3% (14/15) — also benefited from the floor

### 3.3 Anthropic SDK: silent throw on truncated JSON (found 2026-07-24, `main`)

Pre-existing gap, unrelated to Gemini/GLM: `anthropic.messages.parse()` (the
official SDK's structured-output helper) throws a bare `AnthropicError`
directly — not `StructuredResult{parsed:null}` — when it can't JSON-parse a
truncated model response. This broke the "provider never throws on parse
failure" contract every other provider (Gemini, GLM, the test fixture)
already followed, and surfaced live as a crash on `assistAppeal.eval.ts`'s
first full run (`Error: Failed to parse structured output as JSON:
Unterminated string in JSON...`).

Fixed in `packages/ai/src/anthropic-1p.ts` by distinguishing this specific
SDK throw (`instanceof AnthropicError && !(instanceof APIError)` — `APIError`
covers real network/auth/rate-limit failures, which must keep propagating)
and converting it to `parsed:null`, matching every other provider. Landed on
`main`, so it benefits the live Anthropic path too, not just the eval suite.

### 3.4 Eval-harness bugs found via orchestrated review (found 2026-07-24, `main`)

A 2-round multi-dimension review (correctness / security / ponytail-
simplicity / taweed-conventions, then a fix-verification round) with
adversarial verification on every finding caught 9 confirmed issues before
any of this landed on `main`:

- The per-item resilience loop (balance/rate-limit/transient/schema-invalid
  classification) was independently copy-pasted across all 3 new eval files
  — extracted into one shared `runEvalLoop()` in `resilience.ts`.
- **The eval files silently mishandled schema-invalid errors** — despite
  `resilience.ts`'s own documented contract ("score it as a miss, keep
  going"), none of the 3 new eval files actually branched on that
  classification; a schema-invalid response would crash the whole run
  instead of being scored. Fixed by making `runEvalLoop` handle it
  internally via a mandatory `onSchemaInvalid` callback.
- Tenant-seeding in `beforeAll` was hand-rolled instead of reusing
  `packages/db/test/helpers.ts`'s `seedTenant()`.
- A shared digit-law regex and a rate-calculation helper were copy-pasted
  across 3 scoring modules — extracted into `scoringUtils.ts`.
- `authorRuleScoring.ts`'s `isLeaf()` type predicate used plain `string`
  instead of the real `AuthorableFact`/`ScrubOperator` literal-union types —
  passed the package-scoped `tsc` check but **failed the real root
  `tsconfig.json` typecheck** (a genuine gap in how this session had been
  typechecking up to that point — see §4).
- `authorRule`'s eval loop timed its scoring step (`validateAuthoredRule`'s
  real engine dry-run + golden regression, genuine async local compute)
  together with the provider call, inflating its latency numbers relative
  to the other features (whose scoring is synchronous/near-instant). Fixed
  by splitting `runEvalLoop` into separate `call` (timed) and `score`
  (untimed) parameters — the same split now used by every eval file.

---

## 4. Methodology notes / gotchas for anyone re-running this

- **Typecheck with the real command.** `pnpm --filter @taweed/ai exec tsc
  --noEmit` (package-scoped) misses real errors that
  `pnpm exec tsc -p tsconfig.json --noEmit` (the repo's actual root config,
  what CI effectively checks) catches — confirmed live, not assumed (§3.4).
  Always use the root command.
- **A live eval run is the real verification.** A green typecheck + green
  unit suite is necessary but not sufficient — every fix in §3 was found
  because a live run against the real API surfaced a real crash or a
  suspiciously-total (0% or 100%) failure rate, which is itself a signal to
  investigate before trusting the number.
- **A 100% (or 0%) failure rate is a red flag, not a result.** Both real
  provider bugs in §3 first showed up as suspiciously total failure rates
  across an entire feature. A partial, non-round failure rate (like GLM's
  genuine 62.5% on `AppealVerify`) is much more likely to be real signal.
- **Claude's non-determinism.** Unlike Gemini/GLM (both hardcode
  `temperature:0` in their provider files), Claude's provider does not pin
  temperature — production code doesn't either, so this reflects real
  behavior, but it means Claude's eval numbers have more run-to-run variance
  than the other two providers' pinned-temperature numbers. Worth keeping in
  mind before treating any single Claude run as definitive.
- **Balance vs rate-limit vs transient vs schema-invalid.** `resilience.ts`
  classifies live-eval errors into 5 buckets with different handling (stop
  + exclude / stop + keep partial / skip + continue / score-as-miss +
  continue / rethrow). The balance-exhausted check runs BEFORE the
  rate-limit check deliberately — GLM's real balance-exhausted error is
  itself HTTP 429, structurally identical to a rate limit on status code
  alone; only the message text distinguishes them.

---

## 5. What's on each branch

| | `main` | `glm` | `gemini-trial` |
|---|---|---|---|
| Shared suite (`resilience.ts`, `scoringUtils.ts`, corpora, scoring modules) | ✅ (source of truth) | merged from `main` | merged from `main` |
| Claude-backed evals (all 4 features) | ✅ | inherited | inherited |
| `glm-1p.ts` (GLM provider) | — | ✅ | — |
| GLM-backed evals (all 4 features) | — | ✅ | — |
| `gemini-1p.ts` (Gemini provider) | — | — | ✅ |
| Gemini-backed evals (all 4 features) | — | — | ✅ |
| Pushed to origin? | ✅ | ❌ (local only) | ❌ (local only) |

To re-run any provider's suite: check out the relevant branch (or the
`/tmp/taweed-gemini-worktree` git worktree, if still present, for
`gemini-trial` without disturbing a `glm`-branch checkout), set
`AI_EVALS_LIVE=1` + the provider's API key + `DATABASE_URL`, then:

```bash
pnpm exec vitest run --project evals \
  packages/ai/evals/explainFlag.<variant>.eval.ts \
  packages/ai/evals/assistAppeal.<variant>.eval.ts \
  packages/ai/evals/authorRule.<variant>.eval.ts \
  packages/ai/evals/extractEob.<variant>.eval.ts
```

(omit `.<variant>` for the Claude baseline on any branch).

---

## 6. Related documents

- Obsidian vault (`Brain/Research/`): `taweed-gemini-provider-trial-eval-comparison.md`,
  `taweed-glm-provider-trial-eval-comparison.md`,
  `taweed-ai-eval-suite-4-feature-3-provider-comparison.md` — fuller
  narrative history of the AI-4-only trial (multiple tuning rounds, model
  escalations) that this document's §1.4 summarizes.
- `docs/review.md` — general Taweed testing guide + technical review
  (documents the Claude baseline this comparison is measured against).
- `packages/ai/evals/` — the eval suite itself; each `.eval.ts` file's
  header comment documents its own double-gate (`AI_EVALS_LIVE=1` + API key
  + `DATABASE_URL`) and scoring approach.
