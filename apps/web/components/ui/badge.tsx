import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Chips, code pills, status tags. 4px radius. Money tones use the -text tokens
// (AA at 14px), never the bright fill hues, and never color alone (§4.2).
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-label font-medium",
  {
    variants: {
      variant: {
        neutral: "bg-surface-2 text-muted",
        // `--accent` text on `--accent-subtle` is AA in light theme, but
        // `--accent-subtle` is retuned darker for `.dark` while `--accent`
        // itself is not (design-brief tokens, app/globals.css) — the pairing
        // drops to ~2.6:1 in dark theme. Swap to the solid accent fill (the
        // same bg-accent/text-accent-fg pairing already used for buttons and
        // the brand mark) once `.dark` is active, which keeps ~5.9:1 AA.
        accent: "bg-accent-subtle text-accent dark:bg-accent dark:text-accent-fg",
        atRisk: "bg-at-risk-bg text-at-risk-text",
        recovered: "bg-recovered-bg text-recovered-text",
        outline: "border border-hairline text-muted",
        // Contrast fix (WCAG AA finding, axe:color-contrast, /en/appeals
        // composer): `text-money-neutral` on `bg-surface-2` is ~4.33:1 in
        // light theme (and ~3.61:1 in dark) — both under the 4.5:1 normal-
        // text minimum. `text-muted` is the existing caption-text token and
        // clears AA in both themes (>=6.1:1); it is also the more accurate
        // token for a disclaimer label (this variant marks copy, not money).
        mock: "bg-surface-2 text-muted",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
