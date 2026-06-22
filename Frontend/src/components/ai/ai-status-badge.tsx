import { cn } from "@/lib/utils";
import type { Conversation } from "@/lib/types";
import {
  aiRuntimeStatusLabel,
  resolveAiRuntimeStatus,
} from "@/lib/ai-status";

interface AIStatusBadgeProps {
  conversation: Conversation;
  className?: string;
}

export function AIStatusBadge({ conversation, className }: AIStatusBadgeProps) {
  const status = resolveAiRuntimeStatus(conversation);
  const waiting = status === "waiting_for_approval";
  const paused = status === "paused";
  const label = aiRuntimeStatusLabel(status);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        waiting
          ? "bg-amber-500/12 text-amber-600 ring-amber-500/25 dark:text-amber-300"
          : paused
            ? "bg-muted text-muted-foreground ring-border"
            : "bg-violet-500/12 text-violet-600 ring-violet-500/25 dark:text-violet-300",
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          waiting
            ? "bg-amber-500"
            : paused
              ? "bg-muted-foreground"
              : "bg-violet-500",
        )}
      />
      {label}
    </span>
  );
}
