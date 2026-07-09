"use client";
import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";

// Radix's TabsPrimitive.Root defaults arrow-key roving focus to LTR order
// unless given an explicit `dir` (there's no DirectionProvider ancestor in
// this app), so ArrowLeft/ArrowRight ignore document.dir="rtl" and move focus
// backwards for Arabic. The app's own RTL detection lives on locale (see
// app/[locale]/layout.tsx: dir = locale === "ar" ? "rtl" : "ltr") — mirror
// that here so keyboard tab navigation is mirrored for RTL locales too.
export const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ dir, ...props }, ref) => {
  const locale = useLocale();
  return <TabsPrimitive.Root ref={ref} dir={dir ?? (locale === "ar" ? "rtl" : "ltr")} {...props} />;
});
Tabs.displayName = TabsPrimitive.Root.displayName;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex items-center gap-1 border-b border-hairline",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "-mb-px border-b-2 border-transparent px-3 py-2 text-body font-medium text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent data-[state=active]:border-accent data-[state=active]:text-text",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = "TabsContent";
