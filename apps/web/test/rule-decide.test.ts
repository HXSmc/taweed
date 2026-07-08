import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression coverage for the bug where RuleAuthoring's draft()/decide() ran
// their server-action calls inside `start(async () => ...)` with no
// try/catch, unlike eob-review-queue.tsx's approve/reject guard. A
// thrown/rejected promise (the RPC layer itself rejecting — a network drop
// mid-request, connection reset, or serialization failure — rather than
// resolving to {ok:false, error}) became an unhandled rejection and skipped
// the state update that would clear the loading affordance: for decide(),
// `setActing(null)` was never reached, so `disabled={pending && acting ===
// r.id}` kept that row's Approve/Reject buttons spinning and disabled
// forever. resolveDecideOutcome/resolveDraftOutcome are the extracted,
// catch-guarded logic draft()/decide() now delegate to — they must always
// resolve, never reject.
vi.mock("@/lib/actions/author-rule", () => ({
  draftRuleAction: vi.fn(),
}));

import { draftRuleAction } from "@/lib/actions/author-rule";
import { resolveDecideOutcome, resolveDraftOutcome } from "../lib/rule-decide";

const mockedDraftRuleAction = vi.mocked(draftRuleAction);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveDecideOutcome — a rejected approve/reject RPC must still resolve", () => {
  it("returns a failed outcome when the server action's promise rejects", async () => {
    // Arrange: the RPC layer itself rejects (e.g. a network drop mid-request),
    // never resolving to {ok:false, error}.
    const fn = vi.fn().mockRejectedValue(new Error("connection reset"));

    // Act
    const outcome = await resolveDecideOutcome(fn, "row-1");

    // Assert: resolves (never throws), so the caller can still clear its
    // loading/acting state and surface an error — the row is never stuck.
    expect(outcome.ok).toBe(false);
    expect(fn).toHaveBeenCalledWith("row-1");
  });

  it("passes through a successful {ok:true} result unchanged", async () => {
    // Arrange
    const fn = vi.fn().mockResolvedValue({ ok: true });

    // Act
    const outcome = await resolveDecideOutcome(fn, "row-1");

    // Assert
    expect(outcome).toEqual({ ok: true });
  });

  it("passes through a clean {ok:false} gate-block result unchanged", async () => {
    // Arrange: a re-gate block (the approved library changed since drafting)
    // — a non-throwing failure that must keep its stage + reasons.
    const gate = { ok: false, stage: "golden" as const, errors: ["regressed case X"] };
    const fn = vi.fn().mockResolvedValue({ ok: false, gate, error: "gate_blocked" });

    // Act
    const outcome = await resolveDecideOutcome(fn, "row-1");

    // Assert
    expect(outcome).toEqual({ ok: false, gate, error: "gate_blocked" });
  });
});

describe("resolveDraftOutcome — a rejected draft RPC must still resolve", () => {
  it("returns a failed DraftRuleResult when draftRuleAction's promise rejects", async () => {
    // Arrange
    mockedDraftRuleAction.mockRejectedValue(new Error("transient network failure"));

    // Act
    const result = await resolveDraftOutcome("Flag claims over SAR 1000.", "global", undefined);

    // Assert
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("passes through a successful draft result unchanged", async () => {
    // Arrange
    const ok = { ok: true as const, rowId: "row-9", gate: { ok: true } };
    mockedDraftRuleAction.mockResolvedValue(ok);

    // Act
    const result = await resolveDraftOutcome("Flag claims over SAR 1000.", "global", undefined);

    // Assert
    expect(result).toEqual(ok);
  });
});
