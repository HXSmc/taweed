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
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-hairline bg-surface-1 px-4 backdrop-blur">
      <TenantSwitcher tenantName={tenantName} branches={branches} />

      <div className="relative hidden min-w-0 flex-1 md:block">
        <Search className="pointer-events-none absolute inset-inline-start-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <input
          type="search"
          aria-label={t("search")}
          placeholder={t("search")}
          className="focus-ring h-9 w-full max-w-md rounded-md border border-hairline bg-surface-1 ps-8 pe-3 text-body placeholder:text-faint"
        />
      </div>

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
