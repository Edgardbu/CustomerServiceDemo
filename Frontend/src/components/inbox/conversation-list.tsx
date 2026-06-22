"use client";

import { Plus, RefreshCw, Sparkles } from "lucide-react";
import { CHANNELS } from "@/lib/constants";
import type { Channel, Conversation, ConversationQueue } from "@/lib/types";
import { CONVERSATION_QUEUES, getAvailableQueues } from "@/lib/conversations/queues";
import { cn } from "@/lib/utils";
import { ConversationListItem } from "@/components/inbox/conversation-list-item";
import { EmptyState } from "@/components/inbox/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  loading: boolean;
  refreshing?: boolean;
  error: string | null;
  queueFilter: ConversationQueue;
  channelFilter: Channel | "all";
  currentUserRole?: string | null;
  aiSuggestionsToday: number;
  creating: boolean;
  onSelect: (conversation: Conversation) => void;
  onQueueFilterChange: (queue: ConversationQueue) => void;
  onChannelFilterChange: (channel: Channel | "all") => void;
  onCreateDemo: () => void;
  onRefresh: () => void;
}

export function ConversationList({
  conversations,
  selectedId,
  loading,
  refreshing = false,
  error,
  queueFilter,
  channelFilter,
  currentUserRole,
  aiSuggestionsToday,
  creating,
  onSelect,
  onQueueFilterChange,
  onChannelFilterChange,
  onCreateDemo,
  onRefresh,
}: ConversationListProps) {
  const visibleQueues = CONVERSATION_QUEUES.filter((tab) =>
    getAvailableQueues(currentUserRole).includes(tab.value),
  );

  const activeQueue = visibleQueues.find((tab) => tab.value === queueFilter);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden border-e border-border bg-card/40">
      <div className="flex items-center justify-between gap-2 px-3.5 pb-2 pt-3">
        <h2 className="text-sm font-semibold tracking-tight">Inbox</h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRefresh}
            disabled={loading || refreshing}
            aria-label="Refresh conversations"
          >
            <RefreshCw
              className={cn("size-4", (loading || refreshing) && "animate-spin")}
            />
          </Button>
          <Button size="sm" onClick={onCreateDemo} disabled={creating || loading}>
            <Plus className="size-4" />
            New
          </Button>
        </div>
      </div>

      <div className="scrollbar-none flex gap-1 overflow-x-auto px-3 pb-2">
        {visibleQueues.map((tab) => {
          const isActive = queueFilter === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => onQueueFilterChange(tab.value)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                isActive
                  ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/30"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
              title={tab.description}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeQueue ? (
        <p className="px-3.5 pb-2 text-[11px] text-muted-foreground">
          {activeQueue.description}
        </p>
      ) : null}

      <div className="px-3 pb-2">
        <Select
          value={channelFilter}
          onValueChange={(value) => {
            if (!value || value === channelFilter) return;
            onChannelFilterChange(value as Channel | "all");
          }}
        >
          <SelectTrigger className="h-8 w-full text-xs" size="sm">
            <SelectValue placeholder="All channels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All channels</SelectItem>
            {CHANNELS.map((channel) => (
              <SelectItem key={channel.value} value={channel.value}>
                {channel.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <div className="mx-3 mb-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {loading ? (
          <div className="space-y-1 p-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex gap-3 rounded-xl px-3 py-2.5">
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <EmptyState
            title="No conversations"
            description={
              activeQueue
                ? `Nothing in ${activeQueue.label.toLowerCase()} right now. New items appear here in real time.`
                : "New customer messages arrive here in real time."
            }
            action={
              <Button onClick={onCreateDemo} disabled={creating}>
                <Plus className="size-4" />
                Create demo conversation
              </Button>
            }
          />
        ) : (
          <ul className="space-y-0.5">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <ConversationListItem
                  conversation={conversation}
                  active={conversation.id === selectedId}
                  onSelect={onSelect}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-1.5 border-t border-border px-3.5 py-2 text-[11px] text-muted-foreground">
        <Sparkles className="size-3 text-violet-400" />
        {aiSuggestionsToday} AI suggestion{aiSuggestionsToday === 1 ? "" : "s"} today
      </div>
    </div>
  );
}
