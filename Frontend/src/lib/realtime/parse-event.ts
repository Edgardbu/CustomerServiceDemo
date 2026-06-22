import type { AiStatus, AssignedAgent, Channel, Conversation, CustomerProfile, Message, AIApproval } from "@/lib/types";
import { approvalFromApi } from "@/lib/approval-map";
import {
  REALTIME_EVENT_TYPES,
  type RealtimeEvent,
  type RealtimeEventType,
} from "./types";

function isEventType(value: string): value is RealtimeEventType {
  return REALTIME_EVENT_TYPES.includes(value as RealtimeEventType);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function readEventType(raw: Record<string, unknown>): string | null {
  const candidates = [raw.type, raw.event, raw.name];
  for (const candidate of candidates) {
    if (typeof candidate === "string") return candidate;
  }
  return null;
}

function readPayload(raw: Record<string, unknown>): Record<string, unknown> {
  const payload = raw.data ?? raw.payload ?? raw;
  return asRecord(payload) ?? {};
}

function readMessage(value: unknown, conversationId?: string): Message | null {
  const record = asRecord(value);
  if (!record || typeof record.id !== "string") return null;

  return {
    id: record.id,
    conversation_id:
      typeof record.conversation_id === "string"
        ? record.conversation_id
        : (conversationId ?? ""),
    tenant_id:
      typeof record.tenant_id === "string" ? record.tenant_id : undefined,
    sender_type: record.sender_type as Message["sender_type"],
    content: typeof record.content === "string" ? record.content : "",
    attachments: Array.isArray(record.attachments) ? record.attachments : [],
    created_at:
      typeof record.created_at === "string"
        ? record.created_at
        : new Date().toISOString(),
    ai_generated:
      typeof record.ai_generated === "boolean" ? record.ai_generated : undefined,
    external_raw_response: readExternalRawResponse(record.external_raw_response),
  };
}

function readExternalRawResponse(
  value: unknown,
): Message["external_raw_response"] {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const record = asRecord(value);
  if (!record) return undefined;
  return {
    ...record,
    provider:
      typeof record.provider === "string" ? record.provider : undefined,
  };
}

function readApproval(value: unknown): AIApproval | null {
  const record = asRecord(value);
  if (!record || typeof record.id !== "string") return null;
  return approvalFromApi({
    id: record.id,
    conversation_id:
      typeof record.conversation_id === "string" ? record.conversation_id : "",
    tenant_id:
      typeof record.tenant_id === "string" ? record.tenant_id : undefined,
    customer_summary:
      typeof record.customer_summary === "string"
        ? record.customer_summary
        : record.customer_summary === null
          ? null
          : undefined,
    ai_reasoning_summary:
      typeof record.ai_reasoning_summary === "string"
        ? record.ai_reasoning_summary
        : record.ai_reasoning_summary === null
          ? null
          : typeof record.reasoning_summary === "string"
            ? record.reasoning_summary
            : undefined,
    suggested_action_type:
      typeof record.suggested_action_type === "string"
        ? record.suggested_action_type
        : record.suggested_action_type === null
          ? null
          : undefined,
    risk_level:
      typeof record.risk_level === "string"
        ? record.risk_level
        : record.risk_level === null
          ? null
          : undefined,
    suggested_response:
      typeof record.suggested_response === "string"
        ? record.suggested_response
        : "",
    status: typeof record.status === "string" ? record.status : undefined,
    customer_notified_handoff:
      typeof record.customer_notified_handoff === "boolean"
        ? record.customer_notified_handoff
        : undefined,
    created_at:
      typeof record.created_at === "string" ? record.created_at : undefined,
  });
}

function readCustomerProfile(value: unknown): CustomerProfile | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const record = asRecord(value);
  if (!record) return undefined;

  return {
    external_id:
      typeof record.external_id === "string" ? record.external_id : "",
    channel:
      typeof record.channel === "string"
        ? (record.channel as Channel)
        : ("web_chat" as Channel),
    display_name:
      typeof record.display_name === "string"
        ? record.display_name
        : record.display_name === null
          ? null
          : null,
    username:
      typeof record.username === "string"
        ? record.username
        : record.username === null
          ? null
          : null,
    profile_picture_url:
      typeof record.profile_picture_url === "string"
        ? record.profile_picture_url
        : record.profile_picture_url === null
          ? null
          : null,
    agent_label:
      typeof record.agent_label === "string"
        ? record.agent_label
        : record.agent_label === null
          ? null
          : undefined,
    agent_notes:
      typeof record.agent_notes === "string"
        ? record.agent_notes
        : record.agent_notes === null
          ? null
          : undefined,
    profile_overridden:
      typeof record.profile_overridden === "boolean"
        ? record.profile_overridden
        : undefined,
  };
}

function readAiStatus(value: unknown): AiStatus | undefined {
  if (value === null) return null;
  if (
    value === "active" ||
    value === "paused" ||
    value === "waiting_for_approval"
  ) {
    return value;
  }
  return undefined;
}

