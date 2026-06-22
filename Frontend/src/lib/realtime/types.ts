import type { AIApproval, Conversation, CustomerProfile, Message } from "@/lib/types";

export type RealtimeConnectionStatus =
  | "connected"
  | "reconnecting"
  | "disconnected";

export type RealtimeEventType =
  | "message.created"
  | "message.sent"
  | "conversation.created"
  | "conversation.updated"
  | "conversation.assigned"
  | "ai.approval_requested"
  | "ai.approval_resolved"
  | "customer_profile.updated";

export interface MessageCreatedEvent {
  type: "message.created";
  data: {
    message: Message;
    conversation_id: string;
    conversation?: Conversation;
  };
}

export interface MessageSentEvent {
  type: "message.sent";
  data: {
    message: Message;
    conversation_id: string;
    conversation?: Conversation;
  };
}

export interface ConversationCreatedEvent {
  type: "conversation.created";
  data: {
    conversation: Conversation;
  };
}

export interface ConversationUpdatedEvent {
  type: "conversation.updated";
  data: {
    conversation: Conversation;
  };
}

export interface ConversationAssignedEvent {
  type: "conversation.assigned";
  data: {
    conversation_id: string;
    assigned_agent_id: string | null;
    conversation?: Conversation;
  };
}

export interface AIApprovalRequestedEvent {
  type: "ai.approval_requested";
  data: {
    approval: AIApproval;
    conversation?: Conversation;
  };
}

export interface AIApprovalResolvedEvent {
  type: "ai.approval_resolved";
  data: {
    approval_id: string;
    conversation_id: string;
    message?: Message;
    conversation?: Conversation;
  };
}

export interface CustomerProfileUpdatedEvent {
  type: "customer_profile.updated";
  data: {
    channel: Conversation["channel"];
    external_id: string;
    customer_profile: CustomerProfile;
  };
}

export type RealtimeEvent =
  | MessageCreatedEvent
  | MessageSentEvent
  | ConversationCreatedEvent
  | ConversationUpdatedEvent
  | ConversationAssignedEvent
  | AIApprovalRequestedEvent
  | AIApprovalResolvedEvent
  | CustomerProfileUpdatedEvent;

export const REALTIME_EVENT_TYPES: RealtimeEventType[] = [
  "message.created",
  "message.sent",
  "conversation.created",
  "conversation.updated",
  "conversation.assigned",
  "ai.approval_requested",
  "ai.approval_resolved",
  "customer_profile.updated",
];

export interface RealtimeContextValue {
  status: RealtimeConnectionStatus;
  lastEventAt: Date | null;
}
