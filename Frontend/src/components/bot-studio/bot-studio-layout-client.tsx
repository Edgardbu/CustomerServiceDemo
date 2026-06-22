"use client";

import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { TENANT_ID } from "@/lib/constants";
import type { Tenant } from "@/lib/types";
import { AppShell } from "@/components/layout/app-shell";
import { BotStudioHeader } from "@/components/bot-studio/bot-studio-header";
import { BotStudioTabs } from "@/components/bot-studio/bot-studio-tabs";

interface BotStudioLayoutClientProps {
  children: ReactNode;
}

export function BotStudioLayoutClient({ children }: BotStudioLayoutClientProps) {
  const [tenant, setTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getTenant(TENANT_ID)
      .then((data) => {
        if (active) setTenant(data);
      })
      .catch(() => {
        if (active) setTenant(null);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <AppShell tenant={tenant}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <BotStudioHeader />
        <BotStudioTabs />
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </AppShell>
  );
}
