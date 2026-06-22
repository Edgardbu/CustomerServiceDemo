"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useBootstrapStore } from "@/stores/bootstrap-store";
import { BootstrapOwnerPage } from "@/components/bootstrap/bootstrap-owner-page";
import { BootstrapSkeleton } from "@/components/bootstrap/bootstrap-skeleton";
import { CurrentUserHydrator } from "@/components/providers/current-user-hydrator";

interface BootstrapGateProps {
  children: ReactNode;
}

export function BootstrapGate({ children }: BootstrapGateProps) {
  const pathname = usePathname();
  const router = useRouter();
  const checked = useBootstrapStore((state) => state.checked);
  const loading = useBootstrapStore((state) => state.loading);
  const error = useBootstrapStore((state) => state.error);
  const bootstrapRequired = useBootstrapStore((state) =>
    Boolean(state.status?.bootstrap_required),
  );
  const fetchStatus = useBootstrapStore((state) => state.fetchStatus);

  useEffect(() => {
    if (!checked && !loading) {
      void fetchStatus().catch(() => {
        // error stored in bootstrap store
      });
    }
  }, [checked, loading, fetchStatus]);

  useEffect(() => {
    if (!checked || bootstrapRequired) return;
    if (pathname === "/bootstrap") {
      router.replace("/");
    }
  }, [checked, bootstrapRequired, pathname, router]);

  if (!checked || loading) {
    return <BootstrapSkeleton />;
  }

  if (error && !bootstrapRequired) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-xl border border-destructive/30 bg-destructive/10 px-6 py-5 text-center">
          <p className="text-sm font-medium text-destructive">
            Unable to reach the backend
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (bootstrapRequired) {
    return <BootstrapOwnerPage />;
  }

  return (
    <>
      <CurrentUserHydrator />
      {children}
    </>
  );
}
