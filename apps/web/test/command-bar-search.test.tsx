// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// Regression coverage: the global command-bar search box was a dead
// `<input type="search">` — no state, no onChange, no submit behavior (tester
// report: "Search bar doesn't work"). These tests prove the input is now
// controlled and Enter with a real query navigates to the Scrubber page
// (which filters its already-loaded claim rows by the `q` param), while an
// empty/whitespace query is a clean no-op.

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/components/shell/money-indicator", () => ({
  MoneyIndicator: () => null,
}));
vi.mock("@/components/shell/tenant-switcher", () => ({
  TenantSwitcher: () => null,
}));
vi.mock("@/components/shell/locale-toggle", () => ({
  LocaleToggle: () => null,
}));
vi.mock("@/components/shell/theme-toggle", () => ({
  ThemeToggle: () => null,
}));
vi.mock("@/components/shell/role-chip", () => ({
  RoleChip: () => null,
}));
vi.mock("@/components/shell/account-menu", () => ({
  AccountMenu: () => null,
}));

import { CommandBar } from "@/components/shell/command-bar";

function renderCommandBar() {
  const testRole = "owner";
  render(
    <CommandBar
      tenantName="Acme Health"
      role={testRole}
      email="owner@acme.test"
      recovered={0}
      atRisk={0}
      scopeLabel="All branches"
      branches={[]}
    />,
  );
}

describe("CommandBar — global search", () => {
  let assignSpy: ReturnType<typeof vi.fn>;

  afterEach(cleanup);

  beforeEach(() => {
    assignSpy = vi.fn();
    // window.location.assign is not implemented in jsdom's default navigation
    // stub — replace the whole location object so we can assert on it.
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, pathname: "/en/analytics", assign: assignSpy },
    });
  });

  it("is a controlled input — typing updates the value", () => {
    renderCommandBar();
    const box = screen.getByRole("searchbox", { name: "search" }) as HTMLInputElement;
    fireEvent.change(box, { target: { value: "Bupa" } });
    expect(box.value).toBe("Bupa");
  });

  it("navigates to the Scrubber with ?q= on Enter with a non-empty query", () => {
    renderCommandBar();
    const box = screen.getByRole("searchbox", { name: "search" });
    const form = box.closest("form")!;
    fireEvent.change(box, { target: { value: "Bupa Arabia" } });
    fireEvent.submit(form);
    expect(assignSpy).toHaveBeenCalledTimes(1);
    expect(assignSpy).toHaveBeenCalledWith("/en/scrubber?q=Bupa+Arabia");
  });

  it("does nothing on Enter with an empty query", () => {
    renderCommandBar();
    const box = screen.getByRole("searchbox", { name: "search" });
    const form = box.closest("form")!;
    fireEvent.submit(form);
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it("does nothing on Enter with a whitespace-only query", () => {
    renderCommandBar();
    const box = screen.getByRole("searchbox", { name: "search" });
    const form = box.closest("form")!;
    fireEvent.change(box, { target: { value: "   " } });
    fireEvent.submit(form);
    expect(assignSpy).not.toHaveBeenCalled();
  });
});
