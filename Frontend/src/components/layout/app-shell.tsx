import type { ReactNode } from "react";
import { Suspense } from "react";
import type { Tenant } from "@/lib/types";
import type { WorkspaceView } from "@/lib/workspace-view";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";

interface AppShellProps {
  children: ReactNode;
  tenant?: Tenant | null;
  workspaceView?: WorkspaceView;
  onSearchChange?: (value: string) => void;
}

function SidebarFallback() {
  return <div className="hidden h-full w-[220px] shrink-0 lg:block" />;
}

export function AppShell({
  children,
  tenant,
  workspaceView = "inbox",
  onSearchChange,
}: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <div className="hidden lg:block">
        <Suspense fallback={<SidebarFallback />}>
          <Sidebar tenant={tenant} workspaceView={workspaceView} />
        </Suspense>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onSearchChange={onSearchChange} />
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
