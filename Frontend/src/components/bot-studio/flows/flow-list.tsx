"use client";

import { Pencil, Trash2 } from "lucide-react";
import type { BotFlow } from "@/lib/types";
import { BOT_INTENT_LABELS } from "@/lib/flow-builder/intents";
import { formatRelativeTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface FlowListProps {
  flows: BotFlow[];
  loading?: boolean;
  onEdit: (flow: BotFlow) => void;
  onDelete: (flow: BotFlow) => void;
}

export function FlowList({
  flows,
  loading = false,
  onEdit,
  onDelete,
}: FlowListProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (flows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
        <p className="text-sm font-medium">No flows yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a conversation flow to guide the bot through multi-step
          interactions.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card/40">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-start text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Enabled</th>
              <th className="px-4 py-3">Trigger intents</th>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3 text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {flows.map((flow) => (
              <tr
                key={flow.id}
                className="border-b border-border/70 last:border-0 hover:bg-muted/20"
              >
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onEdit(flow)}
                    className="max-w-[260px] truncate text-start font-medium hover:text-primary hover:underline"
                  >
                    {flow.name}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                      flow.enabled
                        ? "bg-emerald-500/12 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300"
                        : "bg-muted text-muted-foreground ring-border",
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        flow.enabled ? "bg-emerald-500" : "bg-muted-foreground",
                      )}
                    />
                    {flow.enabled ? "Enabled" : "Disabled"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex max-w-[280px] flex-wrap gap-1">
                    {flow.trigger_intents.length > 0 ? (
                      flow.trigger_intents.map((intent) => (
                        <Badge key={intent} variant="secondary" className="text-[10px]">
                          {BOT_INTENT_LABELS[intent] ?? intent}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">v{flow.version}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatRelativeTime(flow.updated_at) || "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onEdit(flow)}
                      aria-label={`Edit ${flow.name}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onDelete(flow)}
                      aria-label={`Delete ${flow.name}`}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
