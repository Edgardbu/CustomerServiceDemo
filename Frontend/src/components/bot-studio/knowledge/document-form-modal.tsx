"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import type { KnowledgeDocument, KnowledgeDocumentType } from "@/lib/types";
import { KNOWLEDGE_DOCUMENT_TYPES } from "@/lib/knowledge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TagInput } from "@/components/bot-studio/knowledge/tag-input";
import { cn } from "@/lib/utils";

export interface DocumentFormValues {
  title: string;
  content: string;
  document_type: KnowledgeDocumentType;
  tags: string[];
  enabled: boolean;
}

const EMPTY_FORM: DocumentFormValues = {
  title: "",
  content: "",
  document_type: "faq",
  tags: [],
  enabled: true,
};

interface DocumentFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  document?: KnowledgeDocument | null;
  loading?: boolean;
  saving?: boolean;
  error?: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: DocumentFormValues) => Promise<void>;
}

export function DocumentFormModal({
  open,
  mode,
  document,
  loading = false,
  saving = false,
  error,
  onOpenChange,
  onSubmit,
}: DocumentFormModalProps) {
  const [form, setForm] = useState<DocumentFormValues>(EMPTY_FORM);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && document) {
      setForm({
        title: document.title,
        content: document.content,
        document_type: document.document_type,
        tags: document.tags ?? [],
        enabled: document.enabled,
      });
      return;
    }
    setForm(EMPTY_FORM);
  }, [open, mode, document]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;
    await onSubmit({
      ...form,
      title: form.title.trim(),
      content: form.content.trim(),
    });
  }

  const title = mode === "create" ? "Create document" : "Edit document";
  const description =
    mode === "create"
      ? "Add a new knowledge article for the bot to reference."
      : "Update the document content and metadata.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,900px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <DialogHeader className="border-b border-border bg-muted/20 px-6 py-5 text-start">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading document…
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium" htmlFor="doc-title">
                      Title
                    </label>
                    <Input
                      id="doc-title"
                      value={form.title}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, title: event.target.value }))
                      }
                      placeholder="Document title"
                      disabled={saving}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Document type</label>
                    <Select
                      value={form.document_type}
                      onValueChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          document_type: value as KnowledgeDocumentType,
                        }))
                      }
                      disabled={saving}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {KNOWLEDGE_DOCUMENT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border bg-card/50 p-4">
                    <div>
                      <p className="text-sm font-medium">Enabled</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Disabled documents are excluded from search.
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

                <div className="space-y-2">
                  <label className="text-sm font-medium">Tags</label>
                  <TagInput
                    value={form.tags}
                    onChange={(tags) => setForm((prev) => ({ ...prev, tags }))}
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="doc-content">
                    Content
                  </label>
                  <Textarea
                    id="doc-content"
                    value={form.content}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        content: event.target.value,
                      }))
                    }
                    placeholder="Write the full document content…"
                    disabled={saving}
                    required
                    rows={16}
                    className="min-h-[360px] resize-y font-mono text-sm leading-relaxed"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="border-t border-border bg-muted/20 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                saving || loading || !form.title.trim() || !form.content.trim()
              }
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {mode === "create" ? "Create document" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
