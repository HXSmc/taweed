// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

// Regression test for a CONFIRMED WCAG AA finding (3.1.2 Language of Parts):
// LocaleToggle's accessible name is a hardcoded English string
// (`Switch to ${next === "ar" ? "Arabic" : "English"}`) with no `lang`
// override. On /ar (html lang="ar", dir="rtl") that made a screen reader
// announce the English phrase "Switch to English" using Arabic phonetic
// rules, since nothing marked the accessible name as English. Fixed by
// adding `lang="en"` to the button — the accessible name is always English
// regardless of current locale, so the marker is unconditional and correct
// on both /ar and /en.

const routerReplace = vi.fn();

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace: routerReplace }),
}));

import { LocaleToggle } from "@/components/shell/locale-toggle";

function renderWithLocale(locale: "ar" | "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      <LocaleToggle />
    </NextIntlClientProvider>,
  );
}

describe("LocaleToggle — accessible name language marking", () => {
  it("marks its (always-English) accessible name with lang=\"en\" on the Arabic page", () => {
    // Arrange + Act
    renderWithLocale("ar");

    // Assert: on /ar the toggle switches to English next, so its accessible
    // name is "Switch to English" — and it must carry lang="en" so assistive
    // tech doesn't apply Arabic pronunciation rules to English text.
    const button = screen.getByRole("button", { name: "Switch to English" });
    expect(button).toHaveAttribute("lang", "en");
  });

  it("still marks lang=\"en\" on the English page (name stays in English family)", () => {
    // Arrange + Act
    renderWithLocale("en");

    // Assert
    const button = screen.getByRole("button", { name: "Switch to Arabic" });
    expect(button).toHaveAttribute("lang", "en");
  });
});
