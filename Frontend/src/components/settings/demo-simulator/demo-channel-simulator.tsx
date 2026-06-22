"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Inbox,
  Loader2,
  MessageSquarePlus,
  Send,
  Shield,
} from "lucide-react";
import { api } from "@/lib/api";
import { TENANT_ID } from "@/lib/constants";
import type { DemoChannelInboundRequest, DemoSimulatorChannel } from "@/lib/types";
import {
  getStoredDemoChannelSecret,
  setStoredDemoChannelSecret,
} from "@/lib/demo-channel-secret";
import {
  SIMULATOR_CHANNELS,
  getSimulatorChannel,
} from "@/lib/demo-simulator/channels";
import {
  clearDemoSession,
  getDemoSessionConversationId,
  saveDemoSession,
} from "@/lib/demo-simulator/session";
import { useConversationMessages } from "@/hooks/use-selected-conversation";
import { ingestMessages } from "@/lib/messages/ingest";
import { useConversationStore } from "@/stores/conversation-store";
import { DemoChatThread } from "@/components/settings/demo-simulator/demo-chat-thread";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ContactAvatar } from "@/components/ui/contact-avatar";
import { cn } from "@/lib/utils";

function buildPayload(params: {
  channel: DemoSimulatorChannel;
  customerId: string;
  displayName: string;
  username: string;
  emailSubject: string;
  content: string;
}): DemoChannelInboundRequest {
  const option = getSimulatorChannel(params.channel);
  const payload: DemoChannelInboundRequest = {
    tenant_id: TENANT_ID,
    channel: params.channel,
    customer_id: params.customerId.trim(),
    display_name: params.displayName.trim(),
    content: params.content.trim(),
  };

  if (option.supportsUsername && params.username.trim()) {
    payload.username = params.username.trim();
  }

  if (option.supportsEmailSubject && params.emailSubject.trim()) {
    payload.metadata = { subject: params.emailSubject.trim() };
  }

  return payload;
}

async function hydrateConversation(conversationId: string): Promise<void> {
  const conversation = await api.getConversation(conversationId, TENANT_ID);
  if (conversation.messages?.length) {
    ingestMessages(conversationId, conversation.messages);
  }
}

