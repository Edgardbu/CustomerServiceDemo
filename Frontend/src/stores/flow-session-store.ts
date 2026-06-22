import { create } from "zustand";
import { api } from "@/lib/api";
import { TENANT_ID } from "@/lib/constants";
import type { BotFlowSession } from "@/lib/types";

interface FlowSessionEntry {
  data: BotFlowSession | null;
  loading: boolean;
  error: string | null;
}

interface FlowSessionState {
  byConversation: Record<string, FlowSessionEntry>;
  fetchFlowSession: (conversationId: string, silent?: boolean) => Promise<void>;
  cancelFlowSession: (conversationId: string) => Promise<void>;
  invalidateFlowSession: (conversationId: string) => void;
}

const DEFAULT_ENTRY: FlowSessionEntry = {
  data: null,
  loading: false,
  error: null,
};

export const useFlowSessionStore = create<FlowSessionState>((set, get) => ({
  byConversation: {},

  fetchFlowSession: async (conversationId, silent = false) => {
    set((state) => ({
      byConversation: {
        ...state.byConversation,
        [conversationId]: {
          ...(state.byConversation[conversationId] ?? DEFAULT_ENTRY),
          loading: !silent,
          error: null,
        },
      },
    }));

    try {
      const data = await api.getConversationFlowSession(
        conversationId,
        TENANT_ID,
      );
      set((state) => ({
        byConversation: {
          ...state.byConversation,
          [conversationId]: {
            data,
            loading: false,
            error: null,
          },
        },
      }));
    } catch (err) {
      set((state) => ({
        byConversation: {
          ...state.byConversation,
          [conversationId]: {
            data: null,
            loading: false,
            error:
              err instanceof Error
                ? err.message
                : "Failed to load flow session",
          },
        },
      }));
    }
  },

  cancelFlowSession: async (conversationId) => {
    await api.cancelConversationFlowSession(conversationId, TENANT_ID);
    await get().fetchFlowSession(conversationId, true);
  },

  invalidateFlowSession: (conversationId) => {
    void get().fetchFlowSession(conversationId, true);
  },
}));
