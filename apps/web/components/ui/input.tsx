import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      "focus-ring-field h-9 w-full rounded-md border border-hairline bg-surface-1 px-3 text-body text-text placeholder:text-faint disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
