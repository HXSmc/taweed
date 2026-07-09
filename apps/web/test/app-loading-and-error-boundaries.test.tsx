// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import arMessages from "@/messages/ar.json";

// Regression coverage for the audit finding: apps/web/app/[locale]/(app) had
// no loading.tsx or error.tsx anywhere in the tree, so every dynamic,
// DB-backed page (overview, analytics, scrubber, ...) blocked navigation on
// the full server render with no streaming skeleton, and an unhandled throw
// from any un-try/caught `await getX(...)` call bubbled to Next's bare
// default error page instead of a scoped, on-brand recovery UI. This locks in
// the three new boundaries: the shared (app) loading skeleton, the (app)
// error boundary, and the locale-level not-found page.

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...rest }: React.ComponentProps<"a">) => (
    <a {...rest}>{children}</a>
  ),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async (namespace: string) => {
    const messages =
      namespace === "common" ? (enMessages.common as Record<string, string>) : {};
    return (key: string) => messages[key] ?? key;
  }),
}));

import AppLoading from "../app/[locale]/(app)/loading";
import AppError from "../app/[locale]/(app)/error";
import LocaleError from "../app/[locale]/error";
import LocaleNotFound from "../app/[locale]/not-found";

afterEach(cleanup);

function withIntl(ui: React.ReactElement, locale: "en" | "ar" = "en") {
  const messages = locale === "en" ? enMessages : arMessages;
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("(app)/loading.tsx — shared streaming skeleton", () => {
  it("announces a loading status instead of rendering blank while data fetches", () => {
    render(withIntl(<AppLoading />));

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent("Loading");
  });

  it("shapes the skeleton to the real page layout (header + card grid), not a bare spinner", () => {
    const { container } = render(withIntl(<AppLoading />));

    // At least the header skeleton lines plus the hero + stat card skeletons.
    const pulses = container.querySelectorAll(".animate-pulse");
    expect(pulses.length).toBeGreaterThanOrEqual(6);
  });
});

describe("(app)/error.tsx — scoped error boundary", () => {
  it("renders a branded recovery card instead of a bare error page", () => {
    const reset = vi.fn();

    render(
      withIntl(<AppError error={new Error("getRecovery failed")} reset={reset} />),
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(
      screen.getByText(
        "We hit a problem loading this page. Your data is safe — try again.",
      ),
    ).toBeInTheDocument();
  });

  it("calls reset() when the user retries, so the segment can re-render", async () => {
    const reset = vi.fn();
    const user = userEvent.setup();

    render(withIntl(<AppError error={new Error("boom")} reset={reset} />));

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("logs the error client-side for correlation with the server-side trace", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("scrubber getScrubRows failed");

    render(withIntl(<AppError error={error} reset={vi.fn()} />));

    expect(consoleError).toHaveBeenCalledWith(error);
    consoleError.mockRestore();
  });

  it("renders the same branded copy in Arabic", () => {
    render(withIntl(<AppError error={new Error("boom")} reset={vi.fn()} />, "ar"));

    expect(screen.getByText("حدث خطأ ما")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "إعادة المحاولة" }),
    ).toBeInTheDocument();
  });
});

describe("[locale]/error.tsx — layout-level fallback boundary", () => {
  // (app)/error.tsx cannot catch a throw from (app)/layout.tsx itself (Next.js
  // error boundaries never catch same-segment layout throws) — the layout's
  // own getMoneyScope/getBranches calls need this one-level-up boundary.
  it("renders the same branded recovery card for a layout-level failure", () => {
    const reset = vi.fn();

    render(
      withIntl(<LocaleError error={new Error("getMoneyScope failed")} reset={reset} />),
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("calls reset() when the user retries", async () => {
    const reset = vi.fn();
    const user = userEvent.setup();

    render(withIntl(<LocaleError error={new Error("boom")} reset={reset} />));

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(reset).toHaveBeenCalledTimes(1);
  });
});

describe("[locale]/not-found.tsx — branded 404", () => {
  it("renders a branded not-found card with a link back to overview instead of Next's default 404", async () => {
    render(await LocaleNotFound());

    expect(screen.getByText("Page not found")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Back to overview" });
    expect(link).toHaveAttribute("href", "/overview");
  });
});
