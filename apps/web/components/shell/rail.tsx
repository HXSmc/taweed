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
              "focus-ring flex h-10 items-center gap-3 rounded-md px-2.5 text-body font-medium transition-colors",
              active
                ? // Contrast fix (WCAG AA finding, axe:color-contrast): `--accent`
                  // is locked to the same hex in both themes while `--accent-subtle`
                  // is retuned darker for `.dark`, so this pairing dropped to
                  // ~2.64:1 — under the 4.5:1 minimum. `.dark` swaps to the solid
                  // accent fill (`bg-accent` + `text-accent-fg`, ~5.9:1), the same
                  // pairing already used for buttons/the brand mark and for the
                  // Badge `accent` variant's dark override.
                  "bg-accent-subtle text-accent dark:bg-accent dark:text-accent-fg"
                : "text-muted hover:bg-surface-2 hover:text-text",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="sr-only lg:not-sr-only lg:inline">{t(m)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
