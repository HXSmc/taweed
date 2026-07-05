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
        accent: "bg-accent-subtle text-accent",
        atRisk: "bg-at-risk-bg text-at-risk-text",
        recovered: "bg-recovered-bg text-recovered-text",
        outline: "border border-hairline text-muted",
        mock: "bg-surface-2 text-money-neutral",
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