export function DemoChannelSimulator() {
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  const [channel, setChannel] = useState<DemoSimulatorChannel>("instagram");
  const [customerId, setCustomerId] = useState(
    getSimulatorChannel("instagram").defaultCustomerId,
  );
  const [displayName, setDisplayName] = useState(
    getSimulatorChannel("instagram").defaultDisplayName,
  );
  const [username, setUsername] = useState("demo_customer");
  const [emailSubject, setEmailSubject] = useState("Support request");
  const [content, setContent] = useState("");
  const [demoSecret, setDemoSecret] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);

  const option = getSimulatorChannel(channel);
  const messages = useConversationMessages(activeConversationId);

  useEffect(() => {
    setDemoSecret(getStoredDemoChannelSecret());
  }, []);

  const restoreSession = useCallback(async () => {
    const storedId = getDemoSessionConversationId(channel, customerId);
    setActiveConversationId(storedId);

    if (!storedId) return;

    setLoadingThread(true);
    try {
      await hydrateConversation(storedId);
    } catch {
      clearDemoSession(channel, customerId);
      setActiveConversationId(null);
    } finally {
      setLoadingThread(false);
    }
  }, [channel, customerId]);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  function handleChannelChange(next: DemoSimulatorChannel) {
    const nextOption = getSimulatorChannel(next);
    setChannel(next);
    setCustomerId(nextOption.defaultCustomerId);
    setDisplayName(nextOption.defaultDisplayName);
    setContent("");
  }

  function handleSecretChange(value: string) {
    setDemoSecret(value);
    setStoredDemoChannelSecret(value);
  }

  function handleNewConversation() {
    clearDemoSession(channel, customerId);
    setActiveConversationId(null);
    setContent("");
    showSuccess("Ready for a new demo chat");
  }

  function handleOpenInbox() {
    if (activeConversationId) {
      useConversationStore.getState().selectConversation(activeConversationId);
    }
    router.push("/");
  }

  const payload = useMemo(
    () =>
      buildPayload({
        channel,
        customerId,
        displayName,
        username,
        emailSubject,
        content,
      }),
    [channel, customerId, displayName, username, emailSubject, content],
  );

  const payloadPreview = useMemo(
    () => JSON.stringify(payload, null, 2),
    [payload],
  );

  const canSend =
    demoSecret.trim().length > 0 &&
    customerId.trim().length > 0 &&
    displayName.trim().length > 0 &&
    content.trim().length > 0;

  async function handleSend() {
    if (!canSend || sending) return;

    setSending(true);

    try {
      const response = await api.demoChannelInbound(payload, demoSecret.trim());
      saveDemoSession(channel, customerId, response.conversation_id);
      setActiveConversationId(response.conversation_id);
      setContent("");

      try {
        await hydrateConversation(response.conversation_id);
      } catch {
        // WebSocket may still deliver the message shortly after send.
      }

      showSuccess("Demo message sent");
    } catch (err) {
      showError(
        "Demo send failed",
        err instanceof Error ? err.message : "Unable to send demo message",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <p>
          Demo simulator injects messages into the real backend pipeline.
          Replies from agents and AI appear here live via WebSocket — use only
          for development and testing.
        </p>
      </div>

      <div className="grid min-h-[640px] gap-4 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
        {/* Platform + identity */}
        <aside className="flex min-h-0 flex-col gap-4 rounded-xl border border-border bg-card p-3">
          <div>
            <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Platform
            </p>
            <div className="space-y-1">
              {SIMULATOR_CHANNELS.map((item) => {
                const Icon = item.icon;
                const active = item.id === channel;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleChannelChange(item.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm transition-colors",
                      active
                        ? "bg-primary/12 text-primary ring-1 ring-inset ring-primary/25"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm",
                        item.accentClass,
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 border-t border-border pt-3">
            <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Customer identity
            </p>
            <div className="space-y-2 px-1">
              <div className="space-y-1.5">
                <label className="text-xs font-medium" htmlFor="customer-id">
                  {option.customerIdLabel}
                </label>
                <Input
                  id="customer-id"
                  value={customerId}
                  onChange={(event) => setCustomerId(event.target.value)}
                  placeholder={option.customerIdPlaceholder}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" htmlFor="display-name">
                  Display name
                </label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Customer name"
                  className="h-8 text-sm"
                />
              </div>
              {option.supportsUsername ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" htmlFor="username">
                    Username
                  </label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="demo_customer"
                    className="h-8 text-sm"
                  />
                </div>
              ) : null}
              {option.supportsEmailSubject ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" htmlFor="email-subject">
                    Email subject
                  </label>
                  <Input
                    id="email-subject"
                    value={emailSubject}
                    onChange={(event) => setEmailSubject(event.target.value)}
                    placeholder="Support request"
                    className="h-8 text-sm"
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-auto space-y-2 border-t border-border pt-3">
            <label
              className="flex items-center gap-1.5 px-2 text-xs font-medium text-muted-foreground"
              htmlFor="demo-secret"
            >
              <Shield className="size-3.5" />
              Demo secret
            </label>
            <Input
              id="demo-secret"
              type="password"
              autoComplete="off"
              value={demoSecret}
              onChange={(event) => handleSecretChange(event.target.value)}
              placeholder="X-Demo-Secret value"
              className="h-8 text-xs"
            />
            <p className="px-2 text-[11px] text-muted-foreground">
              Stored in sessionStorage only for this browser tab session.
            </p>
          </div>
        </aside>

        {/* Live demo chat */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-3">
              <ContactAvatar name={displayName || "Customer"} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {displayName || "Customer"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {activeConversationId
                    ? `Conversation ${activeConversationId.slice(0, 8)}…`
                    : option.supportsUsername && username
                      ? `@${username.replace(/^@/, "")}`
                      : customerId || option.customerIdPlaceholder}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-full bg-gradient-to-r px-2.5 py-0.5 text-[10px] font-semibold text-white",
                  option.accentClass,
                )}
              >
                {option.label}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {activeConversationId ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleOpenInbox}
                >
                  <Inbox className="size-4" />
                  Open in inbox
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleNewConversation}
              >
                <MessageSquarePlus className="size-4" />
                New chat
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col bg-gradient-to-b from-muted/20 to-background p-4">
            {option.supportsEmailSubject && emailSubject ? (
              <div className="mb-3 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Subject: </span>
                {emailSubject}
              </div>
            ) : null}

            <DemoChatThread
              messages={messages}
              customerName={displayName || "You"}
              loading={loadingThread}
            />
          </div>

          <div className="border-t border-border bg-card/80 p-4">
            <div className="mx-auto max-w-2xl space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium" htmlFor="message-content">
                  Customer message
                </label>
                <Textarea
                  id="message-content"
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="Hi, I need help with my order…"
                  rows={3}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      (event.metaKey || event.ctrlKey)
                    ) {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={!canSend || sending}
                >
                  {sending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  Send as customer
                </Button>
                <p className="text-xs text-muted-foreground">
                  Ctrl+Enter to send · chat history persists for this customer
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Payload preview */}
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Payload preview</p>
            <p className="text-xs text-muted-foreground">
              POST /api/v1/demo/channels/inbound
            </p>
          </div>
          <pre className="min-h-0 flex-1 overflow-auto p-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
            {payloadPreview}
          </pre>
          <div className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
            Header: X-Demo-Secret: ••••••••
          </div>
        </aside>
      </div>
    </div>
  );
}
