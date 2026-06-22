import type { Conversation } from "@/lib/types";
import { belongsInQueue } from "@/lib/conversations/queues";
import { getAssignedAgentLabel } from "@/lib/conversations/queues";
import { emitToast } from "@/lib/toast-bus";
import { useConversationStore } from "@/stores/conversation-store";
import { useCurrentUserStore } from "@/stores/current-user-store";

interface QueueSyncOptions {
  toTop?: boolean;
  showAssignmentToast?: boolean;
}

function getPreviousAssignment(conversationId: string): string | null {
  const existing = useConversationStore
    .getState()
    .conversations.find((item) => item.id === conversationId);
  return existing?.assigned_agent_id ?? null;
}

function maybeShowAssignmentToast(
  conversation: Conversation,
  previousAssignedAgentId: string | null,
): void {
  const currentUserId = useCurrentUserStore.getState().selectedUserId;
  const nextAssignedAgentId = conversation.assigned_agent_id ?? null;

  if (previousAssignedAgentId === nextAssignedAgentId) return;

  if (nextAssignedAgentId && nextAssignedAgentId === currentUserId) {
    emitToast({
      title: "Assigned to you",
      description: getAssignedAgentLabel(conversation),
    });
    return;
  }

  if (
    previousAssignedAgentId === currentUserId &&
    nextAssignedAgentId &&
    nextAssignedAgentId !== currentUserId
  ) {
    emitToast({
      title: "Conversation transferred",
      description: `Now assigned to ${getAssignedAgentLabel(conversation)}`,
    });
    return;
  }

  if (!previousAssignedAgentId && nextAssignedAgentId) {
    emitToast({
      title: "Conversation claimed",
      description: getAssignedAgentLabel(conversation),
    });
  }
}

export function applyQueueAwareConversationUpdate(
  conversation: Conversation,
  options: QueueSyncOptions = {},
): void {
  const store = useConversationStore.getState();
  const queue = store.queueFilter;
  const currentUserId = useCurrentUserStore.getState().selectedUserId;
  const inList = store.conversations.some((item) => item.id === conversation.id);
  const belongs = belongsInQueue(conversation, queue, currentUserId);
  const previousAssignedAgentId = getPreviousAssignment(conversation.id);

  if (options.showAssignmentToast) {
    maybeShowAssignmentToast(conversation, previousAssignedAgentId);
  }

  if (belongs) {
    store.upsertConversation(
      { ...conversation, messages: conversation.messages ?? undefined },
      { toTop: options.toTop ?? true },
    );
    return;
  }

  if (inList) {
    store.removeConversation(conversation.id);
  }
}

export function patchQueueAwareConversation(
  conversationId: string,
  patch: Partial<Conversation>,
  options: QueueSyncOptions = {},
): void {
  const store = useConversationStore.getState();
  const existing = store.conversations.find((item) => item.id === conversationId);
  if (!existing) return;

  const merged: Conversation = {
    ...existing,
    ...patch,
    id: existing.id,
    messages: existing.messages,
    assigned_agent:
      patch.assigned_agent !== undefined
        ? patch.assigned_agent
        : existing.assigned_agent,
    customer_profile:
      patch.customer_profile !== undefined
        ? patch.customer_profile
        : existing.customer_profile,
  };

  applyQueueAwareConversationUpdate(merged, options);
}
