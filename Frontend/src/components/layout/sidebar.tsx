"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BarChart3,
  Bot,
  ChevronsUpDown,
  Headphones,
  Inbox,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Tenant } from "@/lib/types";
import {
  workspaceViewFromSearchParam,
  type WorkspaceView,
} from "@/lib/workspace-view";
import { BOT_STUDIO_BASE_PATH } from "@/lib/bot-studio-nav";
import { SETTINGS_BASE_PATH } from "@/lib/settings-nav";
import { canManageUsers } from "@/lib/users/roles";
import { useCurrentUserStore } from "@/stores/current-user-store";
import { ContactAvatar } from "@/components/ui/contact-avatar";
import { cn } from "@/lib/utils";

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
}

const navItems: NavItem[] = [
  { id: "inbox", label: "Inbox", icon: Inbox, href: "/" },
  {
    id: "bot-studio",
    label: "Bot Studio",
    icon: Bot,
    href: `${BOT_STUDIO_BASE_PATH}/settings`,
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    href: "/?view=analytics",
  },
];

interface SidebarProps {
  tenant?: Tenant | null;
  workspaceView?: WorkspaceView;
}

function isNavItemActive(
  item: NavItem,
  pathname: string,
  workspaceView: WorkspaceView,
): boolean {
  if (item.id === "bot-studio") {
    return pathname.startsWith(BOT_STUDIO_BASE_PATH);
  }

  if (item.id === "settings") {
    return pathname.startsWith(SETTINGS_BASE_PATH);
  }

  if (pathname !== "/") {
    return false;
  }

  if (item.id === "analytics") {
    return workspaceView === "analytics";
  }

  if (item.id === "inbox") {
    return workspaceView === "inbox";
  }

  return false;
}

export function Sidebar({ tenant, workspaceView = "inbox" }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const viewFromUrl = workspaceViewFromSearchParam(searchParams.get("view"));
  const activeView = pathname === "/" ? viewFromUrl : workspaceView;
  const currentUser = useCurrentUserStore((state) => state.getCurrentUser());
  const showSettings = canManageUsers(currentUser?.role);

  const visibleNavItems: NavItem[] = [
    ...navItems,
    ...(showSettings
      ? [
          {
            id: "settings",
            label: "Settings",
            icon: Settings,
            href: `${SETTINGS_BASE_PATH}/users`,
          },
        ]
      : []),
  ];

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col border-e border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-violet-500 text-primary-foreground shadow-sm">
          <Headphones className="size-[18px]" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight">
            Helpdesk
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            Omnichannel Suite
          </p>
        </div>
      </div>

      <div className="px-3">
        <div className="h-px bg-sidebar-border" />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Workspace
        </p>
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = isNavItemActive(item, pathname, activeView);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
              )}
            >
              {isActive ? (
                <span className="absolute inset-y-1.5 -start-3 w-1 rounded-e-full bg-primary" />
              ) : null}
              <Icon
                className={cn(
                  "size-[18px] shrink-0",
                  isActive ? "text-primary" : "",
                )}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-lg border border-sidebar-border bg-card/40 px-2.5 py-2 text-start transition-colors hover:bg-sidebar-accent/60"
        >
          <ContactAvatar
            name={tenant?.name ?? "Demo Tenant"}
            size="sm"
            className="rounded-lg"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {tenant?.name ?? "Demo Tenant"}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {tenant?.tenant_id ?? "demo"}
              {tenant?.status ? ` · ${tenant.status}` : ""}
            </p>
          </div>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </div>
    </aside>
  );
}
