"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Loader2, Pencil, Plus, Save, UserCog } from "lucide-react";
import { api } from "@/lib/api";
import { TENANT_ID } from "@/lib/constants";
import type { Conversation } from "@/lib/types";
import {
  getChannelConfig,
  formatRelativeTime,
} from "@/lib/format";
import {
  getCustomerDisplayName,
  getCustomerExternalId,
  getCustomerSubtitle,
  getCustomerUsername,
} from "@/lib/customer-profile";
import { applyCustomerProfileByIdentity } from "@/lib/customer-profile-sync";
import { canEditCustomerProfile } from "@/lib/conversations/permissions";
import { isDemoChannelConversation } from "@/lib/demo-channel";
import {
  getCustomerContactAddress,
  getCustomerContactLabel,
  isEmailChannel,
  isSmsChannel,
} from "@/lib/channel-contact";
import {
  getAssignedAgentLabel,
  isConversationUnassigned,
} from "@/lib/conversations/queues";
import { mergeMessages } from "@/lib/messages/ingest";
import { useConversationMessages } from "@/hooks/use-selected-conversation";
import { cn } from "@/lib/utils";
import { CustomerAvatar } from "@/components/ui/customer-avatar";
import { ChannelBadge } from "@/components/inbox/channel-badge";
import { DemoChannelBadge } from "@/components/inbox/demo-channel-badge";
import { StatusBadge } from "@/components/inbox/status-badge";
import { BotRuntimePanel } from "@/components/inbox/bot-runtime-panel";
import { EditCustomerProfileModal } from "@/components/inbox/edit-customer-profile-modal";
import type { CustomerProfileFormValues } from "@/components/inbox/edit-customer-profile-modal";
import { EmptyState } from "@/components/inbox/empty-state";
import { useToast } from "@/components/providers/toast-provider";
import { useCurrentUserStore } from "@/stores/current-user-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface CustomerPanelProps {
  conversation: Conversation | null;
}

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore quota errors */
  }
}

function Section({
  id,
  title,
  defaultOpen = true,
  children,
}: {
  id: string;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const storageKey = `panel_section_${id}`;
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    const stored = readLocal(storageKey);
    if (stored != null) setOpen(stored === "1");
  }, [storageKey]);

  function toggle() {
    setOpen((v) => {
      const next = !v;
      writeLocal(storageKey, next ? "1" : "0");
      return next;
    });
  }

  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
      >
        {title}
        <ChevronDown
          className={cn("size-3.5 transition-transform", open ? "" : "-rotate-90")}
        />
      </button>
      {open ? <div className="px-4 pb-4">{children}</div> : null}
    </div>
  );
}

function MetaRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "truncate text-xs font-medium text-foreground",
          mono && "font-mono",
        )}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

function TimelineItem({
  color,
  label,
  time,
}: {
  color: string;
  label: string;
  time: string;
}) {
  return (
    <li className="relative">
      <span
        className={cn(
          "absolute -start-4 top-1 size-2 rounded-full ring-2 ring-card",
          color,
        )}
      />
      <p className="text-xs font-medium text-foreground">{label}</p>
      {time ? <p className="text-[11px] text-muted-foreground">{time}</p> : null}
    </li>
  );
}

