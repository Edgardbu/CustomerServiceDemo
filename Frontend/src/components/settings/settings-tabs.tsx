"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SETTINGS_TABS } from "@/lib/settings-nav";
import { cn } from "@/lib/utils";

export function SettingsTabs() {
  const pathname = usePathname();

  return (
    <div className="border-b border-border bg-card/30">
      <nav
        className="scrollbar-none flex gap-1 overflow-x-auto px-4 sm:px-6"
        aria-label="Settings sections"
      >
        {SETTINGS_TABS.map((tab) => {
          const Icon = tab.icon;
          const active =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);

          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={cn(
                "relative flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors sm:px-4",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
