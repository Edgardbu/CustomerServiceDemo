import type { Conversation } from "@/lib/types";
import type { ConversationQueue } from "@/lib/types";
import { isWaitingForApproval } from "@/lib/ai-status";

export const CONVERSATION_QUEUES: {
  value: ConversationQueue;
  label: string;
  description: string;
}[] = [
  {
    value: "human_needed",
    label: "Needs human",
    description: "Handoffs, approvals, and unassigned open conversations",
  },
  {
    value: "unassigned",
    label: "Unassigned",
    description: "Conversations no one has claimed yet",
  },
  {
    value: "mine",
    label: "Mine",
    description: "Conversations assigned to you",
  },
  {
    value: "all",
    label: "All",
    description: "Every conversation in the workspace",
  },
  {
    value: "resolved",
    label: "Resolved",
    description: "Closed and resolved conversations",
  },
];

export function isConversationUnassigned(conversation: Conversation): boolean {
  return !conversation.assigned_agent_id && !conversation.assigned_agent;
}

export function conversationNeedsHumanBadge(
  conversation: Conversation,
): boolean {
  const tags = conversation.tags ?? [];
  if (tags.includes("handoff_to_human")) return true;
  return isWaitingForApproval(conversation);
}

export function isResolvedConversation(conversation: Conversation): boolean {
  return (
    conversation.status === "resolved" || conversation.status === "closed"
  );
}

export function belongsInQueue(
  conversation: Conversation,
  queue: ConversationQueue,
  currentUserId: string | null,
): boolean {
  switch (queue) {
    case "all":
      return true;
    case "resolved":
      return isResolvedConversation(conversation);
    case "mine":
      return (
        !!currentUserId && conversation.assigned_agent_id === currentUserId
      );
    case "unassigned":
      return (
        isConversationUnassigned(conversation) &&
        !isResolvedConversation(conversation)
      );
    case "human_needed": {
      if (isResolvedConversation(conversation)) return false;
      if (conversationNeedsHumanBadge(conversation)) return true;
      return (
        isConversationUnassigned(conversation) &&
        conversation.status === "open"
      );
    }
    default:
      return true;
  }
}

export function getAssignedAgentLabel(conversation: Conversation): string {
  if (conversation.assigned_agent?.display_name) {
    return conversation.assigned_agent.display_name;
  }
  if (conversation.assigned_agent_id) {
    return conversation.assigned_agent_id;
  }
  return "Unassigned";
}

export function getDefaultQueueForRole(
  role?: string | null,
): ConversationQueue {
  if (role === "viewer" || role === "owner" || role === "admin") {
    return role === "viewer" ? "all" : "human_needed";
  }
  return "human_needed";
}

export function getAvailableQueues(
  role?: string | null,
): ConversationQueue[] {
  if (role === "agent") {
    return ["human_needed", "unassigned", "mine", "resolved"];
  }
  return ["human_needed", "unassigned", "mine", "all", "resolved"];
}
