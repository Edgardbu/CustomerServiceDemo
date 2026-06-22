"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { HealthResponse } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type HealthState = "loading" | "online" | "offline";

function isOnline(health: HealthResponse): boolean {
  return (
    health.status === "ok" ||
    health.status === "healthy" ||
    health.status === "up"
  );
}

export function HealthBadge({ className }: { className?: string }) {
  const [state, setState] = useState<HealthState>("loading");
  const [label, setLabel] = useState("Checking…");
  const [details, setDetails] = useState<HealthResponse | null>(null);

  useEffect(() => {
    let active = true;

    async function check() {
      try {
        const health = await api.health();
        if (!active) return;
        const online = isOnline(health);
        setState(online ? "online" : "offline");
        setLabel(online ? "Backend online" : `Status: ${health.status}`);
        setDetails(health);
      } catch {
        if (!active) return;
        setState("offline");
        setLabel("Backend offline");
        setDetails(null);
      }
    }

    void check();
    const interval = setInterval(() => void check(), 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 font-normal",
        state === "online" &&
          "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400",
        state === "offline" &&
          "border-destructive/30 bg-destructive/10 text-destructive",
        state === "loading" && "text-muted-foreground",
        className,
      )}
    >
      <span
        className={cn(
          "size-2 rounded-full",
          state === "online" && "animate-pulse bg-green-500",
          state === "offline" && "bg-destructive",
          state === "loading" && "bg-muted-foreground",
        )}
      />
      {label}
    </Badge>
  );

  if (!details) return badge;

  return (
    <Tooltip>
      <TooltipTrigger className="inline-flex cursor-default border-0 bg-transparent p-0">
        {badge}
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        <div className="space-y-1">
          <p className="font-medium">API health</p>
          {details.env ? <p>Env: {details.env}</p> : null}
          {details.database ? (
            <p>
              Database: {details.database}
              {details.database_status ? ` (${details.database_status})` : ""}
            </p>
          ) : null}
          {details.ai ? <p>AI: {details.ai}</p> : null}
          {details.realtime ? <p>Realtime: {details.realtime}</p> : null}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
