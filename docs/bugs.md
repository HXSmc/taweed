# Bug Hunt — Taweed

> Full-codebase bug hunt, 2026-07-08. Scope: `packages/*` + `apps/web` (`.md` files excluded from
> the scan per instruction). Method: 6 parallel finder agents by area → each candidate adversarially
> verified (2 independent skeptics, default-to-refute) → every CONFIRMED bug fixed with a
> RED→GREEN regression test. 22 candidates found, 21 confirmed, 1 refuted (noted at the bottom).
>
> Final verification after all fixes: root+web typecheck clean, lint 0 errors, **unit 483/483**,
> **integration 37/37**, `apps/web` production build green.

## Critical

### 1. `apps/web/components/modules/appeals-composer.tsx:71` — stale-response race in denial selection
No guard against out-of-order async resolution: clicking Payer A then quickly Payer B, if A's
`loadAppealDraft` resolves *after* B's, clobbers the visible letter with A's data while the queue
still highlights B — a reviewer could export a mismatched appeal letter under the wrong denial's
audit trail.
**Fix:** new `apps/web/lib/request-guard.ts` (`createRequestGuard()` — issue/isCurrent token
tracking). `select()` now drops a response if a newer selection has since been issued.
**Test:** `apps/web/test/request-guard.test.ts` (3 cases, including the exact A-resolves-after-B race).

## High

### 2. `packages/rules-engine/src/project.ts:62` — `lineUnitsOf()` overwrites instead of summing units
Multiple claim lines sharing one SBS code had their `qty` overwritten (last-write-wins) instead of
summed, silently under-counting real billed units and letting genuinely over-threshold
quantity/preauth rules fail to fire.
**Fix:** `units[code] = (units[code] ?? 0) + l.qty`.
**Test:** `packages/rules-engine/test/project.test.ts` — 3 same-code lines now correctly sum to 12.

### 3. `packages/normalizer/src/normalize.ts:191` — missing ClaimResponse amount folds to `"0.00"` (BLK-1)
The exact issue flagged in `docs/review.md`'s known-issues list — a missing adjudication amount
silently became `denied_amount: "0.00"` instead of quarantining, understating at-risk money, and
`ingest.ts`'s amount guard never inspected `claimResponse` to catch it.
**Fix:** `explodeDenials()` now throws when `adj.amount?.value` is missing on a denial-reason line;
`ingest.ts`'s existing generic try/catch around `normalize()` quarantines it (no ingest.ts change needed).
**Test:** `packages/normalizer/test/normalize.test.ts` new throw-case.

### 4. `apps/web/lib/actions/appeals.ts:11` — `read` capability leaks the full PHI appeal letter
`loadAppealDraft`'s allow-list included `"read"`, so an admin (read-only by design) got the complete
bilingual PDF payload (member id, payer, provider, denial detail) with **zero audit trail** —
`recordAppealExport` correctly excludes `read`, but the content was already in the admin's hands by
the time export-gating would matter.
**Fix:** dropped `"read"` from `loadAppealDraft`'s `authorizeAction` allow-list to match `recordAppealExport` exactly.
**Test:** `apps/web/test/appeals.test.ts` (new, 4 cases, exercises the real RBAC matrix, not a stub).

### 5. `apps/web/components/modules/eob-review-queue.tsx:54` — approve/reject can discard the wrong row
`approve()`/`reject()` unconditionally cleared `selectedId` on success with no check that the
reviewer was still on that row — a slow background approve for row1 could silently close row2's
review form the reviewer had since switched to, discarding in-progress edits.
**Fix:** `setSelectedId((prev) => (prev === rowId ? null : prev))`.
**Test:** `apps/web/test/eob-review-queue.test.tsx` (new — added after the workflow's fix-agent for
this file stalled mid-run on a transient API error; the code fix had already landed correctly, only
the test was missing. Verified RED→GREEN against the actual pre-fix code before restoring.)

