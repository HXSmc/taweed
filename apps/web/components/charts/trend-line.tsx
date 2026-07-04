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

// Trend over time (design-brief §6): at-risk area (rust) + recovered line
// (emerald). In RTL time still flows inline-start→end, but labels stay LTR.
export function TrendLine({ points }: { points: TrendPoint[] }) {
  const data = points.map((p) => ({
    period: p.period,
    denied: Number(p.deniedSar),
    recovered: Number(p.recoveredSar),
  }));

  return (
    <div className="h-56 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
          <defs>
            <linearGradient id="atRiskFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--at-risk)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--at-risk)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="period"
            tick={{ fontSize: 11, fill: "var(--text-faint)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--hairline)" }}
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
            stroke="var(--at-risk)"
            strokeWidth={2}
            fill="url(#atRiskFill)"
          />
          <Line
            type="monotone"
            dataKey="recovered"
            stroke="var(--recovered)"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
