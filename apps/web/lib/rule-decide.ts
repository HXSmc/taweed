import {
  draftRuleAction,
  type DraftRuleResult,
} from "@/lib/actions/author-rule";

export type DecideFn = (id: string) => Promise<{
  ok: boolean;
  gate?: { ok: boolean; stage?: string; errors?: string[] };
  error?: string;
}>;

export type DecideOutcome =
  | { ok: true }
  | {
      ok: false;
      gate?: { ok: boolean; stage?: string; errors?: string[] };
      error?: string;
    };

// A rejected server-action promise for approve/reject (the RPC layer itself
// throwing — a network drop mid-request, a connection reset, a serialization
// failure — rather than resolving to {ok:false, error}) must still resolve to
// a displayable DecideOutcome. Without this guard, the caller's
// setActing(null) is skipped entirely and a row's Approve/Reject buttons stay
// disabled with a stuck spinner forever (see rule-decide.test.ts).
export async function resolveDecideOutcome(
  fn: DecideFn,
  rowId: string,
): Promise<DecideOutcome> {
  try {
    const r = await fn(rowId);
    return r.ok ? { ok: true } : { ok: false, gate: r.gate, error: r.error };
  } catch {
    return { ok: false, error: "failed" };
  }
}

// Same guard for the draft composer: a rejected draftRuleAction promise must
// still resolve to a displayable DraftRuleResult, never an unhandled
// rejection that skips setResult entirely.
export async function resolveDraftOutcome(
  smeText: string,
  scope: "global" | "payer",
  payerId: string | undefined,
): Promise<DraftRuleResult> {
  try {
    return await draftRuleAction(smeText, scope, payerId);
  } catch {
    return { ok: false, error: "generation" };
  }
}
