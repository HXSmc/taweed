import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { Role } from "@/lib/rbac";

// RBAC role made visible (design-brief §10 least-privilege made visible). Role is
// server-enforced; this is a read-only status chip, not a switcher.
export function RoleChip({ role }: { role: Role }) {
  const t = useTranslations("roles");
  return (
    <Badge variant="accent" className="uppercase tracking-wide">
      {t(role)}
    </Badge>
  );
}
