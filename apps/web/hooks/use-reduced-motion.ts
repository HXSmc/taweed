"use client";
import * as React from "react";

// Shared reduced-motion gate (design-brief §4.5, §13). Mirrors the check in
// components/money/count-up.tsx, but as a hook so chart components (which
// animate via recharts/react-smooth's rAF-driven tweening, NOT CSS
// transitions/animations) can gate too — the blanket `prefers-reduced-motion`
// rule in app/globals.css only collapses CSS animation/transition durations,
// so it never reaches recharts' JS-driven draw-in.
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mql.matches);
    const handleChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  return reduced;
}
