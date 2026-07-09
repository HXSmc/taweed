// Shared log-minimization helper for the AI-4 EOB pipeline (plan 04 §9).
//
// Both halves of that pipeline — the extract action (eob-extract.ts) and the
// human-review approve/reject action (eob-review.ts) — send real
// (non-pseudonymized) PDF/claim content to a model or persist it via Postgres
// by design (docs/blocker.md BLK-AI-1): unlike AI-1/2/3, there is no PHI-free
// construction here. That means a caught `err` on either path is NOT safe to
// log verbatim: an Anthropic SDK/Zod error can echo request/response content
// into `.message`/`.stack`, and a Postgres constraint-violation message can
// include the offending claimId/patientRef/money value. Either would land in
// plaintext server logs instead of the hash-only `llm_calls` audit trail
// (packages/ai/src/run.ts) this system otherwise relies on for PHI
// minimization. Log only a stable, content-free error signal; never the
// error object itself.
export function describeErrorForLog(err: unknown): string {
  return err instanceof Error ? err.name : typeof err;
}
