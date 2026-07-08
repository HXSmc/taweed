import { moneyToHalalas, toSar } from "./money.js";

// EXECUTE B8 — recovery integrity (build-plan §11, design-brief §8.5). Recovered
// SAR is attributed conservatively: a win never records more than was appealed,
// and never a negative amount. This pure resolver is the single source of truth
// the recovery server action wraps, so the guardrail cannot be bypassed at the
// call site. All math is in integer halalas — no float touches a SAR figure.

export type AppealOutcome = "won" | "lost" | "submitted";

export interface RecoveryResolution {
  /** Recovered SAR to persist. null unless the appeal is won. */
  recoveredSar: string | null;
  /** True when the requested amount was clamped to a valid range. */
  corrected: boolean;
  /** Why it was corrected, so the UI can show an inline correction (§8.5). */
  reason?: "exceeds-appealed" | "negative";
}

export interface ResolveRecoveryInput {
  outcome: AppealOutcome;
  /** The appealed (denied) amount — the ceiling for any recovery. */
  appealedSar: string;
  /** Operator-stated recovered amount. Omitted → full recovery (the ceiling). */
  requestedRecoveredSar?: string | null;
  /**
   * SAR already recovered by sibling won appeals on the same denial_id, if
   * any exist. The remaining ceiling for THIS appeal is appealedSar minus
   * this amount — without it, a denial with more than one appeal (e.g. a
   * resubmission) could have its full denied amount recovered more than
   * once. Omitted → treated as 0 (single-appeal-per-denial case, unchanged
   * behavior).
   */
  alreadyRecoveredSar?: string | null;
}

/**
 * Resolve the recovered amount for an appeal outcome, enforcing the
 * recovered-cannot-exceed-appealed guardrail and non-negativity. Only a won
 * appeal recovers money; lost/submitted recover nothing.
 */
export function resolveRecovery(
  input: ResolveRecoveryInput,
): RecoveryResolution {
  if (input.outcome !== "won") {
    return { recoveredSar: null, corrected: false };
  }

  // Floor the ceiling at zero so a bad upstream (negative) appealed amount can
  // never leak a negative recovered figure, independent of DB/CSV data quality.
  const rawAppealed = moneyToHalalas(input.appealedSar);
  const ceilingCorrected = rawAppealed < 0;
  // Sibling appeals on the same denial may have already recovered part of the
  // denied amount — the ceiling for THIS appeal is what's left, never less
  // than zero, so the total recovered across all appeals on a denial can
  // never exceed the denied amount.
  const rawAlreadyRecovered =
    input.alreadyRecoveredSar == null
      ? 0
      : moneyToHalalas(input.alreadyRecoveredSar);
  const alreadyRecovered = Math.max(0, rawAlreadyRecovered);
  const appealed = Math.max(0, Math.max(0, rawAppealed) - alreadyRecovered);
  // A win with no stated amount defaults to full recovery of the remaining ceiling.
  const requested =
    input.requestedRecoveredSar == null
      ? appealed
      : moneyToHalalas(input.requestedRecoveredSar);

  if (requested < 0) {
    return { recoveredSar: toSar(0), corrected: true, reason: "negative" };
  }
  if (requested > appealed) {
    return {
      recoveredSar: toSar(appealed),
      corrected: true,
      reason: ceilingCorrected ? "negative" : "exceeds-appealed",
    };
  }
  return { recoveredSar: toSar(requested), corrected: ceilingCorrected };
}

// EXECUTE B7 — recovered-outcome feedback loop (design-brief §10 flywheel). As
// appeals resolve, learn which payer+reason combos actually recover so the
// scrubber/appeal queue can prioritize the winnable ones. Pure aggregation over
// resolved outcomes; a DB-backed version lives in queries.ts (recoverability).

export interface AppealOutcomeFact {
  payerId: string;
  reasonCode: string;
  status: string; // "won" | "lost" | "submitted" | ...
}

export interface RecoverabilityRow {
  payerId: string;
  reasonCode: string;
  won: number;
  resolved: number; // won + lost (in-flight appeals are not yet informative)
  recoveryRate: number; // won / resolved, 0 when nothing has resolved
}

export function recoverabilityByPayerReason(
  outcomes: AppealOutcomeFact[],
): RecoverabilityRow[] {
  const acc = new Map<
    string,
    { payerId: string; reasonCode: string; won: number; resolved: number }
  >();
  for (const o of outcomes) {
    if (o.status !== "won" && o.status !== "lost") continue; // ignore in-flight
    // Tab-separated key: neither a UUID-like payerId nor a code contains a tab.
    const key = `${o.payerId}\t${o.reasonCode}`;
    const cur = acc.get(key) ?? {
      payerId: o.payerId,
      reasonCode: o.reasonCode,
      won: 0,
      resolved: 0,
    };
    cur.resolved += 1;
    if (o.status === "won") cur.won += 1;
    acc.set(key, cur);
  }
  return [...acc.values()]
    .map((r) => ({
      ...r,
      recoveryRate: r.resolved > 0 ? r.won / r.resolved : 0,
    }))
    .sort(
      (a, b) =>
        b.recoveryRate - a.recoveryRate ||
        b.resolved - a.resolved ||
        a.payerId.localeCompare(b.payerId) ||
        a.reasonCode.localeCompare(b.reasonCode),
    );
}
