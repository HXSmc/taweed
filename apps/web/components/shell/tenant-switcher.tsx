"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
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
// (one contract); branches are a single-select filter over the tenant's real
// branches, persisted to the `?branch=` URL param so it's shareable and survives
// a reload. CONTAINED scope (deliberate, not the full design-brief spec): only
// the Analytics and Scrubber pages actually read this param and narrow their
// data (see lib/data.ts's getAnalytics/getScrubRows `branchId` param and the
// scope-cut comment on getAnalytics) — Ingest, Appeals, and Recovery show this
// same switcher in their command-bar chrome but do not filter on it.
export function TenantSwitcher({
  tenantName,
  branches,
}: {
  tenantName: string;
  branches: { id: string; name: string }[];
}) {
  const t = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedId = searchParams.get("branch");
  const selectedBranch = branches.find((b) => b.id === selectedId);
  const scopeLabel = selectedBranch ? selectedBranch.name : t("allBranches");

  function selectBranch(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("branch", id);
    else params.delete("branch");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="focus-ring flex items-center gap-2 rounded-md border border-hairline bg-surface-1 px-2.5 py-1.5 text-body hover:bg-surface-2">
        <Building2 className="size-4 text-muted" aria-hidden />
        <span className="max-w-[10rem] truncate font-medium">{tenantName}</span>
        <span className="hidden text-muted sm:inline">· {scopeLabel}</span>
        <ChevronDown className="size-4 text-muted" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[14rem]">
        <DropdownMenuLabel>{tenantName}</DropdownMenuLabel>
        <DropdownMenuItem
          className="font-medium text-accent"
          aria-current={selectedId ? undefined : "true"}
          onSelect={() => selectBranch(null)}
        >
          {t("allBranches")}
        </DropdownMenuItem>
        {branches.map((b) => (
          <DropdownMenuItem
            key={b.id}
            aria-current={b.id === selectedId ? "true" : undefined}
            onSelect={() => selectBranch(b.id)}
          >
            {b.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
