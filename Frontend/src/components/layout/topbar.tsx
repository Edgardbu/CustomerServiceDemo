"use client";

import { Bell, Moon, Search, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { ConnectionIndicator } from "@/components/layout/connection-indicator";
import { HealthBadge } from "@/components/layout/health-badge";
import {
  ActingAsSelector,
  CurrentUserButton,
} from "@/components/layout/acting-as-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getIsDark, setTheme, subscribeTheme } from "@/lib/theme";

interface TopBarProps {
  onSearchChange?: (value: string) => void;
}

export function TopBar({ onSearchChange }: TopBarProps) {
  const dark = useSyncExternalStore(subscribeTheme, getIsDark, () => true);

  function toggleTheme() {
    setTheme(!dark);
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-background/70 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/50">
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search conversations, customers…"
          className="h-9 border-border/70 bg-muted/40 ps-9 text-sm"
          onChange={(e) => onSearchChange?.(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 md:flex">
          <ConnectionIndicator />
          <HealthBadge />
        </div>

        <div className="mx-1 hidden h-6 w-px bg-border md:block" />

        <ActingAsSelector />

        <Button
          variant="ghost"
          size="icon"
          className="relative size-9"
          aria-label="Notifications"
        >
          <Bell className="size-[18px]" />
          <span className="absolute end-2 top-2 size-2 rounded-full bg-primary ring-2 ring-background" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="size-9"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </Button>

        <div className="mx-1 hidden h-6 w-px bg-border sm:block" />

        <CurrentUserButton />
      </div>
    </header>
  );
}
