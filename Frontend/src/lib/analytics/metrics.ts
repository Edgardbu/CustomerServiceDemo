import type { Channel, Conversation, ConversationStatus, Message } from "@/lib/types";
import { isWaitingForApproval } from "@/lib/ai-status";

export type AnalyticsRange = "today" | "7d" | "30d" | "all";

const CHANNELS: Channel[] = [
  "whatsapp",
  "web_chat",
  "email",
  "sms",
  "facebook",
  "instagram",
];

const STATUSES: ConversationStatus[] = [
  "open",
  "pending",
  "resolved",
  "closed",
];

export interface ChannelMetric {
  channel: Channel;
  count: number;
  percent: number;
}

export interface StatusMetric {
  status: ConversationStatus;
  count: number;
  percent: number;
}

export interface HourlyActivity {
  hour: number;
  label: string;
  count: number;
}

export interface AnalyticsSnapshot {
  totalConversations: number;
  openConversations: number;
  totalMessages: number;
  botMessages: number;
  agentMessages: number;
  customerMessages: number;
  waitingApproval: number;
  aiActive: number;
  autoReplyEnabled: number;
  channelMetrics: ChannelMetric[];
  statusMetrics: StatusMetric[];
  hourlyActivity: HourlyActivity[];
  recentMessages: Array<{
    id: string;
    conversationId: string;
    sender: Message["sender_type"];
    preview: string;
    createdAt: string;
  }>;
}

function rangeStart(range: AnalyticsRange): number | null {
  if (range === "all") return null;
  const now = new Date();
  if (range === "today") {
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
  }
  const days = range === "7d" ? 7 : 30;
  return now.getTime() - days * 24 * 60 * 60 * 1000;
}

function inRange(
  dateString: string | undefined,
  range: AnalyticsRange,
): boolean {
  if (!dateString) return range === "all";
  const start = rangeStart(range);
  if (start === null) return true;
  return new Date(dateString).getTime() >= start;
}

function filterConversations(
  conversations: Conversation[],
  range: AnalyticsRange,
): Conversation[] {
  return conversations.filter((conversation) =>
    inRange(conversation.updated_at ?? conversation.created_at, range),
  );
}

export function buildAnalyticsSnapshot(
  conversations: Conversation[],
  messagesByConversation: Record<string, Message[]>,
  pendingApprovals: number,
  range: AnalyticsRange,
): AnalyticsSnapshot {
  const scoped = filterConversations(conversations, range);
  const total = scoped.length;

  const channelCounts = new Map<Channel, number>();
  for (const channel of CHANNELS) channelCounts.set(channel, 0);
  for (const conversation of scoped) {
    channelCounts.set(
      conversation.channel,
      (channelCounts.get(conversation.channel) ?? 0) + 1,
    );
  }

  const statusCounts = new Map<ConversationStatus, number>();
  for (const status of STATUSES) statusCounts.set(status, 0);
  for (const conversation of scoped) {
    statusCounts.set(
      conversation.status,
      (statusCounts.get(conversation.status) ?? 0) + 1,
    );
  }

  let totalMessages = 0;
  let botMessages = 0;
  let agentMessages = 0;
  let customerMessages = 0;
  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${hour.toString().padStart(2, "0")}:00`,
    count: 0,
  }));
  const recent: AnalyticsSnapshot["recentMessages"] = [];

  for (const conversation of scoped) {
    const messages = messagesByConversation[conversation.id] ?? [];
    for (const message of messages) {
      if (!inRange(message.created_at, range)) continue;
      totalMessages += 1;
      if (message.sender_type === "bot") botMessages += 1;
      if (message.sender_type === "agent") agentMessages += 1;
      if (message.sender_type === "customer") customerMessages += 1;

      const hour = new Date(message.created_at).getHours();
      hourly[hour].count += 1;

      recent.push({
        id: message.id,
        conversationId: conversation.id,
        sender: message.sender_type,
        preview: message.content.slice(0, 120),
        createdAt: message.created_at,
      });
    }
  }

  recent.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  let waitingApproval = 0;
  let aiActive = 0;
  let autoReplyEnabled = 0;
  let openConversations = 0;

  for (const conversation of scoped) {
    if (conversation.status === "open") openConversations += 1;
    if (isWaitingForApproval(conversation)) waitingApproval += 1;
    if (conversation.ai_status === "active") aiActive += 1;
    if (conversation.ai_auto_reply_enabled) autoReplyEnabled += 1;
  }

  waitingApproval = Math.max(waitingApproval, pendingApprovals);

  return {
    totalConversations: total,
    openConversations,
    totalMessages,
    botMessages,
    agentMessages,
    customerMessages,
    waitingApproval,
    aiActive,
    autoReplyEnabled,
    channelMetrics: CHANNELS.map((channel) => {
      const count = channelCounts.get(channel) ?? 0;
      return {
        channel,
        count,
        percent: total > 0 ? (count / total) * 100 : 0,
      };
    }).filter((item) => item.count > 0),
    statusMetrics: STATUSES.map((status) => {
      const count = statusCounts.get(status) ?? 0;
      return {
        status,
        count,
        percent: total > 0 ? (count / total) * 100 : 0,
      };
    }),
    hourlyActivity: hourly,
    recentMessages: recent.slice(0, 10),
  };
}
