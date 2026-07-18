// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi, beforeAll, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Regression coverage for the tester-reported "can't change branches, only
// view all" bug: the switcher used to be a static shell — every
// DropdownMenuItem had no onClick/selection handler at all, so clicking a
// branch did nothing (no state change, no URL change, no updated label).
// Fixed: selection now writes a `?branch=<id>` URL param via next/navigation's
// router, and the trigger label reflects the current selection.

// Radix's menu positioning relies on pointer capture / measurement APIs
// jsdom does not implement (same polyfill as ui-dropdown-menu.test.tsx).
beforeAll(() => {
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
  Element.prototype.releasePointerCapture =
    Element.prototype.releasePointerCapture ?? (() => undefined);
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => undefined);
});

const mockedPush = vi.fn();
let mockedSearchParamsString = "";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => (key === "allBranches" ? "All branches" : key),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockedPush }),
  usePathname: () => "/en/analytics",
  useSearchParams: () => new URLSearchParams(mockedSearchParamsString),
}));

import { TenantSwitcher } from "@/components/shell/tenant-switcher";

const BRANCHES = [
  { id: "branch-riyadh", name: "Riyadh, Al Malaz" },
  { id: "branch-mecca", name: "Mecca, Al Aziziyah" },
];

describe("TenantSwitcher — branch selection", () => {
  afterEach(cleanup);
  beforeEach(() => {
    mockedPush.mockClear();
    mockedSearchParamsString = "";
  });

  it("shows 'All branches' in the trigger label when no branch is selected", () => {
    render(<TenantSwitcher tenantName="Noor Polyclinic" branches={BRANCHES} />);
    // The scope now lives in two spans (sr-only + visual), so query via the
    // trigger's accessible name rather than the duplicated text node.
    expect(
      screen.getByRole("button", { name: /All branches/ }),
    ).toBeInTheDocument();
  });

  it("navigates with ?branch=<id> when a branch is selected", async () => {
    const user = userEvent.setup();
    render(<TenantSwitcher tenantName="Noor Polyclinic" branches={BRANCHES} />);

    await user.click(screen.getByRole("button", { name: /Noor Polyclinic/ }));
    const item = await screen.findByRole("menuitemradio", { name: "Riyadh, Al Malaz" });
    await user.click(item);

    expect(mockedPush).toHaveBeenCalledWith("/en/analytics?branch=branch-riyadh");
  });

  it("clears the branch param when 'All branches' is selected", async () => {
    mockedSearchParamsString = "branch=branch-riyadh";
    const user = userEvent.setup();
    render(<TenantSwitcher tenantName="Noor Polyclinic" branches={BRANCHES} />);

    await user.click(screen.getByRole("button", { name: /Noor Polyclinic/ }));
    const item = await screen.findByRole("menuitemradio", { name: "All branches" });
    await user.click(item);

    expect(mockedPush).toHaveBeenCalledWith("/en/analytics");
  });

  it("preserves an existing search param (e.g. ?q=) when switching branch", async () => {
    mockedSearchParamsString = "q=Bupa";
    const user = userEvent.setup();
    render(<TenantSwitcher tenantName="Noor Polyclinic" branches={BRANCHES} />);

    await user.click(screen.getByRole("button", { name: /Noor Polyclinic/ }));
    const item = await screen.findByRole("menuitemradio", { name: "Mecca, Al Aziziyah" });
    await user.click(item);

    const calledWith = mockedPush.mock.calls[0]![0] as string;
    expect(calledWith).toContain("q=Bupa");
    expect(calledWith).toContain("branch=branch-mecca");
  });

  it("shows the selected branch's name in the trigger label", () => {
    mockedSearchParamsString = "branch=branch-mecca";
    render(<TenantSwitcher tenantName="Noor Polyclinic" branches={BRANCHES} />);
    expect(
      screen.getByRole("button", { name: /Mecca, Al Aziziyah/ }),
    ).toBeInTheDocument();
  });
});

// WCAG AA (a11y.md finding #18): three confirmed findings — F1 scope dropped
// from the trigger's accessible name below `sm`, F2 single-select used
// menuitem/aria-current instead of menuitemradio/aria-checked, F3 selected
// branch's text-accent failed AA in dark theme.
describe("TenantSwitcher — accessibility fixes (a11y.md finding #18)", () => {
  afterEach(cleanup);
  beforeEach(() => {
    mockedPush.mockClear();
    mockedSearchParamsString = "";
  });

  // F1: the scope must remain in the trigger's accessible name at every
  // viewport. JSDOM applies no CSS, so assert the underlying structure: an
  // `sr-only`-classed span carrying the scope text exists unconditionally,
  // separate from the responsive `aria-hidden` visual copy.
  it("F1 — keeps the scope in an sr-only span so it's in the a11y tree at all widths", () => {
    const { container } = render(
      <TenantSwitcher tenantName="Noor Polyclinic" branches={BRANCHES} />,
    );
    const srOnlyScope = container.querySelector("span.sr-only");
    expect(srOnlyScope).not.toBeNull();
    expect(srOnlyScope!.textContent).toMatch(/All branches/);

    // The visually-responsive copy is hidden from the a11y tree (no double
    // announcement) and retains the `hidden ... sm:inline` responsive classes.
    const visualScope = container.querySelector('span[aria-hidden="true"]');
    expect(visualScope).not.toBeNull();
    expect(visualScope!.textContent).toMatch(/All branches/);
    expect(visualScope).toHaveClass("sm:inline");
  });

  // F2: the branch list is a single-select, so it must surface as
  // menuitemradio with aria-checked on the selected option.
  it("F2 — renders branch items as menuitemradio and marks the selected one aria-checked", async () => {
    mockedSearchParamsString = "branch=branch-riyadh";
    const user = userEvent.setup();
    render(<TenantSwitcher tenantName="Noor Polyclinic" branches={BRANCHES} />);

    await user.click(screen.getByRole("button", { name: /Noor Polyclinic/ }));
    const riyadh = await screen.findByRole("menuitemradio", { name: "Riyadh, Al Malaz" });
    const mecca = screen.getByRole("menuitemradio", { name: "Mecca, Al Aziziyah" });

    expect(riyadh).toHaveAttribute("aria-checked", "true");
    expect(mecca).toHaveAttribute("aria-checked", "false");
  });

  // F3: the selected item must not use bare `text-accent` (fails AA in dark);
  // it uses the bg-accent/text-accent-fg pairing in `.dark`.
  it("F3 — selected item uses the AA-safe accent-fg/accent-bg pairing, not bare text-accent", async () => {
    mockedSearchParamsString = "branch=branch-riyadh";
    const user = userEvent.setup();
    render(<TenantSwitcher tenantName="Noor Polyclinic" branches={BRANCHES} />);

    await user.click(screen.getByRole("button", { name: /Noor Polyclinic/ }));
    const riyadh = await screen.findByRole("menuitemradio", { name: "Riyadh, Al Malaz" });

    expect(riyadh.className).toContain("dark:bg-accent");
    expect(riyadh.className).toContain("dark:text-accent-fg");
  });
});
