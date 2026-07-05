"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

// The signature motion (design-brief §4.5). Counts up on first paint into view,
// and RE-animates whenever `value` changes (e.g. after a recovery win revalidates
// the layout, or ingest counters resolve) — from the current displayed value to
// the new one. Reduced-motion snaps to the final value instantly.
interface CountUpProps {
  value: number;
  durationMs?: number;
  className?: string;
  /** Fires once at settle (e.g. brightness tick on recovered). */
  onSettle?: () => void;
}

const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

function format(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    Math.round(n),
  );
}

export function CountUp({
  value,
  durationMs = 1000,
  className,
  onSettle,
}: CountUpProps) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = React.useState(0);
  const displayRef = React.useRef(0); // latest shown value (survives closures)
  const revealedRef = React.useRef(false);
  const rafRef = React.useRef<number | null>(null);
  const settleRef = React.useRef(onSettle);
  settleRef.current = onSettle;

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const set = (v: number) => {
      displayRef.current = v;
      setDisplay(v);
    };

    const animate = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const from = displayRef.current;
      if (reduce || from === value) {
        set(value);
        settleRef.current?.();
        return;
      }
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        set(from + (value - from) * easeOutExpo(t));
        if (t < 1) rafRef.current = requestAnimationFrame(tick);
        else settleRef.current?.();
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    if (revealedRef.current) {
      // Already in view once: animate immediately from current → new value.
      animate();
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          revealedRef.current = true;
          io.disconnect();
          animate();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, durationMs]);

  return (
    <span ref={ref} className={cn("num", className)}>
      {format(display)}
    </span>
  );
}
