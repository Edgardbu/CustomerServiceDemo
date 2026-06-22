import type { AiStatus, Conversation } from "./types";

export function isWaitingForApproval(conversation: Conversation): boolean {
  return (
    conversation.ai_status === "waiting_for_approval" ||
    Boolean(conversation.pending_ai_approval)
  );
}

export function isAiPaused(conversation: Conversation): boolean {
  if (conversation.ai_status === "paused") return true;
  if (conversation.ai_auto_reply_enabled === false) return true;
  return false;
}

export function resolveAiRuntimeStatus(conversation: Conversation): AiStatus {
  if (
    conversation.ai_status === "active" ||
    conversation.ai_status === "paused" ||
    conversation.ai_status === "waiting_for_approval"
  ) {
    return conversation.ai_status;
  }
  if (conversation.pending_ai_approval) return "waiting_for_approval";
  if (conversation.ai_auto_reply_enabled === false) return "paused";
  return "active";
}

export function aiRuntimeStatusLabel(status: AiStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "paused":
      return "Paused";
    case "waiting_for_approval":
      return "Waiting for approval";
    default:
      return "Unknown";
  }
}
