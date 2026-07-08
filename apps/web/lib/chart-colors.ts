// Recharts sets fill/stroke as SVG ATTRIBUTES, where CSS var() does not
// resolve — so chart series colors are hex literals, not token references.
// Money/accent hues are theme-invariant in app/globals.css; keep these values
// in sync with --accent/--at-risk/--recovered/--text-faint there (single
// place to update instead of one copy per chart file).
export const CHART_COLORS = {
  accent: "#2557e4",
  atRisk: "#c2410c",
  recovered: "#0e9f6e",
  neutral: "#64748b",
  axis: "#8a8a93",
  hairline: "#8a8a9366",
} as const;