export function CustomerPanel({ conversation }: CustomerPanelProps) {
  const { showSuccess, showError } = useToast();
  const currentUser = useCurrentUserStore((state) => state.getCurrentUser());
  const conversationId = conversation?.id ?? null;
  const storedMessages = useConversationMessages(conversationId);
  const [notes, setNotes] = useState("");
  const [aiNotes, setAiNotes] = useState("");
  const [aiNotesLoading, setAiNotesLoading] = useState(false);
  const [aiNotesSaving, setAiNotesSaving] = useState(false);
  const [aiNotesError, setAiNotesError] = useState<string | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [localTime, setLocalTime] = useState("");

  useEffect(() => {
    const tick = () =>
      setLocalTime(
        new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      );
    tick();
    const interval = setInterval(tick, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!conversationId) {
      setNotes("");
      setAiNotes("");
      setAiNotesError(null);
      setTags([]);
      return;
    }
    setNotes(readLocal(`conversation_notes_${conversationId}`) ?? "");
    const storedTags = readLocal(`conversation_tags_${conversationId}`);
    if (storedTags) {
      try {
        setTags(JSON.parse(storedTags));
        return;
      } catch {
        /* fall through to conversation tags */
      }
    }
    setTags(conversation?.tags ?? []);
  }, [conversationId, conversation?.tags]);

  useEffect(() => {
    if (!conversationId) return;
    let active = true;
    setAiNotesLoading(true);
    setAiNotesError(null);
    api
      .getConversationAINotes(conversationId, TENANT_ID)
      .then((data) => {
        if (active) setAiNotes(data.notes ?? "");
      })
      .catch((err) => {
        if (active) {
          setAiNotesError(
            err instanceof Error ? err.message : "Failed to load AI notes",
          );
        }
      })
      .finally(() => {
        if (active) setAiNotesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [conversationId]);

  function persistTags(next: string[]) {
    setTags(next);
    if (conversationId) {
      writeLocal(`conversation_tags_${conversationId}`, JSON.stringify(next));
    }
  }

  function handleAddTag() {
    const value = tagDraft.trim();
    if (!value) {
      setAdding(false);
      return;
    }
    if (!tags.includes(value)) persistTags([...tags, value]);
    setTagDraft("");
    setAdding(false);
  }

  function handleNotesChange(value: string) {
    setNotes(value);
    if (conversationId) writeLocal(`conversation_notes_${conversationId}`, value);
  }

  async function handleSaveAiNotes() {
    if (!conversationId) return;
    setAiNotesSaving(true);
    setAiNotesError(null);
    try {
      const data = await api.updateConversationAINotes(
        conversationId,
        TENANT_ID,
        aiNotes,
      );
      setAiNotes(data.notes ?? aiNotes);
    } catch (err) {
      setAiNotesError(
        err instanceof Error ? err.message : "Failed to save AI notes",
      );
    } finally {
      setAiNotesSaving(false);
    }
  }

  async function handleSaveProfile(values: CustomerProfileFormValues) {
    if (!conversation) return;

    const externalId = getCustomerExternalId(conversation);
    setProfileSaving(true);
    setProfileError(null);

    try {
      const profile = await api.updateCustomerProfile(
        conversation.channel,
        externalId,
        {
          tenant_id: TENANT_ID,
          display_name: values.display_name.trim() || null,
          username: values.username.trim() || null,
          profile_picture_url: values.profile_picture_url.trim() || null,
          agent_label: values.agent_label.trim() || null,
          agent_notes: values.agent_notes.trim() || null,
        },
      );

      applyCustomerProfileByIdentity(
        conversation.channel,
        externalId,
        profile,
      );
      setProfileModalOpen(false);
      showSuccess("Customer profile updated");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update customer profile";
      setProfileError(message);
      showError("Profile update failed", message);
    } finally {
      setProfileSaving(false);
    }
  }

  if (!conversation) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden border-s border-border bg-card/40">
        <EmptyState
          icon={<UserCog className="size-7" />}
          title="Customer details"
          description="Select a conversation to see profile, details, notes, and activity."
        />
      </div>
    );
  }

  const channel = getChannelConfig(conversation.channel);
  const displayName = getCustomerDisplayName(conversation);
  const username = conversation.customer_profile?.username
    ? getCustomerUsername(conversation)
    : null;
  const contactLine =
    isEmailChannel(conversation) || isSmsChannel(conversation)
      ? getCustomerSubtitle(conversation)
      : null;
  const contactMetaLabel = getCustomerContactLabel(conversation.channel);
  const contactAddress = getCustomerContactAddress(conversation);
  const messages = mergeMessages(storedMessages, conversation.messages);
  const firstMessage = messages[0];
  const lastMessage = messages[messages.length - 1];
  const canEditProfile = canEditCustomerProfile(currentUser?.role);
  const agentLabel = conversation.customer_profile?.agent_label?.trim();
  const agentNotes = conversation.customer_profile?.agent_notes?.trim();
  const profileOverridden = conversation.customer_profile?.profile_overridden;
  const isDemo = isDemoChannelConversation(conversation);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden border-s border-border bg-card/40">
      <EditCustomerProfileModal
        open={profileModalOpen}
        conversation={conversation}
        saving={profileSaving}
        error={profileError}
        onOpenChange={(open) => {
          setProfileModalOpen(open);
          if (!open) setProfileError(null);
        }}
        onSubmit={handleSaveProfile}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isDemo ? (
          <div className="border-b border-border px-4 py-4">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                  Demo conversation
                </p>
                <DemoChannelBadge />
              </div>
              <p className="mt-1 text-xs text-amber-900/90 dark:text-amber-100/90">
                Messages are simulated and are not sent to the real external
                platform.
              </p>
            </div>
          </div>
        ) : null}

        <Section id="customer-profile" title="Customer profile">
          <div className="flex flex-col items-center gap-2 pb-4 text-center">
            <CustomerAvatar
              conversation={conversation}
              size="xl"
              showChannelDot
            />
            <div>
              <p className="text-sm font-semibold">{displayName}</p>
              {agentLabel ? (
                <p className="text-xs text-violet-600 dark:text-violet-300">
                  {agentLabel}
                </p>
              ) : null}
              {username ? (
                <p className="text-xs text-muted-foreground">{username}</p>
              ) : contactLine ? (
                <p className="text-xs text-muted-foreground">{contactLine}</p>
              ) : (
                <p className="text-xs text-muted-foreground">{channel.label} customer</p>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <ChannelBadge channel={conversation.channel} />
              {isDemo ? <DemoChannelBadge /> : null}
              <StatusBadge status={conversation.status} />
              {profileOverridden ? (
                <span className="rounded-md bg-violet-500/12 px-2 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-inset ring-violet-500/25 dark:text-violet-300">
                  Customized
                </span>
              ) : null}
            </div>
            {canEditProfile ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1"
                onClick={() => setProfileModalOpen(true)}
              >
                <Pencil className="size-3.5" />
                Edit profile
              </Button>
            ) : null}
            <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-emerald-500 dark:text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Active now
            </div>
          </div>

          <div className="divide-y divide-border/60">
            <MetaRow
              label="Conversation"
              value={`#${conversation.id.slice(0, 8)}`}
              mono
            />
            <MetaRow label="Display name" value={displayName} />
            {agentLabel ? <MetaRow label="Agent label" value={agentLabel} /> : null}
            {username ? <MetaRow label="Username" value={username} /> : null}
            {contactMetaLabel ? (
              <MetaRow label={contactMetaLabel} value={contactAddress} mono />
            ) : (
              <MetaRow
                label="External ID"
                value={getCustomerExternalId(conversation)}
                mono
              />
            )}
            {!contactMetaLabel ? null : (
              <MetaRow label="Customer ID" value={conversation.customer_id} mono />
            )}
            <MetaRow label="Channel" value={channel.label} />
            <MetaRow label="Status" value={conversation.status} />
            <MetaRow label="Tenant" value={conversation.tenant_id} />
            <MetaRow
              label="Assigned"
              value={
                isConversationUnassigned(conversation)
                  ? "Unassigned"
                  : getAssignedAgentLabel(conversation)
              }
            />
            <MetaRow label="Local time" value={localTime} />
            <MetaRow label="Messages" value={String(messages.length)} />
          </div>

          {agentNotes ? (
            <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Agent notes
              </p>
              <p className="whitespace-pre-wrap text-xs text-foreground">{agentNotes}</p>
            </div>
          ) : null}

          <div className="mt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Tags
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                    tag.toLowerCase() === "vip"
                      ? "bg-amber-500/15 text-amber-600 ring-amber-500/30 dark:text-amber-300"
                      : "bg-muted text-muted-foreground ring-border",
                  )}
                >
                  {tag}
                </span>
              ))}
              {adding ? (
                <input
                  autoFocus
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onBlur={handleAddTag}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    } else if (e.key === "Escape") {
                      setTagDraft("");
                      setAdding(false);
                    }
                  }}
                  placeholder="Tag name"
                  className="h-6 w-24 rounded-md border border-border bg-background px-2 text-[11px] outline-none focus:border-primary/50"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  <Plus className="size-3" />
                  Add tag
                </button>
              )}
            </div>
          </div>
        </Section>

        <Section id="ai-notes" title="AI notes">
          {aiNotesError ? (
            <p className="mb-2 text-xs text-destructive">{aiNotesError}</p>
          ) : null}
          <Textarea
            value={aiNotes}
            onChange={(e) => setAiNotes(e.target.value)}
            placeholder={`Client is price sensitive\nPrefers short answers\nAlready asked about VPS pricing\nDo not offer discount without approval`}
            rows={5}
            disabled={aiNotesLoading || aiNotesSaving}
            className="min-h-[110px] resize-y bg-background text-xs"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[10px] text-muted-foreground">
              Used by AI when drafting replies for this customer.
            </p>
            <button
              type="button"
              onClick={() => void handleSaveAiNotes()}
              disabled={aiNotesLoading || aiNotesSaving}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {aiNotesSaving ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Save className="size-3" />
              )}
              Save
            </button>
          </div>
        </Section>

        <Section id="bot-runtime" title="Bot Runtime">
          <BotRuntimePanel conversation={conversation} />
        </Section>

        <Section id="notes" title="Private notes" defaultOpen={false}>
          <Textarea
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Add a private note about this customer…"
            rows={3}
            className="min-h-[72px] resize-none bg-background text-xs"
          />
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            Saved locally · visible to your team only
          </p>
        </Section>

        <Section id="activity" title="Activity" defaultOpen={false}>
          <ol className="relative space-y-3 ps-4">
            <span className="absolute inset-y-1 start-[3px] w-px bg-border" />
            <TimelineItem
              color="bg-emerald-500"
              label="Conversation created"
              time={formatRelativeTime(conversation.created_at)}
            />
            {!isConversationUnassigned(conversation) ? (
              <TimelineItem
                color="bg-violet-500"
                label={`Assigned to ${getAssignedAgentLabel(conversation)}`}
                time=""
              />
            ) : null}
            <TimelineItem
              color="bg-pink-500"
              label={`${channel.label} connected`}
              time={formatRelativeTime(
                firstMessage?.created_at ?? conversation.created_at,
              )}
            />
            {lastMessage ? (
              <TimelineItem
                color="bg-primary"
                label="Last message received"
                time={formatRelativeTime(
                  lastMessage.created_at ?? conversation.updated_at,
                )}
              />
            ) : null}
          </ol>
        </Section>
      </div>
    </div>
  );
}
