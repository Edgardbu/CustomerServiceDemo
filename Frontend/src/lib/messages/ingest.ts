import type { Message } from "@/lib/types";
import { useConversationStore } from "@/stores/conversation-store";
import { useMessageStore } from "@/stores/message-store";

export function mergeMessages(
  ...groups: Array<Message[] | undefined>
): Message[] {
  const byId = new Map<string, Message>();

  for (const group of groups) {
    for (const message of group ?? []) {
      byId.set(message.id, message);
    }
  }

  return [...byId.values()].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

/** Single entry point for every new/updated message (REST, WebSocket, optimistic). */
export function ingestMessage(message: Message): void {
  useMessageStore.getState().addMessage(message);
  useConversationStore
    .getState()
    .applyIncomingMessage(message.conversation_id, message);
}

export function ingestMessages(
  conversationId: string,
  messages: Message[],
): void {
  for (const message of messages) {
    if (message.conversation_id !== conversationId) {
      ingestMessage({ ...message, conversation_id: conversationId });
    } else {
      ingestMessage(message);
    }
  }
}
