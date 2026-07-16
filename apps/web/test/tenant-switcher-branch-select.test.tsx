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
    expect(screen.getByText(/All branches/)).toBeInTheDocument();
  });

  it("navigates with ?branch=<id> when a branch is selected", async () => {
    const user = userEvent.setup();
    render(<TenantSwitcher tenantName="Noor Polyclinic" branches={BRANCHES} />);

    await user.click(screen.getByRole("button", { name: /Noor Polyclinic/ }));
    const item = await screen.findByRole("menuitem", { name: "Riyadh, Al Malaz" });
    await user.click(item);

    expect(mockedPush).toHaveBeenCalledWith("/en/analytics?branch=branch-riyadh");
  });

  it("clears the branch param when 'All branches' is selected", async () => {
    mockedSearchParamsString = "branch=branch-riyadh";
    const user = userEvent.setup();
    render(<TenantSwitcher tenantName="Noor Polyclinic" branches={BRANCHES} />);

    await user.click(screen.getByRole("button", { name: /Noor Polyclinic/ }));
    const item = await screen.findByRole("menuitem", { name: "All branches" });
    await user.click(item);

    expect(mockedPush).toHaveBeenCalledWith("/en/analytics");
  });

  it("preserves an existing search param (e.g. ?q=) when switching branch", async () => {
    mockedSearchParamsString = "q=Bupa";
    const user = userEvent.setup();
    render(<TenantSwitcher tenantName="Noor Polyclinic" branches={BRANCHES} />);

    await user.click(screen.getByRole("button", { name: /Noor Polyclinic/ }));
    const item = await screen.findByRole("menuitem", { name: "Mecca, Al Aziziyah" });
    await user.click(item);

    const calledWith = mockedPush.mock.calls[0]![0] as string;
    expect(calledWith).toContain("q=Bupa");
    expect(calledWith).toContain("branch=branch-mecca");
  });

  it("shows the selected branch's name in the trigger label", () => {
    mockedSearchParamsString = "branch=branch-mecca";
    render(<TenantSwitcher tenantName="Noor Polyclinic" branches={BRANCHES} />);
    expect(screen.getByText(/Mecca, Al Aziziyah/)).toBeInTheDocument();
  });
});
