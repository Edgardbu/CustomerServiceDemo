"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Save } from "lucide-react";
import type { Conversation } from "@/lib/types";
import { getChannelConfig } from "@/lib/format";
import {
  getCustomerDisplayName,
  getCustomerExternalId,
} from "@/lib/customer-profile";
import { CustomerAvatar } from "@/components/ui/customer-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface CustomerProfileFormValues {
  display_name: string;
  username: string;
  profile_picture_url: string;
  agent_label: string;
  agent_notes: string;
}

function toFormValues(conversation: Conversation): CustomerProfileFormValues {
  const profile = conversation.customer_profile;
  return {
    display_name: profile?.display_name ?? "",
    username: profile?.username?.replace(/^@/, "") ?? "",
    profile_picture_url: profile?.profile_picture_url ?? "",
    agent_label: profile?.agent_label ?? "",
    agent_notes: profile?.agent_notes ?? "",
  };
}

function nullIfEmpty(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

interface EditCustomerProfileModalProps {
  open: boolean;
  conversation: Conversation;
  saving?: boolean;
  error?: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: CustomerProfileFormValues) => Promise<void>;
}

export function EditCustomerProfileModal({
  open,
  conversation,
  saving = false,
  error,
  onOpenChange,
  onSubmit,
}: EditCustomerProfileModalProps) {
  const [form, setForm] = useState<CustomerProfileFormValues>(() =>
    toFormValues(conversation),
  );

  useEffect(() => {
    if (!open) return;
    setForm(toFormValues(conversation));
  }, [open, conversation]);

  const previewConversation = useMemo<Conversation>(() => {
    const externalId = getCustomerExternalId(conversation);
    return {
      ...conversation,
      customer_profile: {
        external_id: externalId,
        channel: conversation.channel,
        display_name: nullIfEmpty(form.display_name),
        username: nullIfEmpty(form.username),
        profile_picture_url: nullIfEmpty(form.profile_picture_url),
        agent_label: nullIfEmpty(form.agent_label),
        agent_notes: nullIfEmpty(form.agent_notes),
        profile_overridden: true,
      },
    };
  }, [conversation, form]);

  const channelLabel = getChannelConfig(conversation.channel).label;
  const externalId = getCustomerExternalId(conversation);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await onSubmit(form);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit customer profile</DialogTitle>
          <DialogDescription>
            Customize how this customer appears in the dashboard. Platform
            identity stays unchanged.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangle className="size-4 shrink-0" />
            <p>
              External ID and channel cannot be changed because they identify
              the real platform conversation.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
            <CustomerAvatar conversation={previewConversation} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {getCustomerDisplayName(previewConversation)}
              </p>
              <p className="text-xs text-muted-foreground">Live preview</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">
                External ID
              </label>
              <Input value={externalId} readOnly className="bg-muted/40 font-mono text-xs" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">
                Channel
              </label>
              <Input value={channelLabel} readOnly className="bg-muted/40 text-xs" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium" htmlFor="profile-display-name">
                Display name
              </label>
              <Input
                id="profile-display-name"
                value={form.display_name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    display_name: event.target.value,
                  }))
                }
                placeholder="Customer name shown in inbox"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium" htmlFor="profile-username">
                Username
              </label>
              <Input
                id="profile-username"
                value={form.username}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    username: event.target.value.replace(/^@/, ""),
                  }))
                }
                placeholder="demo_customer"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium" htmlFor="profile-picture-url">
                Profile picture URL
              </label>
              <Input
                id="profile-picture-url"
                value={form.profile_picture_url}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    profile_picture_url: event.target.value,
                  }))
                }
                placeholder="https://…"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium" htmlFor="profile-agent-label">
                Agent label
              </label>
              <Input
                id="profile-agent-label"
                value={form.agent_label}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    agent_label: event.target.value,
                  }))
                }
                placeholder="Internal nickname for agents"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium" htmlFor="profile-agent-notes">
                Agent notes
              </label>
              <Textarea
                id="profile-agent-notes"
                value={form.agent_notes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    agent_notes: event.target.value,
                  }))
                }
                placeholder="Shared notes visible to agents in this profile"
                rows={4}
                className="resize-y"
              />
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save profile
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
