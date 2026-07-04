import { cn } from "@/lib/utils";

// Every loading state is a skeleton shaped to the real layout, not a spinner
// (design-brief §8, §13).
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-surface-2", className)}
      {...props}
    />
  );
}
