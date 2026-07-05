import { describe, it, expect } from "vitest";
import { checkRateLimit, type RateWindow } from "../src/rate-limit.js";

describe("checkRateLimit — fixed window", () => {
  it("allows the first request and opens a window", () => {
    const d = checkRateLimit(undefined, 1000, 3, 60_000);
    expect(d.allowed).toBe(true);
    expect(d.remaining).toBe(2);
    expect(d.next).toEqual({ count: 1, windowStart: 1000 });
  });

  it("counts up within the window and blocks past the limit", () => {
    let state: RateWindow | undefined;
    const now = 1000;
    const allowed: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const d = checkRateLimit(state, now, 3, 60_000);
      allowed.push(d.allowed);
      state = d.next;
    }
    expect(allowed).toEqual([true, true, true, false]); // 4th blocked
    const again = checkRateLimit(state, now, 3, 60_000);
    expect(again.allowed).toBe(false);
    expect(again.remaining).toBe(0);
  });

  it("resets once the window has elapsed", () => {
    const first = checkRateLimit(undefined, 1000, 1, 60_000);
    expect(first.allowed).toBe(true);
    const second = checkRateLimit(first.next, 2000, 1, 60_000);
    expect(second.allowed).toBe(false); // still in window, limit 1
    const later = checkRateLimit(first.next, 1000 + 60_000, 1, 60_000);
    expect(later.allowed).toBe(true); // window elapsed -> reset
    expect(later.next.windowStart).toBe(1000 + 60_000);
  });

  it("reports resetInMs decreasing within the window", () => {
    const first = checkRateLimit(undefined, 1000, 5, 10_000);
    const mid = checkRateLimit(first.next, 4000, 5, 10_000);
    expect(mid.resetInMs).toBe(7000); // 10000 - (4000 - 1000)
  });
});
