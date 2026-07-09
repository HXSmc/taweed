// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Regression test (manual-visual finding, /en/login and /ar/login, both
// themes): the demo-account sign-in <button> (page.tsx) used a raw inline
// focus ring (`focus-visible:outline-none focus-visible:ring-2
// focus-visible:ring-accent`) instead of the shared `.focus-ring` utility
// (app/globals.css) that every other focusable control in the app uses
// (e.g. components/modules/scrubber-table.tsx). The inline version hardcodes
// `ring-accent` directly, so it would silently diverge from any future
// centralized tuning of the `.focus-ring` token pairing. Fixed by swapping
// the inline classes for the shared `focus-ring` utility class.

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => ((key: string) => key) as unknown),
  setRequestLocale: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));
vi.mock("@/lib/session", () => ({
  getSession: vi.fn(async () => null),
}));
vi.mock("@/lib/auth", () => ({
  DEV_AUTH_ENABLED: true,
}));
vi.mock("@/lib/actions/auth", () => ({
  signInWithEmail: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  listDemoAccounts: vi.fn(async () => [
    {
      id: "u1",
      tenantId: "t1",
      tenantName: "Acme Health",
      role: "owner",
      locale: "en",
      email: "owner@acme.test",
    },
  ]),
}));

import LoginPage from "@/app/[locale]/(auth)/login/page";

describe("Login page — demo-account button focus ring", () => {
  it("uses the shared .focus-ring utility instead of an inline ring-accent focus style", async () => {
    // Arrange + Act: server component — render its resolved element tree.
    render(await LoginPage({ params: Promise.resolve({ locale: "en" }) }));

    // Assert
    const demoButton = screen.getByRole("button", { name: /owner@acme\.test/ });
    expect(demoButton).toHaveClass("focus-ring");
    expect(demoButton.className).not.toMatch(/focus-visible:ring-accent/);
    expect(demoButton.className).not.toMatch(/focus-visible:outline-none/);
  });
});
