"use client";

import { RealtimeProvider } from "@/providers/realtime-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { BootstrapGate } from "@/components/bootstrap/bootstrap-gate";
import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <RealtimeProvider>
        <BootstrapGate>{children}</BootstrapGate>
      </RealtimeProvider>
    </ToastProvider>
  );
}
