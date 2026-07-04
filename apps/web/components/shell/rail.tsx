"use client";
import {
  LayoutDashboard,
  TrendingDown,
  Upload,
  ShieldCheck,
  FileText,
  Wallet,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { navModules, type ModuleKey, type Role } from "@/lib/rbac";
import { cn } from "@/lib/utils";

const ICONS: Record<ModuleKey, LucideIcon> = {
  overview: LayoutDashboard,
  analytics: TrendingDown,
  ingest: Upload,
  scrubber: ShieldCheck,
  appeals: FileText,
  recovery: Wallet,
  settings: Settings,
};

// Primary module nav (design-brief §7). Inline-start rail that flips to inline-end
// in RTL automatically (flex order + logical borders). Icon-only on tablet.
export function Rail({ role }: { role: Role }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const modules = navModules(role);

  return (
    <nav
      aria-label="Primary"
      className="flex w-16 shrink-0 flex-col gap-1 border-e border-hairline bg-surface-1 p-2 lg:w-60"
    >
      <div className="mb-2 flex h-10 items-center gap-2 px-2">
        <span className="grid size-7 place-items-center rounded-md bg-accent text-accent-fg font-display text-h3">
          T
        </span>
        <span className="hidden font-display text-h3 font-medium lg:inline">
          Taweed
        </span>
      </div>
      {modules.map((m) => {
        const Icon = ICONS[m];
        const active = pathname === `/${m}` || pathname.startsWith(`/${m}`);
        return (
          <Link
            key={m}
            href={`/${m}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-10 items-center gap-3 rounded-md px-2.5 text-body font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              active
                ? "bg-accent-subtle text-accent"
                : "text-muted hover:bg-surface-2 hover:text-text",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="hidden lg:inline">{t(m)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
