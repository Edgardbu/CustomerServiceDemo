import type { Channel } from "@/lib/types";
import { getChannelConfig } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Camera,
  Globe,
  Mail,
  MessageCircle,
  MessageSquare,
  Share2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const channelIcons: Record<Channel, LucideIcon> = {
  whatsapp: MessageCircle,
  web_chat: Globe,
  email: Mail,
  sms: MessageSquare,
  facebook: Share2,
  instagram: Camera,
};

interface ChannelBadgeProps {
  channel: Channel;
  className?: string;
}

export function ChannelBadge({ channel, className }: ChannelBadgeProps) {
  const config = getChannelConfig(channel);
  const Icon = channelIcons[channel];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
        config.className,
        className,
      )}
    >
      <Icon className="size-3" />
      {config.label}
    </span>
  );
}
