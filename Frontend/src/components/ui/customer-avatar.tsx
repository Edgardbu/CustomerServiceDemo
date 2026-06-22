import type { Conversation } from "@/lib/types";
import {
  getCustomerAvatarUrl,
  getCustomerDisplayName,
  getCustomerInitials,
} from "@/lib/customer-profile";
import { ContactAvatar } from "@/components/ui/contact-avatar";

interface CustomerAvatarProps {
  conversation: Conversation;
  size?: "sm" | "md" | "lg" | "xl";
  showChannelDot?: boolean;
  ring?: boolean;
  className?: string;
}

export function CustomerAvatar({
  conversation,
  size = "md",
  showChannelDot = false,
  ring = false,
  className,
}: CustomerAvatarProps) {
  const displayName = getCustomerDisplayName(conversation);
  return (
    <ContactAvatar
      name={displayName}
      initials={getCustomerInitials(conversation)}
      imageUrl={getCustomerAvatarUrl(conversation)}
      channel={conversation.channel}
      size={size}
      showChannelDot={showChannelDot}
      ring={ring}
      className={className}
    />
  );
}
