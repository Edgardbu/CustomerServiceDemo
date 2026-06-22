import { create } from "zustand";
import type { Message } from "@/lib/types";

const EMPTY_MESSAGES: Message[] = [];

function sortMessages(messages: Message[]): Message[] {
  return [...messages].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

interface MessageState {
  byConversation: Record<string, Message[]>;
  setMessages: (conversationId: string, messages: Message[]) => void;
  addMessage: (message: Message) => void;
  getMessages: (conversationId: string) => Message[];
  hydrateFromConversations: (
    conversations: Array<{ id: string; messages?: Message[] }>,
  ) => void;
  clear: () => void;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  byConversation: {},

  setMessages: (conversationId, messages) => {
    set((state) => ({
      byConversation: {
        ...state.byConversation,
        [conversationId]: sortMessages(messages),
      },
    }));
  },

  addMessage: (message) => {
    set((state) => {
      const existing = state.byConversation[message.conversation_id] ?? [];
      if (existing.some((item) => item.id === message.id)) {
        return state;
      }

      return {
        byConversation: {
          ...state.byConversation,
          [message.conversation_id]: sortMessages([...existing, message]),
        },
      };
    });
  },

  getMessages: (conversationId) =>
    get().byConversation[conversationId] ?? EMPTY_MESSAGES,

  hydrateFromConversations: (conversations) => {
    set((state) => {
      const next = { ...state.byConversation };
      for (const conversation of conversations) {
        if (conversation.messages?.length) {
          const existing = next[conversation.id] ?? [];
          const byId = new Map(existing.map((item) => [item.id, item]));
          for (const message of conversation.messages) {
            byId.set(message.id, message);
          }
          next[conversation.id] = sortMessages([...byId.values()]);
        }
      }
      return { byConversation: next };
    });
  },

  clear: () => set({ byConversation: {} }),
}));

export { EMPTY_MESSAGES };
