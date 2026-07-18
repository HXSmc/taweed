"use client";
import * as React from "react";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;
export const DropdownMenuGroup = DropdownPrimitive.Group;
export const DropdownMenuRadioGroup = DropdownPrimitive.RadioGroup;

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>
>(({ className, sideOffset = 6, align = "end", ...props }, ref) => (
  <DropdownPrimitive.Portal>
    <DropdownPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[12rem] overflow-hidden rounded-md border border-hairline bg-surface-1 p-1 shadow-md",
        className,
      )}
      {...props}
    />
  </DropdownPrimitive.Portal>
));
DropdownMenuContent.displayName = "DropdownMenuContent";

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Item>
>(({ className, ...props }, ref) => (
  <DropdownPrimitive.Item
    ref={ref}
    className={cn(
      "flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-body text-text outline-none data-[highlighted]:bg-surface-2",
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = "DropdownMenuItem";

export const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.RadioItem>
>(({ className, ...props }, ref) => (
  <DropdownPrimitive.RadioItem
    ref={ref}
    className={cn(
      "flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-body text-text outline-none data-[highlighted]:bg-surface-2",
      className,
    )}
    {...props}
  />
));
DropdownMenuRadioItem.displayName = "DropdownMenuRadioItem";

export const DropdownMenuLabel = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("px-2 py-1.5 text-label text-muted", className)} {...props} />
);

export const DropdownMenuSeparator = () => (
  <DropdownPrimitive.Separator className="my-1 h-px bg-hairline" />
);
