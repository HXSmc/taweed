import { getRequestConfig } from "next-intl/server";
import { IntlErrorCode } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale =
    requested && (routing.locales as readonly string[]).includes(requested)
      ? requested
      : routing.defaultLocale;
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    // Fail LOUD on a missing/mis-keyed message instead of silently rendering the
    // raw key. en.json <-> ar.json parity is enforced, so this should never fire;
    // if a key ever goes missing, dev THROWS (caught immediately) and prod logs +
    // renders a visible ⚠MISSING marker — never a silent blank or bare key.
    onError(error) {
      if (error.code === IntlErrorCode.MISSING_MESSAGE) {
        if (process.env.NODE_ENV !== "production") throw error;
        console.error("[i18n] missing message:", error.message);
      } else {
        console.error("[i18n]", error.message);
      }
    },
    getMessageFallback({ namespace, key }) {
      return `⚠MISSING:${[namespace, key].filter(Boolean).join(".")}`;
    },
  };
});
