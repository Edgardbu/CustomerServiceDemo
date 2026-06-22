import type { Conversation, CustomerProfile } from "./types";
import { getChannelConfig, getDisplayName, getInitials } from "./format";
import {
  getCustomerContactAddress,
  isEmailChannel,
  isSmsChannel,
} from "./channel-contact";

export function mergeCustomerProfile(
  existing: CustomerProfile | null | undefined,
  incoming: CustomerProfile | null | undefined,
): CustomerProfile | null | undefined {
  if (incoming === undefined) return existing;
  if (incoming === null) return existing ?? null;
  if (!existing) return incoming;
  return {
    external_id: incoming.external_id || existing.external_id,
    channel: incoming.channel || existing.channel,
    display_name: incoming.display_name ?? existing.display_name,
    username: incoming.username ?? existing.username,
    profile_picture_url:
      incoming.profile_picture_url ?? existing.profile_picture_url,
    agent_label: incoming.agent_label ?? existing.agent_label,
    agent_notes: incoming.agent_notes ?? existing.agent_notes,
    profile_overridden:
      incoming.profile_overridden ?? existing.profile_overridden,
  };
}

export function getCustomerDisplayName(conversation: Conversation): string {
  const profile = conversation.customer_profile;
  if (profile?.display_name?.trim()) return profile.display_name.trim();
  if (profile?.username?.trim()) {
    const username = profile.username.replace(/^@/, "").trim();
    return username;
  }
  return getDisplayName(conversation.customer_id, conversation.channel);
}

export function getCustomerUsername(conversation: Conversation): string {
  const profile = conversation.customer_profile;
  if (isEmailChannel(conversation)) {
    return getCustomerContactAddress(conversation);
  }
  if (isSmsChannel(conversation)) {
    return getCustomerContactAddress(conversation);
  }
  if (profile?.username?.trim()) {
    const username = profile.username.replace(/^@/, "").trim();
    return `@${username}`;
  }
  return conversation.customer_id;
}

/** Subtitle for list rows: contact address on SMS/email, @username on social, else customer id. */
export function getCustomerSubtitle(conversation: Conversation): string {
  if (isEmailChannel(conversation) || isSmsChannel(conversation)) {
    return getCustomerContactAddress(conversation);
  }
  const profile = conversation.customer_profile;
  if (profile?.username?.trim()) {
    return `@${profile.username.replace(/^@/, "").trim()}`;
  }
  return conversation.customer_id;
}

export function getCustomerAvatarUrl(
  conversation: Conversation,
): string | null {
  const url = conversation.customer_profile?.profile_picture_url?.trim();
  return url || null;
}

export function getCustomerInitials(conversation: Conversation): string {
  const profile = conversation.customer_profile;
  const fromProfile =
    profile?.display_name?.trim() ||
    profile?.username?.replace(/^@/, "").trim() ||
    "";
  const source = fromProfile || conversation.customer_id;
  return getInitials(source) || "?";
}

export function getCustomerExternalId(conversation: Conversation): string {
  return (
    conversation.customer_profile?.external_id?.trim() ||
    conversation.customer_id
  );
}

export function getCustomerSearchText(conversation: Conversation): string {
  const profile = conversation.customer_profile;
  return [
    conversation.customer_id,
    conversation.id,
    profile?.external_id,
    profile?.display_name,
    profile?.username,
    profile?.agent_label,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function mergeConversation(
  existing: Conversation,
  incoming: Conversation,
): Conversation {
  return {
    ...existing,
    ...incoming,
    id: existing.id,
    messages: incoming.messages ?? existing.messages,
    assigned_agent:
      incoming.assigned_agent !== undefined
        ? incoming.assigned_agent
        : existing.assigned_agent,
    customer_profile: mergeCustomerProfile(
      existing.customer_profile,
      incoming.customer_profile,
    ),
  };
}
