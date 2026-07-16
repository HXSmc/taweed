# Blockers — `BLK-*` registry & current status

> **What this file is:** the single place that tracks every external/human blocker the code and
> docs refer to by id (`BLK-1`, `BLK-AI-2`, …). `docs/review.md`, `docs/handoff.md`,
> `docs/04_agentic_retrofit_plan.md`, and `docs/AI_HARDEN_LOOP.md` all point here.
>
> **Not to be confused with `docs/deferred.md` (`DEF-*`):** a *blocker* is something we're waiting on
> someone else for (it prevents real-data operation); a *deferral* is something we've decided not to
> spend our own effort on yet (an optimization/feature parked by choice, with a revisit trigger).
>
> **Why it looked missing:** this file is listed in `.gitignore` (line 38, alongside
> `docs/NEXT_STEP_PROMPT.md` and `ECC_GUIDE.md`) and was historically kept **local-only**, so a
> fresh `git clone` never contained it — which is why references to `docs/blocker.md` appeared to
> dangle. This copy was reconstructed from the committed sources of truth: the AI blocker
> definitions in `docs/04_agentic_retrofit_plan.md §8` and the blocked-feature map in
> `docs/review.md §2.14`.
>
> **⚠️ This copy is force-added to git** (`git add -f`) so it survives an ephemeral checkout and
> reaches the branch. If you'd rather keep it local-only (the original convention — e.g. before you
> add any sensitive counsel/vendor detail), run `git rm --cached docs/blocker.md` and commit; the
> `.gitignore` entry is already in place, so it will then stay untracked. **Do not paste API keys,
> counsel names, contract terms, or any secret into a tracked copy of this file.**
>
> Status key: 🔴 open (blocks a real decision) · 🟡 partially cleared · 🟢 cleared / watch-only.
> Last updated **2026-07-16**.

---

## Status at a glance

| Blocker | What it is | Gates | Status (2026-07-16) |
|---|---|---|---|
| **BLK-AI-1** | KSA privacy counsel sign-off: pseudonymization posture (AI-2) + PDF route (AI-4) + SCC fallback | **real-PHI** LLM calls (not synthetic builds) | 🔴 open |
| **BLK-AI-2** | Anthropic org: commercial API from KSA + **ZDR** arrangement + **DPA** | any live LLM call | 🟡 partial — technical API key **added**; ZDR + DPA still open |
| **BLK-AI-3** | OCI Riyadh GPU quota + pricing (only if the self-host VLM route is chosen for AI-4) | AI-4 self-host route | 🔴 open (conditional) |
| **BLK-AI-4** | Watch: Claude in-region on Bedrock `me-central-2` (quarterly region-table check) | end-state in-region migration | 🟢 watch-only |
| **BLK-1** | A real design-partner clinic's data | the real recovered-SAR headline; normalizer missing-amount decision; real per-tenant dimensions; recovery baseline; `claimToFactsReal` dispatch | 🔴 open |
| **BLK-2** | Real NPHIES denial-reason codes + SBS/ICD-10-AM coding regime + per-payer deadline matrix | real denial codes, scrubber thresholds, appeal-deadline countdown | 🔴 open |
| **BLK-3 → 4 → 5** | NPHIES Academy vendor onboarding → PKI issuance → sandbox/conformance certification | live NPHIES submission + real-time eligibility (`packages/nphies-client`, not yet scaffolded) | 🔴 open |
| **BLK-6** | NPHIES IG bundling/redistribution rights (HL7 Saudi Arabia) | real IG/profile validation (`validateAgainstNphiesProfile()`) replacing the base-R4-only check | 🔴 open |
| **BLK-7** | KSA-resident, PDPL-compliant OIDC provider (not yet even chosen) | production login via a real IdP; real DB/session credential source | 🔴 open |
| **BLK-8** | Oracle Cloud Riyadh (`me-riyadh-1`) credentials | applied `infra/` Terraform; real KSA-region object store + KMS; secrets-manager-sourced creds | 🔴 open |
| **BLK-9** | KSA-RCM subject-matter-expert sign-off | real code taxonomy; Arabic appeal templates/glossary reaching a real clinic (**hard gate**); wordmark isolation | 🔴 open |

None of the above block the **synthetic-data product** — every feature is built and tested on
synthetic data. They gate **real-data operation**, **live NPHIES**, and **GA hosting**.

---

## AI blockers (source: `docs/04_agentic_retrofit_plan.md §8`)

### BLK-AI-1 — KSA privacy counsel sign-off 🔴 open
Counsel must sign off on the AI-2 pseudonymization posture, the **AI-4 PDF route** (a whole
remittance page goes to a vision model — see `review.md §2.6` for why AI-4 cannot be PHI-free by
construction), and the SCC fallback. **Gates real-PHI LLM calls only** — synthetic builds are
unaffected. Two concrete pre-enable checks live under this blocker:
- confirm `INFERENCE_GEO` / cross-border implications of flipping `TAWEED_AI_EXTRACT_EOB_ENABLED`
  on real documents;
