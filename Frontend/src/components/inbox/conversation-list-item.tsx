"use client";

import type { Conversation } from "@/lib/types";
import { mergeMessages } from "@/lib/messages/ingest";
import { useConversationMessages } from "@/hooks/use-selected-conversation";
import {
  getCustomerDisplayName,
  getCustomerSubtitle,
} from "@/lib/customer-profile";
import {
  conversationNeedsHumanBadge,
  getAssignedAgentLabel,
  isConversationUnassigned,
} from "@/lib/conversations/queues";
import { useApprovalStore } from "@/stores/approval-store";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CustomerAvatar } from "@/components/ui/customer-avatar";
import { ChannelBadge } from "@/components/inbox/channel-badge";
import { StatusBadge } from "@/components/inbox/status-badge";
import { AssignedAgentBadge } from "@/components/inbox/assigned-agent-badge";
import { UnassignedBadge } from "@/components/inbox/unassigned-badge";
import { NeedsHumanBadge } from "@/components/inbox/needs-human-badge";
import { DemoChannelBadge } from "@/components/inbox/demo-channel-badge";
import { isDemoChannelConversation } from "@/lib/demo-channel";

interface ConversationListItemProps {
  conversation: Conversation;
  active: boolean;
  onSelect: (conversation: Conversation) => void;
}

export function ConversationListItem({
  conversation,
  active,
  onSelect,
}: ConversationListItemProps) {
  const storedMessages = useConversationMessages(conversation.id);
  const messages = mergeMessages(storedMessages, conversation.messages);
  const last = messages[messages.length - 1];
  const preview = last?.content ?? "No messages yet";

  let unreadCount = 0;
  if (!active) {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender_type === "customer") unreadCount++;
      else break;
    }
  }
  const unread = unreadCount > 0;
  const displayName = getCustomerDisplayName(conversation);
  const subtitle = getCustomerSubtitle(conversation);
  const pendingApproval = useApprovalStore(
    (state) => state.pendingByConversation[conversation.id],
  );
  const needsHuman =
    conversationNeedsHumanBadge(conversation) || Boolean(pendingApproval);
  const unassigned = isConversationUnassigned(conversation);
  const assignedName = !unassigned ? getAssignedAgentLabel(conversation) : null;
  const isDemo = isDemoChannelConversation(conversation);

  return (
    <button
      type="button"
      onClick={() => onSelect(conversation)}
      className={cn(
        "group relative flex w-full gap-3 rounded-xl px-3 py-2.5 text-start transition-colors",
        active
          ? "bg-accent/70 ring-1 ring-inset ring-primary/30"
          : "hover:bg-muted/50",
      )}
    >
      {active ? (
        <span className="absolute inset-y-2 -start-0 w-1 rounded-e-full bg-primary" />
      ) : null}

      <CustomerAvatar
        conversation={conversation}
        size="md"
        showChannelDot
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              "truncate text-sm",
              unread ? "font-semibold text-foreground" : "font-medium",
            )}
          >
            {displayName}
          </p>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {formatRelativeTime(
              conversation.updated_at ?? conversation.created_at,
            )}
          </span>
        </div>

        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {subtitle}
        </p>

        <p
          className={cn(
            "mt-0.5 line-clamp-1 text-xs",
            unread ? "text-foreground/80" : "text-muted-foreground",
          )}
          dir="auto"
        >
          {preview}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <ChannelBadge channel={conversation.channel} />
          {isDemo ? <DemoChannelBadge /> : null}
          <StatusBadge status={conversation.status} />
          {needsHuman ? <NeedsHumanBadge /> : null}
          {unassigned ? (
            <UnassignedBadge />
          ) : assignedName ? (
            <AssignedAgentBadge name={assignedName} />
          ) : null}
          {unread ? (
            <span className="ms-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground">
              {unreadCount}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
