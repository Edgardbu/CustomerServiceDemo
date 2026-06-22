import type { Channel } from "./types";

export const TENANT_ID = "demo";

export const CHANNELS: { value: Channel; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "web_chat", label: "Web Chat" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
];
