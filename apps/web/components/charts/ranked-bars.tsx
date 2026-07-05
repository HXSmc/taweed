import { cn } from "@/lib/utils";
import { formatMoney, formatPct } from "@/lib/money";

// Ranked horizontal bars (design-brief §6): sorted descending, longest at
// inline-start, hairline rows. Money-neutral by default; at-risk tone tints the
// figure only (never color alone — the SAR value and rate label carry meaning).
// Pure CSS so it renders on the server and mirrors cleanly in RTL.
export interface RankedItem {
  key: string;
  label: string;
  rate: number;
  atRiskSar: string;
  denied: number;
  claims: number;
}

export function RankedBars({
  items,
  tone = "atRisk",
}: {
  items: RankedItem[];
  tone?: "atRisk" | "neutral";
}) {
  const max = Math.max(1, ...items.map((i) => Number(i.atRiskSar)));
  // Solid token colors: the `/opacity` modifier does not resolve on our
  // var()-based color tokens (renders transparent).
  const barColor = tone === "atRisk" ? "bg-at-risk" : "bg-money-neutral";
  const figColor = tone === "atRisk" ? "text-at-risk-text" : "text-text";

  return (
    <ul className="flex flex-col">
      {items.map((it) => {
        const pct = (Number(it.atRiskSar) / max) * 100;
        return (
          <li
            key={it.key}
            className="flex items-center gap-3 border-b border-hairline py-2.5 last:border-0"
          >
            <span className="w-32 shrink-0 truncate text-body font-medium" title={it.label}>
              {it.label}
            </span>
            <div className="relative h-5 flex-1 overflow-hidden rounded-sm bg-surface-2">
              <div
                className={cn("h-full rounded-sm", barColor)}
                style={{ width: `${Math.max(2, pct)}%` }}
              />
            </div>
            <span className={cn("w-24 shrink-0 text-end num text-body font-medium", figColor)}>
              {formatMoney(it.atRiskSar)}
            </span>
            <span className="w-14 shrink-0 text-end num text-label text-muted">
              {formatPct(it.rate)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