function readAssignedAgent(value: unknown): AssignedAgent | null | undefined {
  if (value === null) return null;
  const record = asRecord(value);
  if (!record || typeof record.id !== "string") return undefined;
  return {
    id: record.id,
    display_name:
      typeof record.display_name === "string" ? record.display_name : "",
    email: typeof record.email === "string" ? record.email : "",
    role: typeof record.role === "string" ? record.role : "",
    status: typeof record.status === "string" ? record.status : "",
  };
}

function readConversation(value: unknown): Conversation | null {
  const record = asRecord(value);
  if (!record || typeof record.id !== "string") return null;

  const messages = Array.isArray(record.messages)
    ? record.messages
        .map((item) => readMessage(item, record.id as string))
        .filter((item): item is Message => item !== null)
    : undefined;

  return {
    id: record.id,
    tenant_id: typeof record.tenant_id === "string" ? record.tenant_id : "demo",
    customer_id:
      typeof record.customer_id === "string" ? record.customer_id : "unknown",
    channel: record.channel as Conversation["channel"],
    status: (record.status as Conversation["status"]) ?? "open",
    assigned_agent_id:
      typeof record.assigned_agent_id === "string"
        ? record.assigned_agent_id
        : record.assigned_agent_id === null
          ? null
          : undefined,
    assigned_agent: readAssignedAgent(record.assigned_agent),
    tags: Array.isArray(record.tags)
      ? record.tags.filter((tag): tag is string => typeof tag === "string")
      : [],
    customer_profile: readCustomerProfile(record.customer_profile),
    ai_status: readAiStatus(record.ai_status),
    ai_auto_reply_enabled:
      typeof record.ai_auto_reply_enabled === "boolean"
        ? record.ai_auto_reply_enabled
        : record.ai_auto_reply_enabled === null
          ? null
          : undefined,
    pending_ai_approval:
      record.pending_ai_approval === null
        ? null
        : readApproval(record.pending_ai_approval) ?? undefined,
    messages,
    created_at:
      typeof record.created_at === "string" ? record.created_at : undefined,
    updated_at:
      typeof record.updated_at === "string" ? record.updated_at : undefined,
  };
}

export function parseRealtimeEvent(rawData: string): RealtimeEvent | null {
  try {
    const parsed = JSON.parse(rawData) as unknown;
    const root = asRecord(parsed);
    if (!root) return null;

    const type = readEventType(root);
    if (!type || !isEventType(type)) return null;

    const payload = readPayload(root);

    switch (type) {
      case "message.created":
      case "message.sent": {
        const conversationId =
          typeof payload.conversation_id === "string"
            ? payload.conversation_id
            : undefined;
        const message = readMessage(payload.message ?? payload, conversationId);
        if (!message) return null;
        const conversation = readConversation(payload.conversation);
        return {
          type,
          data: {
            message,
            conversation_id: message.conversation_id,
            conversation: conversation ?? undefined,
          },
        };
      }
      case "conversation.created": {
        const conversation = readConversation(
          payload.conversation ?? payload,
        );
        if (!conversation) return null;
        return { type, data: { conversation } };
      }
      case "conversation.updated": {
        const conversation = readConversation(
          payload.conversation ?? payload,
        );
        if (!conversation) return null;
        return { type, data: { conversation } };
      }
      case "conversation.assigned": {
        const conversationId =
          typeof payload.conversation_id === "string"
            ? payload.conversation_id
            : typeof payload.id === "string"
              ? payload.id
              : null;
        if (!conversationId) return null;

        const conversation = readConversation(payload.conversation);
        const assigned =
          payload.assigned_agent_id === null
            ? null
            : typeof payload.assigned_agent_id === "string"
              ? payload.assigned_agent_id
              : (conversation?.assigned_agent_id ?? null);

        return {
          type,
          data: {
            conversation_id: conversationId,
            assigned_agent_id: assigned,
            conversation: conversation ?? undefined,
          },
        };
      }
      case "ai.approval_requested": {
        const approval = readApproval(payload.approval ?? payload);
        if (!approval) return null;
        const conversation = readConversation(payload.conversation);
        return {
          type,
          data: { approval, conversation: conversation ?? undefined },
        };
      }
      case "ai.approval_resolved": {
        const approvalId =
          typeof payload.approval_id === "string"
            ? payload.approval_id
            : typeof payload.id === "string"
              ? payload.id
              : null;
        const conversationId =
          typeof payload.conversation_id === "string"
            ? payload.conversation_id
            : null;
        if (!approvalId || !conversationId) return null;
        const message = readMessage(payload.message, conversationId);
        const conversation = readConversation(payload.conversation);
        return {
          type,
          data: {
            approval_id: approvalId,
            conversation_id: conversationId,
            message: message ?? undefined,
            conversation: conversation ?? undefined,
          },
        };
      }
      case "customer_profile.updated": {
        const channel =
          typeof payload.channel === "string"
            ? (payload.channel as Channel)
            : null;
        const externalId =
          typeof payload.external_id === "string"
            ? payload.external_id
            : null;
        const customerProfile = readCustomerProfile(
          payload.customer_profile ?? payload.profile ?? payload,
        );
        if (!channel || !externalId || !customerProfile) return null;
        return {
          type,
          data: {
            channel,
            external_id: externalId,
            customer_profile: {
              ...customerProfile,
              external_id: customerProfile.external_id || externalId,
              channel: customerProfile.channel || channel,
            },
          },
        };
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}
