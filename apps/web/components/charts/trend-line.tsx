"use client";
import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendPoint } from "@taweed/analytics";
import { formatMoney } from "@/lib/money";
import { CHART_COLORS as C } from "@/lib/chart-colors";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface TrendLineProps {
  points: TrendPoint[];
  /** id of the visible heading (e.g. the card's CardTitle) that names this chart. */
  titleId: string;
  /** Text alternative (WCAG 1.1.1): rendered visually hidden, adjacent to the chart. */
  summary: string;
}

// Trend over time (design-brief §6): at-risk area (rust) + recovered line
// (emerald). In RTL time still flows inline-start→end, but labels stay LTR.
export function TrendLine({ points, titleId, summary }: TrendLineProps) {
  const data = points.map((p) => ({
    period: p.period,
    denied: Number(p.deniedSar),
    recovered: Number(p.recoveredSar),
  }));
  const reduceMotion = useReducedMotion();

  return (
    <figure className="h-56 w-full" dir="ltr">
      {/* role=img + aria-labelledby give the chart an accessible name (the
       * card's own visible title) instead of the raw SVG exposing disconnected
       * axis-tick text nodes to screen readers. */}
      <div role="img" aria-labelledby={titleId} className="h-full w-full">
        <div aria-hidden="true" className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
              <defs>
                <linearGradient id="atRiskFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.atRisk} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={C.atRisk} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="period"
                tick={{ fontSize: 11, fill: C.axis }}
                tickLine={false}
                axisLine={{ stroke: C.hairline }}
              />
              <YAxis hide />
              <Tooltip
                cursor={{ stroke: "var(--hairline)" }}
                contentStyle={{
                  background: "var(--surface-1)",
                  border: "1px solid var(--hairline)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => `SAR ${formatMoney(v)}`}
              />
              <Area
                type="monotone"
                dataKey="denied"
                stroke={C.atRisk}
                strokeWidth={2}
                fill="url(#atRiskFill)"
                isAnimationActive={!reduceMotion}
              />
              <Line
                type="monotone"
                dataKey="recovered"
                stroke={C.recovered}
                strokeWidth={2}
                dot={false}
                isAnimationActive={!reduceMotion}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}
