"use client";
import {
  Bar,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReasonRow } from "@taweed/analytics";
import { formatMoney } from "@/lib/money";
import { CHART_COLORS as C } from "@/lib/chart-colors";

// Denial-reason Pareto (design-brief §6): money-neutral bars + cobalt cumulative
// line to prove "a few reasons drive most of the loss". Value labels LTR.
export function Pareto({ rows }: { rows: ReasonRow[] }) {
  const data = rows.slice(0, 8).map((r) => ({
    code: r.code.replace("TWD-", ""),
    sar: Number(r.sar),
    cumulative: Math.round(r.cumulativePct),
  }));

  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
          <XAxis
            dataKey="code"
            tick={{ fontSize: 11, fill: C.axis }}
            tickLine={false}
            axisLine={{ stroke: C.hairline }}
          />
          <YAxis hide yAxisId="left" />
          <YAxis hide yAxisId="right" orientation="right" domain={[0, 100]} />
          <Tooltip
            cursor={{ fill: "#8a8a9322" }}
            contentStyle={{
              background: "var(--surface-1)",
              border: "1px solid var(--hairline)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v: number, name: string) =>
              name === "cumulative" ? `${v}%` : `SAR ${formatMoney(v)}`
            }
          />
          <Bar yAxisId="left" dataKey="sar" fill={C.neutral} radius={[3, 3, 0, 0]} />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="cumulative"
            stroke={C.accent}
            strokeWidth={2}
            dot={{ r: 2, fill: C.accent }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
