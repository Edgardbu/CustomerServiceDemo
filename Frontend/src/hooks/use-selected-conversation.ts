"use client";

import type { Conversation } from "@/lib/types";
import { mergeMessages } from "@/lib/messages/ingest";
import { useConversationStore } from "@/stores/conversation-store";
import { EMPTY_MESSAGES, useMessageStore } from "@/stores/message-store";

export function useConversationMessages(conversationId: string | null) {
  return useMessageStore((state) => {
    if (!conversationId) return EMPTY_MESSAGES;
    return state.byConversation[conversationId] ?? EMPTY_MESSAGES;
  });
}

export function useSelectedConversation(): Conversation | null {
  const selectedId = useConversationStore((state) => state.selectedId);
  const conversation = useConversationStore((state) =>
    selectedId
      ? (state.conversations.find((item) => item.id === selectedId) ?? null)
      : null,
  );
  const storedMessages = useConversationMessages(selectedId);

  if (!conversation) return null;

  return {
    ...conversation,
    messages: mergeMessages(storedMessages, conversation.messages),
  };
}
