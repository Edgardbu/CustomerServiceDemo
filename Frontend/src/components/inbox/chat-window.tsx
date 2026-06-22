"use client";



import { useEffect, useMemo, useRef, useState } from "react";

import {

  ArrowRightLeft,

  Bell,

  CheckCircle2,

  Hand,

  Loader2,

  MessagesSquare,

  MoreHorizontal,

  Pause,

  Play,

  Sparkles,

  Tag,

  Trash2,

  UserPlus,

} from "lucide-react";

import { TENANT_ID } from "@/lib/constants";

import { api } from "@/lib/api";

import { isAiPaused } from "@/lib/ai-status";

import type { Message } from "@/lib/types";

import {

  formatDateSeparator,

  getDayKey,

} from "@/lib/format";

import {

  getCustomerDisplayName,

  getCustomerSubtitle,

  getCustomerUsername,

} from "@/lib/customer-profile";

import {

  isEmailChannel,

  isSmsChannel,

} from "@/lib/channel-contact";

import {

  getAssignedAgentLabel,

  isConversationUnassigned,

} from "@/lib/conversations/queues";

import {

  canAssignConversation,

  canClaimConversation,

  canReplyToConversation,

  canTransferConversation,

  isAssignedToCurrentUser,

} from "@/lib/conversations/permissions";

import { applyQueueAwareConversationUpdate } from "@/lib/conversations/queue-sync";

import { useConversationMessages } from "@/hooks/use-selected-conversation";

import { useConversationStore } from "@/stores/conversation-store";

import { useCurrentUserStore } from "@/stores/current-user-store";

import { CustomerAvatar } from "@/components/ui/customer-avatar";

import { ChannelBadge } from "@/components/inbox/channel-badge";

import { StatusBadge } from "@/components/inbox/status-badge";

import { DemoChannelBadge } from "@/components/inbox/demo-channel-badge";

import { AIStatusBadge } from "@/components/ai/ai-status-badge";
import { isDemoChannelConversation } from "@/lib/demo-channel";

import { AgentPickerDialog } from "@/components/inbox/agent-picker-dialog";

import { EmptyState } from "@/components/inbox/empty-state";

import { MessageBubble } from "@/components/inbox/message-bubble";

import { DateSeparator } from "@/components/inbox/date-separator";

import { TypingIndicator } from "@/components/inbox/typing-indicator";

import { ReplyComposer } from "@/components/inbox/reply-composer";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {

  DropdownMenu,

  DropdownMenuContent,

  DropdownMenuItem,

  DropdownMenuSeparator,

  DropdownMenuTrigger,

} from "@/components/ui/dropdown-menu";



interface ChatWindowProps {

  sending: boolean;

  suggesting: boolean;

  onSend: (content: string) => Promise<void>;

  onSuggestReply: (extraInstruction?: string) => void;

}



type ThreadItem =

  | { kind: "separator"; id: string; label: string }

  | { kind: "message"; id: string; message: Message; showMeta: boolean; showStatus: boolean };



type PickerMode = "assign" | "transfer" | null;



function buildThread(messages: Message[]): ThreadItem[] {

  const items: ThreadItem[] = [];

  let lastDay = "";

  for (let i = 0; i < messages.length; i++) {

    const message = messages[i];

    const day = getDayKey(message.created_at);

    if (day && day !== lastDay) {

      items.push({

        kind: "separator",

        id: `sep-${day}-${message.id}`,

        label: formatDateSeparator(message.created_at),

      });

      lastDay = day;

    }

    const prev = messages[i - 1];

    const next = messages[i + 1];

    const startsGroup =

      !prev ||

      prev.sender_type !== message.sender_type ||

      getDayKey(prev.created_at) !== day;

    const endsGroup =

      !next ||

      next.sender_type !== message.sender_type ||

      getDayKey(next.created_at) !== day;

    items.push({

      kind: "message",

      id: message.id,

      message,

      showMeta: startsGroup,

      showStatus: endsGroup && (message.sender_type === "agent" || message.sender_type === "bot"),

    });

  }

  return items;

}



