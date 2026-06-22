import type { Channel, Conversation } from "@/lib/types";

/** Email address or phone number from profile external_id, falling back to customer_id. */
export function getCustomerContactAddress(conversation: Conversation): string {
  return (
    conversation.customer_profile?.external_id?.trim() ||
    conversation.customer_id.trim()
  );
}

export function isEmailChannel(conversation: Conversation): boolean {
  return conversation.channel === "email";
}

export function isSmsChannel(conversation: Conversation): boolean {
  return conversation.channel === "sms";
}

export function getCustomerContactLabel(channel: Channel): string | null {
  if (channel === "email") return "Email address";
  if (channel === "sms") return "Phone number";
  return null;
}
