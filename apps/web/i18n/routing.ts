import { defineRouting } from "next-intl/routing";

// Arabic-first (design-brief §5): AR is the default for new owner accounts.
// Locale is always in the path prefix so the whole shell mirrors from one flip.
export const routing = defineRouting({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];
