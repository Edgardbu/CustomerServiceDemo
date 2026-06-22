import type { TenantUserRole } from "@/lib/types";
import { getRoleBadgeConfig } from "@/lib/users/roles";
import { cn } from "@/lib/utils";

interface RoleBadgeProps {
  role: TenantUserRole;
  className?: string;
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const config = getRoleBadgeConfig(role);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium",
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
