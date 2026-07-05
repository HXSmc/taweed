import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge our custom fontSize scale (tailwind.config.ts §4.3). Without
// this, twMerge cannot tell `text-hero`/`text-h1`/... from a text-COLOR utility, so
// it collides them with `text-at-risk` etc. and silently drops the SIZE — which
// shrank every hero/stat number and sized+colored heading to the inherited 14px.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "hero",
            "display",
            "h1",
            "h2",
            "h3",
            "body",
            "label",
            "codenum",
          ],
        },
      ],
    },
  },
});

/** Merge Tailwind classes with conflict resolution (shadcn convention). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
