import { create } from "zustand";
import type { AIApproval } from "@/lib/types";

interface ApprovalState {
  pendingByConversation: Record<string, AIApproval>;
  dismissedByConversation: Record<string, boolean>;
  inconsistentByConversation: Record<string, boolean>;

  setPendingApproval: (approval: AIApproval) => void;
  hydrateApprovals: (approvals: AIApproval[]) => void;
  clearPendingApproval: (conversationId: string) => void;
  getPendingApproval: (conversationId: string) => AIApproval | undefined;
  setInconsistent: (conversationId: string, value: boolean) => void;
  isInconsistent: (conversationId: string) => boolean;
  dismissModal: (conversationId: string) => void;
  isModalDismissed: (conversationId: string) => boolean;
  reopenModal: (conversationId: string) => void;
}

export const useApprovalStore = create<ApprovalState>((set, get) => ({
  pendingByConversation: {},
  dismissedByConversation: {},
  inconsistentByConversation: {},

  setPendingApproval: (approval) => {
    set((state) => ({
      pendingByConversation: {
        ...state.pendingByConversation,
        [approval.conversation_id]: approval,
      },
      dismissedByConversation: {
        ...state.dismissedByConversation,
        [approval.conversation_id]: false,
      },
      inconsistentByConversation: {
        ...state.inconsistentByConversation,
        [approval.conversation_id]: false,
      },
    }));
  },

  hydrateApprovals: (approvals) => {
    set((state) => {
      const pendingByConversation = { ...state.pendingByConversation };
      const dismissedByConversation = { ...state.dismissedByConversation };
      const inconsistentByConversation = { ...state.inconsistentByConversation };
      for (const approval of approvals) {
        if (!approval.status || approval.status === "pending") {
          pendingByConversation[approval.conversation_id] = approval;
          dismissedByConversation[approval.conversation_id] = false;
          inconsistentByConversation[approval.conversation_id] = false;
        }
      }
      return {
        pendingByConversation,
        dismissedByConversation,
        inconsistentByConversation,
      };
    });
  },

  clearPendingApproval: (conversationId) => {
    set((state) => {
      const nextPending = { ...state.pendingByConversation };
      const nextDismissed = { ...state.dismissedByConversation };
      const nextInconsistent = { ...state.inconsistentByConversation };
      delete nextPending[conversationId];
      delete nextDismissed[conversationId];
      delete nextInconsistent[conversationId];
      return {
        pendingByConversation: nextPending,
        dismissedByConversation: nextDismissed,
        inconsistentByConversation: nextInconsistent,
      };
    });
  },

  getPendingApproval: (conversationId) =>
    get().pendingByConversation[conversationId],

  setInconsistent: (conversationId, value) => {
    set((state) => ({
      inconsistentByConversation: {
        ...state.inconsistentByConversation,
        [conversationId]: value,
      },
    }));
  },

  isInconsistent: (conversationId) =>
    Boolean(get().inconsistentByConversation[conversationId]),

  dismissModal: (conversationId) => {
    set((state) => ({
      dismissedByConversation: {
        ...state.dismissedByConversation,
        [conversationId]: true,
      },
    }));
  },

  isModalDismissed: (conversationId) =>
    Boolean(get().dismissedByConversation[conversationId]),

  reopenModal: (conversationId) => {
    set((state) => {
      if (!state.dismissedByConversation[conversationId]) return state;
      const next = { ...state.dismissedByConversation };
      delete next[conversationId];
      return { dismissedByConversation: next };
    });
  },
}));
