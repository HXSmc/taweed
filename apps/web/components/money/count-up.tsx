"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

// The signature motion (design-brief §4.5). Counts up ONCE on first paint into
// view. Value eased via requestAnimationFrame, formatted each frame with grouped
// Western digits, tabular. Reduced-motion snaps to the final value instantly.
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
  const started = React.useRef(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const run = () => {
      if (started.current) return;
      started.current = true;
      if (reduce) {
        setDisplay(value);
        onSettle?.();
        return;
      }
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        setDisplay(value * easeOutExpo(t));
        if (t < 1) requestAnimationFrame(tick);
        else onSettle?.();
      };
      requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          run();
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value, durationMs, onSettle]);

  return (
    <span ref={ref} className={cn("num", className)}>
      {format(display)}
    </span>
  );
}
