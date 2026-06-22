"use client";

import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { TENANT_ID } from "@/lib/constants";
import type { Tenant } from "@/lib/types";
import { AppShell } from "@/components/layout/app-shell";
import { SettingsHeader } from "@/components/settings/settings-header";
import { SettingsTabs } from "@/components/settings/settings-tabs";

interface SettingsLayoutClientProps {
  children: ReactNode;
}

export function SettingsLayoutClient({ children }: SettingsLayoutClientProps) {
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
        <SettingsHeader />
        <SettingsTabs />
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </AppShell>
  );
}
