"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import type { BotIntent } from "@/lib/types";
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
import { IntentPicker } from "@/components/bot-studio/flows/intent-picker";
import { cn } from "@/lib/utils";

export interface FlowFormValues {
  name: string;
  description: string;
  trigger_intents: BotIntent[];
  enabled: boolean;
}

const EMPTY_FORM: FlowFormValues = {
  name: "",
  description: "",
  trigger_intents: [],
  enabled: true,
};

interface CreateFlowDialogProps {
  open: boolean;
  saving?: boolean;
  error?: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: FlowFormValues) => Promise<void>;
}

export function CreateFlowDialog({
  open,
  saving = false,
  error,
  onOpenChange,
  onSubmit,
}: CreateFlowDialogProps) {
  const [form, setForm] = useState<FlowFormValues>(EMPTY_FORM);

  useEffect(() => {
    if (open) setForm(EMPTY_FORM);
  }, [open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return;
    await onSubmit({
      ...form,
      name: form.name.trim(),
      description: form.description.trim(),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={(event) => void handleSubmit(event)}>
          <DialogHeader>
            <DialogTitle>Create flow</DialogTitle>
            <DialogDescription>
              Name the flow and choose which intents should trigger it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="flow-name">
                Name
              </label>
              <Input
                id="flow-name"
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="e.g. Order status"
                disabled={saving}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="flow-description">
                Description
              </label>
              <Textarea
                id="flow-description"
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                rows={3}
                placeholder="Optional summary for admins"
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Trigger intents</label>
              <IntentPicker
                value={form.trigger_intents}
                onChange={(trigger_intents) =>
                  setForm((prev) => ({ ...prev, trigger_intents }))
                }
                disabled={saving}
              />
            </div>

            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border bg-card/50 p-4">
              <div>
                <p className="text-sm font-medium">Enabled</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Disabled flows are not triggered by the bot.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.enabled}
                disabled={saving}
                onClick={() =>
                  setForm((prev) => ({ ...prev, enabled: !prev.enabled }))
                }
                className={cn(
                  "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                  form.enabled ? "bg-primary" : "bg-muted",
                  saving && "opacity-50",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
                    form.enabled ? "start-5" : "start-0.5",
                  )}
                />
              </button>
            </label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !form.name.trim()}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Create flow
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
