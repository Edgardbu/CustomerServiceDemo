"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { WorkspaceSkeleton } from "@/components/workspace/workspace-skeleton";

const AgentWorkspace = dynamic(
  () =>
    import("@/components/workspace/agent-workspace").then(
      (mod) => mod.AgentWorkspace,
    ),
  {
    ssr: false,
    loading: () => <WorkspaceSkeleton />,
  },
);

export function AgentWorkspaceClient() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <AgentWorkspace />
    </Suspense>
  );
}
