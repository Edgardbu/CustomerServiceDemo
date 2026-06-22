import type { Channel, ConversationStatus } from "./types";

interface BadgeConfig {
  label: string;
  className: string;
  dotClass: string;
}

const channelConfig: Record<Channel, BadgeConfig> = {
  whatsapp: {
    label: "WhatsApp",
    className:
      "bg-emerald-500/12 text-emerald-600 ring-1 ring-inset ring-emerald-500/25 dark:text-emerald-300",
    dotClass: "bg-emerald-500",
  },
  web_chat: {
    label: "Web Chat",
    className:
      "bg-sky-500/12 text-sky-600 ring-1 ring-inset ring-sky-500/25 dark:text-sky-300",
    dotClass: "bg-sky-500",
  },
  email: {
    label: "Email",
    className:
      "bg-violet-500/12 text-violet-600 ring-1 ring-inset ring-violet-500/25 dark:text-violet-300",
    dotClass: "bg-violet-500",
  },
  sms: {
    label: "SMS",
    className:
      "bg-amber-500/12 text-amber-600 ring-1 ring-inset ring-amber-500/25 dark:text-amber-300",
    dotClass: "bg-amber-500",
  },
  facebook: {
    label: "Facebook",
    className:
      "bg-blue-500/12 text-blue-600 ring-1 ring-inset ring-blue-500/25 dark:text-blue-300",
    dotClass: "bg-blue-500",
  },
  instagram: {
    label: "Instagram",
    className:
      "bg-pink-500/12 text-pink-600 ring-1 ring-inset ring-pink-500/25 dark:text-pink-300",
    dotClass: "bg-pink-500",
  },
};

const statusConfig: Record<ConversationStatus, BadgeConfig> = {
  open: {
    label: "Open",
    className:
      "bg-emerald-500/12 text-emerald-600 ring-1 ring-inset ring-emerald-500/25 dark:text-emerald-300",
    dotClass: "bg-emerald-500",
  },
  pending: {
    label: "Pending",
    className:
      "bg-amber-500/12 text-amber-600 ring-1 ring-inset ring-amber-500/25 dark:text-amber-300",
    dotClass: "bg-amber-500",
  },
  resolved: {
    label: "Resolved",
    className:
      "bg-sky-500/12 text-sky-600 ring-1 ring-inset ring-sky-500/25 dark:text-sky-300",
    dotClass: "bg-sky-500",
  },
  closed: {
    label: "Closed",
    className:
      "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
    dotClass: "bg-muted-foreground",
  },
};

export function getChannelConfig(channel: Channel) {
  return channelConfig[channel];
}

export function getStatusConfig(status: ConversationStatus) {
  return statusConfig[status];
}

export function formatRelativeTime(dateString?: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function getInitials(name: string): string {
  return name
    .split(/[\s_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Build a friendly, human-readable display name from a raw customer id.
 * e.g. "16432729634402949" + instagram -> "Instagram User #2949"
 * Real names (containing a space) are passed through untouched.
 */
export function getDisplayName(customerId: string, channel?: Channel): string {
  const trimmed = (customerId ?? "").trim();
  if (!trimmed) return "Unknown customer";
  if (/\s/.test(trimmed)) return trimmed;
  if (channel === "email" && trimmed.includes("@")) return trimmed;
  if (channel === "sms" && /^\+?[\d\s().-]+$/.test(trimmed)) return trimmed;

  const digits = trimmed.match(/(\d{2,})\s*$/)?.[1];
  const channelLabel = channel ? channelConfig[channel].label : "Customer";
  if (digits) {
    const short = digits.length > 4 ? digits.slice(-4) : digits;
    return `${channelLabel} User #${short}`;
  }
  return trimmed
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatMessageTime(dateString?: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function getDayKey(dateString?: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatDateSeparator(dateString?: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}
