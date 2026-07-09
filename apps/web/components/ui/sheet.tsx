"use client";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Right-docked detail drawer (design-brief §8.3 master-detail). Origin follows
// reading direction: inline-end in both LTR and RTL via logical `end-0`.
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    title?: string;
    /** Accessible name for the icon-only close button (WCAG 4.1.2). */
    closeLabel?: string;
  }
>(({ className, children, title, closeLabel = "Close", ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/30 data-[state=open]:animate-in data-[state=open]:fade-in" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-y-0 end-0 z-50 flex h-full w-full max-w-md flex-col border-s border-hairline bg-surface-1 shadow-lg focus:outline-none data-[state=open]:animate-slide-in-end",
        className,
      )}
      {...props}
    >
      <div className="flex items-center justify-between border-b border-hairline px-5 py-3">
        <DialogPrimitive.Title className="text-h3 font-medium">
          {title}
        </DialogPrimitive.Title>
        <DialogPrimitive.Close
          aria-label={closeLabel}
          className="rounded-md p-1 text-muted hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <X className="size-4" aria-hidden="true" />
        </DialogPrimitive.Close>
      </div>
      <div className="flex-1 overflow-y-auto p-5">{children}</div>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = "SheetContent";
