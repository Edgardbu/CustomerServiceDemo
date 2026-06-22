import type { DemoSimulatorChannel } from "@/lib/types";

const STORAGE_KEY = "demo-simulator-sessions";

interface DemoSimulatorSession {
  conversationId: string;
  channel: DemoSimulatorChannel;
  customerId: string;
  updatedAt: string;
}

function readAll(): Record<string, DemoSimulatorSession> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, DemoSimulatorSession>;
  } catch {
    return {};
  }
}

function writeAll(sessions: Record<string, DemoSimulatorSession>): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function getDemoSessionKey(
  channel: DemoSimulatorChannel,
  customerId: string,
): string {
  return `${channel}|${customerId.trim()}`;
}

export function getDemoSessionConversationId(
  channel: DemoSimulatorChannel,
  customerId: string,
): string | null {
  const session = readAll()[getDemoSessionKey(channel, customerId)];
  return session?.conversationId ?? null;
}

export function saveDemoSession(
  channel: DemoSimulatorChannel,
  customerId: string,
  conversationId: string,
): void {
  const key = getDemoSessionKey(channel, customerId);
  const sessions = readAll();
  sessions[key] = {
    conversationId,
    channel,
    customerId: customerId.trim(),
    updatedAt: new Date().toISOString(),
  };
  writeAll(sessions);
}

export function clearDemoSession(
  channel: DemoSimulatorChannel,
  customerId: string,
): void {
  const key = getDemoSessionKey(channel, customerId);
  const sessions = readAll();
  delete sessions[key];
  writeAll(sessions);
}
