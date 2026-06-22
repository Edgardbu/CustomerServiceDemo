import type { Conversation, TenantUserRole } from "@/lib/types";
import { isConversationUnassigned } from "@/lib/conversations/queues";

export function canEditCustomerProfile(
  role?: TenantUserRole | null,
): boolean {
  return !!role && role !== "viewer";
}

export function canReplyToConversation(role?: TenantUserRole | null): boolean {
  return role !== "viewer";
}

export function canClaimConversation(
  role: TenantUserRole | null | undefined,
  conversation: Conversation,
): boolean {
  if (!role || role === "viewer") return false;
  if (!isConversationUnassigned(conversation)) return false;
  return role === "agent" || role === "admin" || role === "owner";
}

export function canAssignConversation(
  role: TenantUserRole | null | undefined,
): boolean {
  return role === "admin" || role === "owner";
}

export function canTransferConversation(
  role: TenantUserRole | null | undefined,
  conversation: Conversation,
  currentUserId: string | null,
): boolean {
  if (!role || role === "viewer") return false;
  if (role === "admin" || role === "owner") {
    return !!conversation.assigned_agent_id;
  }
  if (role === "agent") {
    return (
      !!currentUserId && conversation.assigned_agent_id === currentUserId
    );
  }
  return false;
}

export function isAssignedToCurrentUser(
  conversation: Conversation,
  currentUserId: string | null,
): boolean {
  return (
    !!currentUserId && conversation.assigned_agent_id === currentUserId
  );
}

export function isAssignableAgentRole(role: string): boolean {
  return role === "agent" || role === "admin" || role === "owner";
}
