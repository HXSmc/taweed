import { describe, it, expect } from "vitest";
import { createRequestGuard } from "../lib/request-guard";

// Regression coverage for AppealsComposer.select(): rapid clicks between two
// denial rows must not let an earlier row's async loadAppealDraft resolve
// after a later click and overwrite the newer selection's draft/bodies.

describe("createRequestGuard", () => {
  it("treats the first issued token as current before any other issue", () => {
    // Arrange
    const guard = createRequestGuard();

    // Act
    const tokenA = guard.issue();

    // Assert
    expect(guard.isCurrent(tokenA)).toBe(true);
  });

  it("marks an earlier token stale once a newer one is issued", () => {
    // Arrange — reviewer clicks Payer A's denial, then Payer B's before A resolves.
    const guard = createRequestGuard();
    const tokenA = guard.issue();

    // Act
    const tokenB = guard.issue();

    // Assert — A's in-flight response must be dropped; only B's should apply.
    expect(guard.isCurrent(tokenA)).toBe(false);
    expect(guard.isCurrent(tokenB)).toBe(true);
  });

  it("stays current for the latest token even if an older request resolves later", () => {
    // Arrange — simulate A's slower DB read resolving AFTER B's faster one.
    const guard = createRequestGuard();
    const tokenA = guard.issue();
    const tokenB = guard.issue();

    // Act — B's callback runs first (fast), then A's stale callback runs (slow).
    const bAppliesResult = guard.isCurrent(tokenB);
    const aAppliesResult = guard.isCurrent(tokenA);

    // Assert
    expect(bAppliesResult).toBe(true);
    expect(aAppliesResult).toBe(false);
  });
});
