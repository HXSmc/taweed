// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

// Regression coverage for a CONFIRMED WCAG finding: recharts-based charts
// (TrendLine, Pareto) animated on mount/update regardless of the OS
// `prefers-reduced-motion` setting, unlike components/money/count-up.tsx
// which gates correctly. useReducedMotion() is the shared hook both charts
// now call — this test locks its contract: initial read + live updates.

type Listener = (event: MediaQueryListEvent) => void;

function mockMatchMedia(initialMatches: boolean) {
  let listener: Listener | null = null;
  const mql = {
    matches: initialMatches,
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: vi.fn((_event: string, cb: Listener) => {
      listener = cb;
    }),
    removeEventListener: vi.fn(),
  };
  window.matchMedia = vi.fn().mockReturnValue(mql);
  return {
    fireChange: (matches: boolean) => {
      mql.matches = matches;
      act(() => {
        listener?.({ matches } as MediaQueryListEvent);
      });
    },
    mql,
  };
}

describe("useReducedMotion", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("reflects prefers-reduced-motion: reduce being active on mount", () => {
    // Arrange
    mockMatchMedia(true);

    // Act
    const { result } = renderHook(() => useReducedMotion());

    // Assert
    expect(result.current).toBe(true);
  });

  it("reflects prefers-reduced-motion: reduce being inactive on mount", () => {
    // Arrange
    mockMatchMedia(false);

    // Act
    const { result } = renderHook(() => useReducedMotion());

    // Assert
    expect(result.current).toBe(false);
  });

  it("updates live when the OS preference changes after mount", () => {
    // Arrange
    const { fireChange } = mockMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    // Act: user flips "reduce motion" on at the OS level without reloading.
    fireChange(true);

    // Assert
    expect(result.current).toBe(true);
  });

  it("cleans up its media query listener on unmount", () => {
    // Arrange
    const { mql } = mockMatchMedia(false);
    const { unmount } = renderHook(() => useReducedMotion());

    // Act
    unmount();

    // Assert
    expect(mql.removeEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
  });
});
