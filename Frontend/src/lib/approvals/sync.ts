import { api } from "@/lib/api";
import { isPendingApproval } from "@/lib/approval-map";
import type { AIApproval, Conversation } from "@/lib/types";
import { useApprovalStore } from "@/stores/approval-store";
import { useConversationStore } from "@/stores/conversation-store";

function markWaitingForApproval(conversationId: string, approval: AIApproval) {
  useApprovalStore.getState().setInconsistent(conversationId, false);
  useApprovalStore.getState().setPendingApproval(approval);
  useConversationStore.getState().patchConversation(conversationId, {
    ai_status: "waiting_for_approval",
    pending_ai_approval: approval,
    updated_at: approval.created_at ?? new Date().toISOString(),
  });
}

function clearWaitingForApproval(conversationId: string) {
  useApprovalStore.getState().setInconsistent(conversationId, false);
  useApprovalStore.getState().clearPendingApproval(conversationId);
  const conversation = useConversationStore
    .getState()
    .conversations.find((item) => item.id === conversationId);
  if (
    conversation?.ai_status === "waiting_for_approval" ||
    conversation?.pending_ai_approval
  ) {
    useConversationStore.getState().patchConversation(conversationId, {
      ai_status: "active",
      pending_ai_approval: null,
    });
  }
}

function resolveEmbeddedApproval(
  conversation: Conversation | undefined,
): AIApproval | null {
  const embedded = conversation?.pending_ai_approval;
  if (embedded && isPendingApproval(embedded)) {
    return embedded;
  }
  return null;
}

/** Seed approval store from conversations already loaded with pending_ai_approval. */
export function seedApprovalsFromConversations(): void {
  const conversations = useConversationStore.getState().conversations;
  for (const conversation of conversations) {
    const approval = resolveEmbeddedApproval(conversation);
    if (approval) {
      useApprovalStore.getState().setPendingApproval(approval);
    }
  }
}

/** Load all pending approvals from backend and hydrate stores. */
export async function hydratePendingApprovals(tenantId: string): Promise<void> {
  seedApprovalsFromConversations();

  const approvals = await api.getPendingApprovals(tenantId);
  useApprovalStore.getState().hydrateApprovals(approvals);

  for (const approval of approvals) {
    if (!isPendingApproval(approval)) continue;
    useConversationStore.getState().patchConversation(approval.conversation_id, {
      ai_status: "waiting_for_approval",
      pending_ai_approval: approval,
      updated_at: approval.created_at ?? new Date().toISOString(),
    });
  }
}

/** Fetch active approval for one conversation (backend source of truth). */
export async function syncConversationApproval(
  conversationId: string,
  tenantId: string,
): Promise<void> {
  const approvalStore = useApprovalStore.getState();
  approvalStore.setInconsistent(conversationId, false);

  const conversation = useConversationStore
    .getState()
    .conversations.find((item) => item.id === conversationId);

  const embedded = resolveEmbeddedApproval(conversation);
  if (embedded) {
    markWaitingForApproval(conversationId, embedded);
    return;
  }

  const cached = approvalStore.getPendingApproval(conversationId);
  if (cached && isPendingApproval(cached)) {
    markWaitingForApproval(conversationId, cached);
    return;
  }

  const approval = await api.getConversationApproval(conversationId, tenantId);
  if (approval && isPendingApproval(approval)) {
    markWaitingForApproval(conversationId, approval);
    return;
  }

  if (conversation?.ai_status === "waiting_for_approval") {
    approvalStore.setInconsistent(conversationId, true);
    return;
  }

  clearWaitingForApproval(conversationId);
}

export function applyConversationApprovalUpdate(conversation: Conversation): void {
  if (conversation.pending_ai_approval) {
    const approval = resolveEmbeddedApproval(conversation);
    if (approval) {
      markWaitingForApproval(conversation.id, approval);
    }
    return;
  }

  if (conversation.pending_ai_approval === null) {
    if (conversation.ai_status === "waiting_for_approval") {
      useApprovalStore.getState().setInconsistent(conversation.id, true);
      return;
    }
    clearWaitingForApproval(conversation.id);
    return;
  }

  if (conversation.ai_status === "waiting_for_approval") {
    const pending = useApprovalStore
      .getState()
      .getPendingApproval(conversation.id);
    if (!pending) {
      useApprovalStore.getState().setInconsistent(conversation.id, true);
    }
    return;
  }

  if (
    conversation.ai_status === "active" ||
    conversation.ai_status === "paused"
  ) {
    clearWaitingForApproval(conversation.id);
  }
}
