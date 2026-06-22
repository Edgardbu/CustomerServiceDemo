import type { Channel, CustomerProfile } from "@/lib/types";
import { useConversationStore } from "@/stores/conversation-store";

export function conversationMatchesCustomerIdentity(
  conversation: {
    channel: Channel;
    customer_id: string;
    customer_profile?: CustomerProfile | null;
  },
  channel: Channel,
  externalId: string,
): boolean {
  const normalized = externalId.trim();
  if (!normalized || conversation.channel !== channel) return false;

  const profileExternalId = conversation.customer_profile?.external_id?.trim();
  return (
    profileExternalId === normalized || conversation.customer_id.trim() === normalized
  );
}

export function applyCustomerProfileByIdentity(
  channel: Channel,
  externalId: string,
  profile: CustomerProfile,
): void {
  useConversationStore
    .getState()
    .applyCustomerProfileByIdentity(channel, externalId, profile);
}
