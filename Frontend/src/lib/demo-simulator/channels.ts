import type { LucideIcon } from "lucide-react";
import {
  Camera,
  Mail,
  MessageCircle,
  MessageSquare,
  Share2,
} from "lucide-react";
import type { DemoSimulatorChannel } from "@/lib/types";

export interface SimulatorChannelOption {
  id: DemoSimulatorChannel;
  label: string;
  icon: LucideIcon;
  accentClass: string;
  customerIdLabel: string;
  customerIdPlaceholder: string;
  defaultCustomerId: string;
  defaultDisplayName: string;
  supportsUsername: boolean;
  supportsEmailSubject: boolean;
}

export const SIMULATOR_CHANNELS: SimulatorChannelOption[] = [
  {
    id: "instagram",
    label: "Instagram",
    icon: Camera,
    accentClass: "from-pink-500 to-rose-500",
    customerIdLabel: "Customer ID",
    customerIdPlaceholder: "17841400000000000",
    defaultCustomerId: "17841400000000000",
    defaultDisplayName: "Instagram User",
    supportsUsername: true,
    supportsEmailSubject: false,
  },
  {
    id: "facebook",
    label: "Messenger",
    icon: Share2,
    accentClass: "from-blue-500 to-sky-500",
    customerIdLabel: "Customer ID",
    customerIdPlaceholder: "120012345678901",
    defaultCustomerId: "120012345678901",
    defaultDisplayName: "Messenger User",
    supportsUsername: true,
    supportsEmailSubject: false,
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: MessageCircle,
    accentClass: "from-emerald-500 to-green-500",
    customerIdLabel: "Phone number",
    customerIdPlaceholder: "+15551234567",
    defaultCustomerId: "+15551234567",
    defaultDisplayName: "WhatsApp Customer",
    supportsUsername: false,
    supportsEmailSubject: false,
  },
  {
    id: "sms",
    label: "SMS",
    icon: MessageSquare,
    accentClass: "from-amber-500 to-orange-500",
    customerIdLabel: "Phone number",
    customerIdPlaceholder: "+15559876543",
    defaultCustomerId: "+15559876543",
    defaultDisplayName: "SMS Customer",
    supportsUsername: false,
    supportsEmailSubject: false,
  },
  {
    id: "email",
    label: "Email",
    icon: Mail,
    accentClass: "from-violet-500 to-purple-500",
    customerIdLabel: "Email address",
    customerIdPlaceholder: "customer@example.com",
    defaultCustomerId: "customer@example.com",
    defaultDisplayName: "Email Customer",
    supportsUsername: false,
    supportsEmailSubject: true,
  },
];

export function getSimulatorChannel(
  id: DemoSimulatorChannel,
): SimulatorChannelOption {
  return SIMULATOR_CHANNELS.find((channel) => channel.id === id)!;
}
