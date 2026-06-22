import type { Conversation, Message } from "@/lib/types";

export const DEMO_CHANNEL_TAG = "demo_channel";

export function isDemoChannelConversation(
  conversation: Pick<Conversation, "tags">,
): boolean {
  return (conversation.tags ?? []).includes(DEMO_CHANNEL_TAG);
}

export function isSimulatedDemoMessage(message: Message): boolean {
  return message.external_raw_response?.provider === DEMO_CHANNEL_TAG;
}