- confirm `errorReport()` does not capture field-level extraction values
  (`apps/web/components/modules/eob-review/eob-extraction-form.tsx`).

**Until cleared:** no real patient/claim PDF may be uploaded to AI-4; the constraint is a policy
boundary, not a technical one — nothing in the UI physically stops a real upload, so don't.

### BLK-AI-2 — Anthropic org: commercial API + ZDR + DPA 🟡 partial
Three parts: (a) a commercial Anthropic API path usable from KSA, (b) a **Zero-Data-Retention**
arrangement, (c) a **Data Processing Agreement**.

- **✅ Technical key — ADDED (2026-07-16).** An `ANTHROPIC_API_KEY` is now configured, so live
  Anthropic calls actually execute. This unblocks, **for synthetic / PHI-free inputs only**:
  - the AI-4 live eval harness (`AI_EVALS_LIVE=1`, `packages/ai/evals/extractEob.eval.ts`) — it can
    now run a real scored pass against the synthetic corpus (rasterizer also built 2026-07-10);
  - live exercising of AI-1/2/3 and AI-4 locally on synthetic/deterministic-input data.
- **🔴 ZDR + DPA — STILL OPEN.** A plain API key is **not** a ZDR arrangement and **not** a DPA.
  Any call that could carry **real PHI** remains blocked by the ZDR + DPA parts of this blocker
  (and by BLK-AI-1). Do not read "key added" as "real documents are now allowed."

### BLK-AI-3 — OCI Riyadh GPU quota + pricing 🔴 open (conditional)
Only relevant **if** the self-hosted VLM route is chosen for AI-4 (zero-cross-border extraction,
no data leaving KSA). Gates `SelfHostedVlmAdapter`
(`packages/ai/src/adapters/selfhosted-vlm-adapter.ts`). Not on the critical path if the cloud
(Claude vision) route is chosen instead.

### BLK-AI-4 — Claude in-region on Bedrock `me-central-2` 🟢 watch-only
A standing quarterly check of the Bedrock region table; gates only the eventual in-region
end-state migration, nothing today.

---

## Real-data / NPHIES / infra blockers (source: `docs/review.md §2.14`, §2.10)

These are the `BLK-1..9` ids the code comments and the blocked-feature map reference. Full
market/GTM/compliance detail — and the human actions (calls, emails, counsel) that clear the
NPHIES/PDPL ones — lives in **`docs/HUMAN_CONFIRMATION_NEEDED.md`** (which uses its own A1/B1/C1
taxonomy; cross-referenced below).

- **BLK-1 — real partner data** 🔴 · unblocks the real recovered-SAR headline and flips
  `data_origin` `synthetic → production`. See HUMAN_CONFIRMATION A1/A2 (denial rate / denied SAR)
  and the free-audit motion.
- **BLK-2 — real NPHIES codes** 🔴 · real `DENIAL_REASON_CODES`, SBS/ICD-10-AM regime, per-payer
  deadline matrix. See HUMAN_CONFIRMATION B-series.
- **BLK-3 → BLK-4 → BLK-5 — NPHIES vendor onboarding → PKI → sandbox/conformance** 🔴 · the
  vendor-certification chain that unblocks live claim submission + eligibility
  (`packages/nphies-client`). See HUMAN_CONFIRMATION B1/B2 (Academy self-enrollment +
  `onboarding@chi.gov.sa`).
- **BLK-6 — IG bundling rights** 🔴 · real IG/profile validation. See HUMAN_CONFIRMATION F3.
- **BLK-7 — KSA-resident OIDC** 🔴 · production login; provider not yet chosen. See
  HUMAN_CONFIRMATION (C-series / hosting).
- **BLK-8 — Oracle Cloud Riyadh creds** 🔴 · applied infra + real object store/KMS. Note: the
  Riyadh region itself is confirmed LIVE (HUMAN_CONFIRMATION C3) — this blocker is the *account /
  credentials*, not region availability.
- **BLK-9 — KSA-RCM SME sign-off** 🔴 · **hard gate** on any Arabic appeal letter reaching a real
  clinic; also the real code taxonomy and Arabic wordmark isolation. See HUMAN_CONFIRMATION
  (SME / A3 study caveats).

---

## What "API key added" changed, precisely

| Now possible (synthetic / PHI-free) | Still blocked (real PHI) |
|---|---|
| `AI_EVALS_LIVE=1` scored eval run against the synthetic EOB corpus | Uploading a real EOB/claim PDF to AI-4 (BLK-AI-1 + ZDR/DPA of BLK-AI-2) |
| Live AI-1/2/3 on their PHI-free/pseudonymized inputs | Any live call carrying real PHI |
| Local live-path testing of all four AI features on synthetic data | Real recovered-SAR headline (BLK-1), live NPHIES (BLK-3/4/5), real Arabic letters (BLK-9) |

The eval thresholds (amounts ≥98%, overall ≥95%, `packages/ai/evals/scoring.ts`) are printed for
human comparison, **not** asserted by the harness — so a real scored run must still be **executed
and read** before those numbers count as proven. See `review.md §1.11` / §2.9.
