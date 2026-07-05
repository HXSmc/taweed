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

  const appealed = moneyToHalalas(input.appealedSar);
  // A win with no stated amount defaults to full recovery of the appealed sum.
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
      reason: "exceeds-appealed",
    };
  }
  return { recoveredSar: toSar(requested), corrected: false };
}
