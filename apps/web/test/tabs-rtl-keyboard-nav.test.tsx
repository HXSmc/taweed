// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";

// Accessibility regression test (manual-keyboard finding, WCAG AA):
// Radix's TabsPrimitive.Root defaults arrow-key roving focus to LTR order
// unless told otherwise (no DirectionProvider ancestor exists in this app),
// so on /ar/settings (dir="rtl") ArrowLeft/ArrowRight moved focus in LTR
// order — the key that visually points toward the next tab moved to the
// previous one instead. The fix makes the shared Tabs wrapper derive `dir`
// from the active locale (mirroring app/[locale]/layout.tsx's own
// `dir = locale === "ar" ? "rtl" : "ltr"`) and pass it to Radix so arrow-key
// order is mirrored for RTL locales.
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function renderTabs(locale: "ar" | "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">Tab A</TabsTrigger>
          <TabsTrigger value="b">Tab B</TabsTrigger>
          <TabsTrigger value="c">Tab C</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Content A</TabsContent>
        <TabsContent value="b">Content B</TabsContent>
        <TabsContent value="c">Content C</TabsContent>
      </Tabs>
    </NextIntlClientProvider>,
  );
}

describe("Tabs — RTL-mirrored arrow-key navigation", () => {
  afterEach(cleanup);

  it("moves focus to the NEXT tab (not wrapping backward) on ArrowLeft when locale is Arabic (rtl)", async () => {
    const user = userEvent.setup();
    renderTabs("ar");

    const [tabA, tabB] = screen.getAllByRole("tab");
    tabA.focus();
    expect(tabA).toHaveFocus();

    // In rtl, ArrowLeft visually points toward the next tab — it must move
    // forward (A -> B), not wrap backward to the last tab as LTR semantics
    // would.
    await user.keyboard("{ArrowLeft}");
    expect(tabB).toHaveFocus();
  });

  it("moves focus to the PREVIOUS tab on ArrowRight when locale is Arabic (rtl), wrapping to the last tab from the first", async () => {
    const user = userEvent.setup();
    renderTabs("ar");

    const [tabA, , tabC] = screen.getAllByRole("tab");
    tabA.focus();
    expect(tabA).toHaveFocus();

    // From the first tab, ArrowRight (pointing toward the previous/last tab
    // in rtl) wraps to the last tab.
    await user.keyboard("{ArrowRight}");
    expect(tabC).toHaveFocus();
  });

  it("keeps LTR arrow-key semantics unchanged for the English locale", async () => {
    const user = userEvent.setup();
    renderTabs("en");

    const [tabA, tabB] = screen.getAllByRole("tab");
    tabA.focus();

    await user.keyboard("{ArrowRight}");
    expect(tabB).toHaveFocus();
  });
});
