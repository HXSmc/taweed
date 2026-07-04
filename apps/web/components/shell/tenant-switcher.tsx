"use client";
import { Building2, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Two-level tenant/branch scope (design-brief §7). Tenant is fixed to the session
// (one contract); branches are a display multi-select over the tenant's real
// branches. Scope is global chrome every module reads.
export function TenantSwitcher({
  tenantName,
  branches,
}: {
  tenantName: string;
  branches: { id: string; name: string }[];
}) {
  const t = useTranslations("common");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md border border-hairline bg-surface-1 px-2.5 py-1.5 text-body hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <Building2 className="size-4 text-muted" aria-hidden />
        <span className="max-w-[10rem] truncate font-medium">{tenantName}</span>
        <span className="hidden text-muted sm:inline">· {t("allBranches")}</span>
        <ChevronDown className="size-4 text-muted" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[14rem]">
        <DropdownMenuLabel>{tenantName}</DropdownMenuLabel>
        <DropdownMenuItem className="font-medium text-accent">
          {t("allBranches")}
        </DropdownMenuItem>
        {branches.map((b) => (
          <DropdownMenuItem key={b.id}>{b.name}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
