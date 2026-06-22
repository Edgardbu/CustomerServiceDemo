import type { TenantUserRole } from "@/lib/types";

export const TENANT_USER_ROLES: TenantUserRole[] = [
  "owner",
  "admin",
  "agent",
  "viewer",
];

export function canManageUsers(role?: TenantUserRole | null): boolean {
  return role === "owner" || role === "admin";
}

interface RoleBadgeConfig {
  label: string;
  className: string;
}

const roleBadgeConfig: Record<TenantUserRole, RoleBadgeConfig> = {
  owner: {
    label: "Owner",
    className:
      "bg-violet-500/12 text-violet-700 ring-1 ring-inset ring-violet-500/25 dark:text-violet-300",
  },
  admin: {
    label: "Admin",
    className:
      "bg-sky-500/12 text-sky-700 ring-1 ring-inset ring-sky-500/25 dark:text-sky-300",
  },
  agent: {
    label: "Agent",
    className:
      "bg-emerald-500/12 text-emerald-700 ring-1 ring-inset ring-emerald-500/25 dark:text-emerald-300",
  },
  viewer: {
    label: "Viewer",
    className:
      "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
  },
};

export function getRoleBadgeConfig(role: TenantUserRole): RoleBadgeConfig {
  return roleBadgeConfig[role];
}

export function formatRoleLabel(role: TenantUserRole): string {
  return roleBadgeConfig[role].label;
}