export function ChatWindow({

  sending,

  suggesting,

  onSend,

  onSuggestReply,

}: ChatWindowProps) {

  const selectedId = useConversationStore((state) => state.selectedId);

  const conversation = useConversationStore((state) =>

    selectedId

      ? (state.conversations.find((item) => item.id === selectedId) ?? null)

      : null,

  );

  const patchConversation = useConversationStore(

    (state) => state.patchConversation,

  );

  const currentUser = useCurrentUserStore((state) => state.getCurrentUser());

  const currentUserId = useCurrentUserStore((state) => state.selectedUserId);

  const tenantUsers = useCurrentUserStore((state) => state.users);

  const usersLoading = useCurrentUserStore((state) => state.loading);

  const refreshUsers = useCurrentUserStore((state) => state.refreshUsers);

  const messages = useConversationMessages(selectedId);



  const [customerTyping] = useState(false);

  const [aiActionLoading, setAiActionLoading] = useState(false);

  const [assignmentLoading, setAssignmentLoading] = useState(false);

  const [aiActionError, setAiActionError] = useState<string | null>(null);

  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [aiInstruction, setAiInstruction] = useState("");
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);



  const messagesRef = useRef<HTMLDivElement>(null);

  const thread = useMemo(() => buildThread(messages), [messages]);



  useEffect(() => {

    const container = messagesRef.current;

    if (!container) return;

    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });

  }, [thread, customerTyping, selectedId]);



  if (!conversation) {

    return (

      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">

        <EmptyState

          icon={<MessagesSquare className="size-7" />}

          title="No conversation selected"

          description="Pick a conversation from the inbox to view the full thread and reply to your customer."

        />

      </div>

    );

  }



  const displayName = getCustomerDisplayName(conversation);
  const isDemo = isDemoChannelConversation(conversation);

  const subtitle =
    isEmailChannel(conversation) || isSmsChannel(conversation)
      ? getCustomerSubtitle(conversation)
      : conversation.customer_profile?.username
        ? getCustomerUsername(conversation)
        : null;

  const unassigned = isConversationUnassigned(conversation);

  const assignedToYou = isAssignedToCurrentUser(conversation, currentUserId);

  const assignedLabel = assignedToYou

    ? "Assigned to you"

    : unassigned

      ? "Unassigned"

      : `Assigned to ${getAssignedAgentLabel(conversation)}`;



  const role = currentUser?.role;

  const canReply = canReplyToConversation(role);

  const showClaim = canClaimConversation(role, conversation);

  const showAssign = canAssignConversation(role);

  const showTransfer = canTransferConversation(role, conversation, currentUserId);



  async function applyAssignmentResult(updated: Awaited<

    ReturnType<typeof api.claimConversation>

  >) {

    applyQueueAwareConversationUpdate(updated, {

      toTop: true,

      showAssignmentToast: false,

    });

  }



  async function handleClaim() {

    if (!conversation) return;

    setAssignmentLoading(true);

    setAssignmentError(null);

    try {

      const updated = await api.claimConversation(conversation.id, TENANT_ID);

      await applyAssignmentResult(updated);

    } catch (err) {

      setAssignmentError(

        err instanceof Error ? err.message : "Failed to claim conversation",

      );

    } finally {

      setAssignmentLoading(false);

    }

  }



  async function handleAssignToAgent(agentId: string) {

    if (!conversation) return;

    setAssignmentLoading(true);

    setAssignmentError(null);

    try {

      const updated = await api.assignConversation(

        conversation.id,

        TENANT_ID,

        agentId,

      );

      await applyAssignmentResult(updated);

    } catch (err) {

      setAssignmentError(

        err instanceof Error ? err.message : "Failed to assign conversation",

      );

      throw err;

    } finally {

      setAssignmentLoading(false);

    }

  }



  async function handleTransferToAgent(agentId: string) {

    if (!conversation) return;

    setAssignmentLoading(true);

    setAssignmentError(null);

    try {

      const updated = await api.transferConversation(

        conversation.id,

        TENANT_ID,

        agentId,

      );

      await applyAssignmentResult(updated);

    } catch (err) {

      setAssignmentError(

        err instanceof Error ? err.message : "Failed to transfer conversation",

      );

      throw err;

    } finally {

      setAssignmentLoading(false);

    }

  }



  function handleResolve() {

    if (!conversation) return;

    patchConversation(conversation.id, {

      status: "resolved",

      updated_at: new Date().toISOString(),

    });

  }



  function handleReopen() {

    if (!conversation) return;

    patchConversation(conversation.id, {

      status: "open",

      updated_at: new Date().toISOString(),

    });

  }



  async function handlePauseAI() {

    if (!conversation) return;

    setAiActionLoading(true);

    setAiActionError(null);

    try {

      const updated = await api.pauseConversationAI(conversation.id, TENANT_ID);

      patchConversation(conversation.id, {

        ai_status: updated.ai_status ?? "paused",

        ai_auto_reply_enabled: updated.ai_auto_reply_enabled ?? false,

        updated_at: updated.updated_at ?? new Date().toISOString(),

      });

    } catch (err) {

      setAiActionError(

        err instanceof Error ? err.message : "Failed to pause AI for this chat",

      );

    } finally {

      setAiActionLoading(false);

    }

  }



  async function handleResumeAI() {

    if (!conversation) return;

    setAiActionLoading(true);

    setAiActionError(null);

    try {

      const updated = await api.resumeConversationAI(conversation.id, TENANT_ID);

      patchConversation(conversation.id, {

        ai_status: updated.ai_status ?? "active",

        ai_auto_reply_enabled: updated.ai_auto_reply_enabled ?? true,

        updated_at: updated.updated_at ?? new Date().toISOString(),

      });

    } catch (err) {

      setAiActionError(

        err instanceof Error ? err.message : "Failed to resume AI for this chat",

      );

    } finally {

      setAiActionLoading(false);

    }

  }



  const aiPaused = isAiPaused(conversation);



  return (

    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background" id="ai">

      <div className="flex shrink-0 flex-col gap-2 border-b border-border bg-card/50 px-4 py-3">

        {(aiActionError || assignmentError) ? (

          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">

            {assignmentError ?? aiActionError}

          </div>

        ) : null}

        <div className="flex items-center justify-between gap-3">

        <div className="flex min-w-0 items-center gap-3">

          <CustomerAvatar conversation={conversation} size="md" />

          <div className="min-w-0">

            <div className="flex flex-wrap items-center gap-2">

              <h2 className="truncate text-[15px] font-semibold">{displayName}</h2>

              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-500 dark:text-emerald-400">

                <span className="size-1.5 rounded-full bg-emerald-500" />

                Active now

              </span>

              <ChannelBadge channel={conversation.channel} />

              {isDemo ? <DemoChannelBadge /> : null}

              <StatusBadge status={conversation.status} />

              <AIStatusBadge conversation={conversation} />

            </div>

            <p className="mt-0.5 truncate text-xs text-muted-foreground">

              {subtitle ? (

                <>

                  <span className="text-foreground/70">{subtitle}</span>

                  {" · "}

                </>

              ) : null}

              <span

                className={

                  assignedToYou

                    ? "font-medium text-primary"

                    : unassigned

                      ? "text-amber-600 dark:text-amber-400"

                      : ""

                }

              >

                {assignedLabel}

              </span>

              {" · "}

              {messages.length} messages

            </p>

          </div>

        </div>



        <div className="flex shrink-0 flex-wrap items-center gap-1.5">

          {showClaim ? (

            <Button

              size="sm"

              onClick={() => void handleClaim()}

              disabled={assignmentLoading}

            >

              {assignmentLoading ? (

                <Loader2 className="size-4 animate-spin" />

              ) : (

                <Hand className="size-4" />

              )}

              Claim

            </Button>

          ) : null}



          {showAssign ? (

            <Button

              variant="outline"

              size="sm"

              onClick={() => {

                void refreshUsers();

                setPickerMode("assign");

              }}

              disabled={assignmentLoading}

              className="hidden sm:inline-flex"

            >

              <UserPlus className="size-4" />

              Assign

            </Button>

          ) : null}



          {showTransfer ? (

            <Button

              variant="outline"

              size="sm"

              onClick={() => {

                void refreshUsers();

                setPickerMode("transfer");

              }}

              disabled={assignmentLoading}

              className="hidden lg:inline-flex"

            >

              <ArrowRightLeft className="size-4" />

              Transfer

            </Button>

          ) : null}



          {aiPaused ? (

            <Button

              variant="outline"

              size="sm"

              onClick={() => void handleResumeAI()}

              disabled={aiActionLoading || !canReply}

            >

              {aiActionLoading ? (

                <Loader2 className="size-4 animate-spin" />

              ) : (

                <Play className="size-4" />

              )}

              Resume AI

            </Button>

          ) : (

            <Button

              variant="outline"

              size="sm"

              onClick={() => void handlePauseAI()}

              disabled={aiActionLoading || !canReply}

            >

              {aiActionLoading ? (

                <Loader2 className="size-4 animate-spin" />

              ) : (

                <Pause className="size-4" />

              )}

              Stop AI

            </Button>

          )}

          <Button

            variant="outline"

            size="sm"

            onClick={handleResolve}

            disabled={!canReply}

            className="hidden sm:inline-flex"

          >

            <CheckCircle2 className="size-4" />

            Resolve

          </Button>

          <Input
            value={aiInstruction}
            onChange={(e) => setAiInstruction(e.target.value)}
            placeholder="Optional AI hint…"
            disabled={suggesting || !canReply}
            className="hidden h-8 max-w-[11rem] text-sm lg:inline-flex"
            aria-label="Optional instruction for AI suggestion"
          />

          <Button

            size="sm"

            onClick={() =>
              void onSuggestReply(aiInstruction.trim() || undefined)
            }

            disabled={suggesting || !canReply}

          >

            {suggesting ? (

              <Loader2 className="size-4 animate-spin" />

            ) : (

              <Sparkles className="size-4" />

            )}

            <span className="hidden md:inline">Suggest reply</span>

          </Button>



          <DropdownMenu>

            <DropdownMenuTrigger

              render={

                <Button variant="ghost" size="icon-sm" aria-label="More actions">

                  <MoreHorizontal className="size-4" />

                </Button>

              }

            />

            <DropdownMenuContent align="end" className="w-48">

              {showAssign ? (

                <DropdownMenuItem

                  onClick={() => {

                    void refreshUsers();

                    setPickerMode("assign");

                  }}

                >

                  <UserPlus className="size-4" />

                  Assign agent

                </DropdownMenuItem>

              ) : null}

              {showTransfer ? (

                <DropdownMenuItem

                  onClick={() => {

                    void refreshUsers();

                    setPickerMode("transfer");

                  }}

                >

                  <ArrowRightLeft className="size-4" />

                  Transfer

                </DropdownMenuItem>

              ) : null}

              <DropdownMenuItem onClick={handleReopen} disabled={!canReply}>

                <Bell className="size-4" />

                Reopen conversation

              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem disabled>

                <Tag className="size-4" />

                Manage tags

              </DropdownMenuItem>

              <DropdownMenuItem variant="destructive" disabled>

                <Trash2 className="size-4" />

                Close conversation

              </DropdownMenuItem>

            </DropdownMenuContent>

          </DropdownMenu>

        </div>

        </div>

      </div>



      <div

        ref={messagesRef}

        className="min-h-0 flex-1 overflow-y-auto scroll-smooth bg-gradient-to-b from-background to-muted/20 px-4 py-5 sm:px-6 lg:px-10"

      >

        {messages.length === 0 ? (

          <EmptyState

            icon={<Sparkles className="size-7" />}

            title="Start the conversation"

            description="Send the first reply or use the AI Co-Pilot to draft a professional response."

          />

        ) : (

          <div className="mx-auto flex max-w-3xl flex-col">

            {thread.map((item) =>

              item.kind === "separator" ? (

                <DateSeparator key={item.id} label={item.label} />

              ) : (

                <MessageBubble

                  key={item.id}

                  message={item.message}

                  customerName={displayName}

                  showMeta={item.showMeta}

                  showStatus={item.showStatus}

                />

              ),

            )}

            {customerTyping ? (

              <div className="mt-2">

                <TypingIndicator name={displayName} />

              </div>

            ) : null}

          </div>

        )}

      </div>



      <ReplyComposer

        sending={sending}

        disabled={!canReply}

        onSend={onSend}

      />



      <AgentPickerDialog

        open={pickerMode !== null}

        title={pickerMode === "transfer" ? "Transfer conversation" : "Assign conversation"}

        description={

          pickerMode === "transfer"

            ? "Choose an agent to take over this conversation."

            : "Choose an agent to assign this conversation to."

        }

        users={tenantUsers}

        loading={usersLoading}

        submitting={assignmentLoading}

        excludeUserId={pickerMode === "transfer" ? currentUserId : null}

        onOpenChange={(open) => {

          if (!open) setPickerMode(null);

        }}

        onSelect={async (user) => {

          if (pickerMode === "transfer") {

            await handleTransferToAgent(user.id);

            return;

          }

          await handleAssignToAgent(user.id);

        }}

      />

    </div>

  );

}


