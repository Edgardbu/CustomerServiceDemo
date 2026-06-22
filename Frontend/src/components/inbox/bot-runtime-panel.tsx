"use client";

import { useState } from "react";
import { ChevronDown, Loader2, RefreshCw, XCircle } from "lucide-react";
import type { Conversation } from "@/lib/types";
import { BOT_RUNTIME_TAGS } from "@/lib/types";
import {
  aiRuntimeStatusLabel,
  resolveAiRuntimeStatus,
} from "@/lib/ai-status";
import { formatRelativeTime } from "@/lib/format";
import { useFlowSession } from "@/hooks/use-flow-session";
import { useFlowSessionStore } from "@/stores/flow-session-store";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BotRuntimePanelProps {
  conversation: Conversation;
}

const BOT_TAG_LABELS: Record<(typeof BOT_RUNTIME_TAGS)[number], string> = {
  waiting_for_ai_approval: "Waiting for AI approval",
  handoff_to_human: "Handoff to human",
};

function sessionStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "Active";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "handed_off":
      return "Handed off";
    default:
      return status;
  }
}

function AiRuntimeBadge({ conversation }: { conversation: Conversation }) {
  const status = resolveAiRuntimeStatus(conversation);
  const label = aiRuntimeStatusLabel(status);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        status === "waiting_for_approval"
          ? "bg-amber-500/12 text-amber-600 ring-amber-500/25 dark:text-amber-300"
          : status === "paused"
            ? "bg-muted text-muted-foreground ring-border"
            : "bg-violet-500/12 text-violet-600 ring-violet-500/25 dark:text-violet-300",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "waiting_for_approval"
            ? "bg-amber-500"
            : status === "paused"
              ? "bg-muted-foreground"
              : "bg-violet-500",
        )}
      />
      {label}
    </span>
  );
}

export function BotRuntimePanel({ conversation }: BotRuntimePanelProps) {
  const { showSuccess, showError } = useToast();
  const { session, loading, error, refresh } = useFlowSession(conversation.id);
  const cancelFlowSession = useFlowSessionStore(
    (state) => state.cancelFlowSession,
  );

  const [stateOpen, setStateOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const activeSession = session?.status === "active" ? session : null;
  const stateJson = JSON.stringify(session?.state ?? {}, null, 2);
  const conversationTags = new Set(conversation.tags ?? []);
  const autoReplyEnabled = conversation.ai_auto_reply_enabled !== false;

  async function handleCancelFlow() {
    setCancelling(true);
    try {
      await cancelFlowSession(conversation.id);
      showSuccess("Flow cancelled", "The active bot flow was stopped.");
    } catch (err) {
      showError(
        "Cancel failed",
        err instanceof Error ? err.message : "Failed to cancel flow session",
      );
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-border bg-card/50 p-3">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            AI status
          </p>
          <AiRuntimeBadge conversation={conversation} />
        </div>

        <MetaRow
          label="Auto reply"
          value={autoReplyEnabled ? "Enabled" : "Disabled"}
          valueClassName={
            autoReplyEnabled
              ? "text-emerald-600 dark:text-emerald-300"
              : "text-muted-foreground"
          }
        />

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Bot tags
          </p>
          <div className="flex flex-wrap gap-1.5">
            {BOT_RUNTIME_TAGS.map((tag) => {
              const active = conversationTags.has(tag);
              return (
                <span
                  key={tag}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset",
                    active
                      ? "bg-primary/12 text-primary ring-primary/25"
                      : "bg-muted/40 text-muted-foreground ring-border",
                  )}
                >
                  {BOT_TAG_LABELS[tag]}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Flow session
          </p>
          <div className="flex items-center gap-1">
            {activeSession ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void handleCancelFlow()}
                disabled={cancelling || loading}
                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
              >
                {cancelling ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <XCircle className="size-3.5" />
                )}
                Cancel flow
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={refresh}
              disabled={loading || cancelling}
              aria-label="Refresh flow session"
            >
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
            </Button>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}

        {loading && !session ? (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-4 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Loading flow session…
          </div>
        ) : activeSession ? (
          <div className="space-y-2 rounded-xl border border-border bg-card/50 p-3">
            <MetaRow label="Flow name" value={activeSession.flow_name ?? "—"} />
            <MetaRow
              label="Current node"
              value={activeSession.current_node_id ?? "—"}
              mono
            />
            <MetaRow
              label="Status"
              value={sessionStatusLabel(activeSession.status)}
            />
            <MetaRow
              label="Updated"
              value={formatRelativeTime(activeSession.updated_at) || "—"}
            />

            <div className="pt-1">
              <button
                type="button"
                onClick={() => setStateOpen((open) => !open)}
                className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2 text-start text-xs font-medium transition-colors hover:bg-muted/40"
              >
                Session state
                <ChevronDown
                  className={cn(
                    "size-3.5 text-muted-foreground transition-transform",
                    stateOpen ? "" : "-rotate-90",
                  )}
                />
              </button>
              {stateOpen ? (
                <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-border bg-background p-3 font-mono text-[11px] leading-relaxed text-foreground/90">
                  {stateJson}
                </pre>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
            No active bot flow
          </p>
        )}
      </div>
    </div>
  );
}

function MetaRow({
  label,
  value,
  mono,
  valueClassName,
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-end text-xs font-medium text-foreground",
          mono && "font-mono",
          valueClassName,
        )}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}