### 6. `apps/web/components/modules/rule-authoring.tsx:106` — unhandled rejection sticks a rule row forever
`draft()`/`decide()` awaited server actions inside `start(async () => ...)` with no try/catch — an
RPC-level rejection (not a resolved `{ok:false}`) skipped `setActing(null)`, leaving that row's
Approve/Reject buttons permanently disabled with a stuck spinner.
**Fix:** extracted `apps/web/lib/rule-decide.ts` (`resolveDecideOutcome`/`resolveDraftOutcome`) —
always resolves, never rejects, following the same pattern used for the Ingest panel fix (#7).
**Test:** `apps/web/test/rule-decide.test.ts` (5 cases).

## Medium

### 7. `apps/web/components/modules/ingest-panel.tsx:76` — unhandled rejection sticks the ingest ledger
Same failure class as #6: a rejected server-action promise skipped `setState`, leaving the run
ledger stuck on "parsing" forever with no error shown, no recovery except a page reload.
**Fix:** extracted `apps/web/lib/ingest-submit.ts` (`resolveUploadState`) — always resolves.
**Test:** `apps/web/test/ingest-submit.test.ts` (4 cases).

### 8. `packages/ai/src/adapters/claude-vision-ocr.ts:191` — Opus double-fault discards the real validator findings
When Sonnet's output failed validation and the Opus retry then *also* threw, the returned
`validatorReport` was replaced entirely by the Opus error — the reviewer saw only "Opus request
failed" with no hint that the actual defect was a line-total arithmetic mismatch in the data they
were looking at.
**Fix:** hoisted `sonnetReport` out of its block scope; the double-fault path now merges the original
Sonnet findings with the Opus error finding instead of discarding them.
**Test:** extended the existing double-fault case in `packages/ai/test/claude-vision-ocr.test.ts`.

### 9. `packages/ai/src/adapters/claude-vision-ocr.ts:131` — unclamped model-emitted confidence
`deriveConfidence` passed the model's raw `overallConfidence` straight through with no `[0,1]`
clamp (the schema comment explicitly says this is the caller's responsibility) — inconsistent with
`assistAppeal.ts`'s `clamp0to100`, and a runaway value (e.g. `1.7`) would corrupt any downstream
percentage/threshold logic.
**Fix:** new `clamp0to1` helper, applied on both the passing- and failing-report branches.
**Test:** new case asserting `overallConfidence: 1.7` clamps into `[0, 1]`.

### 10. `packages/rules-engine/src/scrub.ts:48` — `unevaluableRuleIds()` ignores AND/OR structure
Flattened the whole condition tree and marked a rule unevaluable if *any* referenced fact was null,
regardless of `all`/`any` grouping — an authored `any` (OR) rule with one known-true branch and one
null branch was wrongly suppressed instead of firing on the resolvable branch. Live for any
AI-3-authored rule using `any`; no shipped rule uses it yet.
**Fix:** replaced the flat fact-collector with a proper three-valued (`true`/`false`/`unknown`) tree
evaluator that short-circuits `all`/`any` correctly.
**Test:** `packages/rules-engine/test/scrub.test.ts` — 3 new cases (fires via known-false OR branch,
stays unevaluable when both branches unknown, stays unevaluable when known branch is non-satisfying).

### 11. `packages/normalizer/src/normalize.ts:126` — missing `unitPrice` folds to `"0.00"`
Same anti-pattern as #3 for a different field: a `Claim.item` with `net` but no `unitPrice` silently
became `unit_price: "0.00"` instead of being quarantined.
**Fix:** throws when `item.unitPrice?.value` is missing; caught by ingest.ts's existing quarantine path.
**Test:** new case in `normalize.test.ts`.

### 12. `packages/normalizer/src/normalize.ts:130` — duplicate `item.sequence` misattributes a denial
Two `Claim.item`s sharing one `sequence` collided in `lineByNumber`; a denial referencing that
sequence got attached to the wrong physical line, corrupting per-line denial/appeal attribution.
**Fix:** throws on a duplicate sequence instead of silently overwriting.
**Test:** new case in `normalize.test.ts`.

### 13. `packages/fhir/src/parse.ts:51` — duplicate `Claim.id` silently drops the earlier claim
Two Bundle entries sharing one `Claim.id`/`fullUrl` overwrote each other in `claimsByKey` with zero
issue reported — a claim silently vanishes from a batch with no diagnostic.
**Fix:** `addClaimKey` helper now pushes an explicit issue and keeps the first occurrence.
**Test:** new case in `parse.test.ts`.

### 14. `packages/ingest/src/csv.ts:123` — over-long CSV row truncates and shifts fields
An unescaped delimiter inside a should-have-been-quoted field produced more cells than headers;
`parseDelimited()` silently dropped the trailing cell and shifted the rest under the wrong header
(e.g. an amount column corrupted into a text fragment) with no diagnostic.
**Fix:** throws a descriptive error naming the line and the column-count mismatch.
**Test:** new case in `csv.test.ts` using the exact unquoted-comma scenario.

### 15. `packages/analytics/src/recovery.ts:46` — recovery ceiling doesn't account for sibling appeals
`resolveRecovery`'s ceiling was recomputed from the denial's raw `denied_amount` with no knowledge
of amounts already recovered by other appeals on the same `denial_id` — a second won appeal on a
denial could recover the full amount again, double-booking recovered SAR and breaking the
`at_risk + recovered == total denied` invariant. Latent today (no code path creates a second appeal
per denial), live the moment a resubmission/re-appeal feature is added.
**Fix (2 parts):**
- `packages/analytics/src/recovery.ts`: new optional `alreadyRecoveredSar` input; ceiling becomes
  `max(0, appealed - alreadyRecovered)`.
- **The workflow's fix agent stopped at the pure resolver and left the call site unwired** (an
  honestly-flagged scope note in its own report). Closed that gap directly: `apps/web/lib/actions/
  recovery.ts`'s `markAppealOutcome` now queries `SUM(recovered_amount)` across sibling `won`
  appeals on the same `denial_id` (excluding the appeal being updated) and passes it through.
**Test:** `packages/analytics/test/recovery.test.ts` — 3 new cases (full ceiling consumed by a
sibling, partial remainder, operator-stated amount clamped against the *remaining* ceiling).
`apps/web/lib/actions/recovery.ts`'s wiring is typecheck-verified only — no DB integration test
covers this call site yet (`apps/web` has no `*.int.test.ts` precedent); tracked as a follow-up.

### 16. `packages/platform/src/kms.ts:29` — `DevPassthroughKms` has no production guard
A trivially-breakable single-byte-XOR cipher fully satisfied the `TenantKms` interface with no
runtime/type marker distinguishing it from a real implementation — unlike `auth.ts`'s dev
Credentials provider, which explicitly gates behind `IS_PROD`/`TAWEED_ENABLE_DEV_AUTH`. Zero
callers exist today, but nothing would stop a future default wiring from shipping fake encryption
to production.
**Fix:** constructor now throws in production unless `TAWEED_ENABLE_DEV_KMS=1`, mirroring `auth.ts`'s pattern.
**Test:** `packages/platform/test/kms.test.ts` — 3 new cases.
**Noted, not fixed (out of scope for this bug):** `InMemoryObjectStore` has the identical
unguarded-default risk for the object store (plaintext PHI-adjacent bytes, no gate, no persistence).

### 17. `apps/web/lib/eob-to-normalized.ts:97` — rejected money with no denial code vanishes from analytics
A claim line with `rejectedHalalas > 0` but a null/unrecognized `denialCode` produced zero denial
rows — the money became invisible to at-risk analytics and the appeals pipeline, while the claim
outcome still showed "partial."
**Fix:** a denial row is now written whenever `rejectedHalalas > 0` **or** a known code is present;
falls back to `reason_code: "UNKNOWN"` when there's genuinely no recognized code.
**Test:** `apps/web/test/eob-to-normalized.test.ts` (3 cases).

## Low

### 18. `packages/ai/src/provider.ts:74` — `capabilities.batches` documented as a gate, enforces nothing
The doc comments on both `provider.ts` and `anthropic-1p.ts` claimed this field "gates Batches off"
for PHI-adjacent calls; nothing in the codebase ever reads it, and the live provider set it to
`true` — the opposite of the safety posture the comments claimed. No live exploit (no code path
issues a Batches request today), but a future contributor trusting the comment would find no actual
enforcement.
**Fix:** `anthropic-1p.ts` now sets `batches: false` (fail-closed, matches every other provider in
the repo); both doc comments corrected to state this is a *declaration*, not an enforced gate.
**Test:** new case in `anthropic-1p.test.ts` asserting `capabilities` equals `{batches:false,files:true}`.

### 19. `packages/ai/src/adapters/claude-vision-ocr.ts:78` — empty-string text layer isn't treated as "no text layer"
`runValidation` distinguished `undefined` from `""` by strict equality; the current sole caller is
careful to always pass `undefined`, but the public seam is typed `string | undefined` and a future
caller passing `""` (a natural mistake) would force every extraction into spurious validator
failures and an unnecessary Opus escalation.
**Fix:** changed the guard from `=== undefined` to `!textLayer`.
**Test:** new case with `textLayer: ""`.

### 20. `apps/web/lib/actions/appeals.ts:14` — an audit-write hiccup masks a successful fetch
`loadAppealDraft` wrapped the PHI-access audit write in the same try/catch as the actual data
fetch, so a transient audit-log failure discarded an already-successful draft fetch — inconsistent
with every other action's established "audit failures never lose the work" pattern.
**Fix:** split into two try/catches; the audit write's failure is now swallowed on its own.
**Test:** covered by the same `appeals.test.ts` added for #4 (case 3).

### 21. `apps/web/components/modules/eob-review/eob-extraction-form.tsx:151` — reseed effect keyed on object identity
A `useEffect` keyed on the `extraction` object *reference* (not a stable row id) would silently wipe
a reviewer's in-progress edits on any same-row re-render that produced a fresh-but-equal object —
latent today (the parent always remounts via `key={selected.id}` on a real selection change) but a
footgun for any future revalidation-while-open feature.
**Fix:** removed the redundant effect entirely; the existing lazy `useState` initializer already
handles genuine remounts correctly.
**Test:** `apps/web/test/eob-extraction-form.test.tsx` (rerenders the same mounted instance with a
deep-equal-but-different-reference object, asserts the edit survives).

## Considered, not confirmed

- **`packages/rules-engine/src/project.ts:88`** — a null `submitted_at` collapsing to `serviceDate: ""`
  instead of staying null. Refuted: `serviceDate` is excluded from `AUTHORABLE_FACT_KEYS`
  (`registry.ts`), so no rule — shipped or authored — reads it today; the anti-pattern is real but
  fully dormant. Worth revisiting if `serviceDate` is ever added to the authorable fact set.

## Follow-ups not fixed in this pass (tracked, not forgotten)

- `packages/platform/src/object-store.ts`'s `InMemoryObjectStore` needs the same production guard as
  `DevPassthroughKms` (#16) — same risk shape, explicitly out of that fix's scope.
- `apps/web/lib/actions/recovery.ts`'s sibling-aware ceiling wiring (#15) has no DB integration test —
  `apps/web` has no `*.int.test.ts` precedent yet; the pure resolver logic is fully covered.
