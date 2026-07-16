"use client";
import { useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { MoneyIndicator } from "./money-indicator";
import { TenantSwitcher } from "./tenant-switcher";
import { LocaleToggle } from "./locale-toggle";
import { ThemeToggle } from "./theme-toggle";
import { RoleChip } from "./role-chip";
import { AccountMenu } from "./account-menu";
import type { Role } from "@/lib/rbac";

// Top command bar (design-brief §7), 56px sticky. Inline-start = tenant/branch
// scope; center = global search; inline-end = the persistent money indicator,
// locale + theme, role chip, account. The data-residency statement moved to
// Settings > Data residency (freed up bar space; was crowding the search box
// at common desktop widths).
export function CommandBar({
  tenantName,
  role,
  email,
  recovered,
  atRisk,
  scopeLabel,
  branches,
}: {
  tenantName: string;
  role: Role;
  email: string;
  recovered: number;
  atRisk: number;
  scopeLabel: string;
  branches: { id: string; name: string }[];
}) {
  const t = useTranslations("common");
  const [query, setQuery] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Always preventDefault: we drive navigation ourselves so an empty query is
    // a clean no-op instead of a `?q=` GET to the scrubber.
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    // Locale is always in the path prefix (i18n/routing.ts) — derive it from the
    // current URL so the search lands on the active locale's scrubber. Uses
    // window.location (full nav) instead of next/navigation's useRouter so this
    // component renders without an App Router context (keeps it isolated and its
    // component tests free of a router provider).
    const locale = window.location.pathname.split("/")[1] || "en";
    const params = new URLSearchParams({ q });
    window.location.assign(`/${locale}/scrubber?${params.toString()}`);
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-hairline bg-surface-1 px-4 backdrop-blur">
      <TenantSwitcher tenantName={tenantName} branches={branches} />

      <form
        role="search"
        onSubmit={handleSubmit}
        className="relative hidden min-w-0 flex-1 md:block"
      >
        <Search className="pointer-events-none absolute inset-inline-start-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <input
          type="search"
          name="q"
          aria-label={t("search")}
          placeholder={t("search")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="focus-ring h-9 w-full max-w-md rounded-md border border-hairline bg-surface-1 ps-8 pe-3 text-body placeholder:text-faint"
        />
      </form>

      <div className="ms-auto flex items-center gap-3">
        <div className="hidden lg:block">
          <MoneyIndicator recovered={recovered} atRisk={atRisk} scopeLabel={scopeLabel} />
        </div>
        <LocaleToggle />
        <ThemeToggle />
        <RoleChip role={role} />
        <AccountMenu email={email} tenant={tenantName} />
      </div>
    </header>
  );
}
