"use client";

import { useRealtime } from "@/hooks/use-realtime";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const STATUS_CONFIG = {
  connected: {
    label: "Connected",
    className:
      "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400",
    dot: "bg-green-500 animate-pulse",
  },
  reconnecting: {
    label: "Reconnecting",
    className:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500 animate-pulse",
  },
  disconnected: {
    label: "Disconnected",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
} as const;

export function ConnectionIndicator() {
  const { status, lastEventAt } = useRealtime();
  const config = STATUS_CONFIG[status];

  const badge = (
    <Badge variant="outline" className={cn("gap-1.5 font-normal", config.className)}>
      <span className={cn("size-2 rounded-full", config.dot)} />
      {config.label}
    </Badge>
  );

  return (
    <Tooltip>
      <TooltipTrigger className="inline-flex cursor-default border-0 bg-transparent p-0">
        {badge}
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        <p>Realtime: {config.label}</p>
        {lastEventAt ? (
          <p>Last event: {lastEventAt.toLocaleTimeString()}</p>
        ) : (
          <p>Waiting for live events…</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
