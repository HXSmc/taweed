"use client";
import { LogOut, UserCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/lib/actions/auth";

export function AccountMenu({ email, tenant }: { email: string; tenant: string }) {
  const t = useTranslations("auth");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="grid size-8 place-items-center rounded-full border border-hairline bg-surface-1 text-muted hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label={email}
      >
        <UserCircle className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          <div className="truncate text-body text-text">{email}</div>
          <div className="truncate text-muted">{tenant}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full text-start">
              <LogOut className="size-4" />
              {t("signOut")}
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
