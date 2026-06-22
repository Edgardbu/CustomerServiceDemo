"use client";

import { useState } from "react";
import { BookOpen, Check, Loader2, MessageSquare, Sparkles, X } from "lucide-react";
import type { AIUsedKnowledge } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ReviewMode = "none" | "approve-comment" | "reject-comment";

interface SuggestionModalProps {
  open: boolean;
  suggestion: string;
  whyItFits?: string;
  confidence?: number;
  usedKnowledge?: AIUsedKnowledge[];
  loading: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
  onApproveWithComment: (comment: string) => Promise<void>;
  onRejectWithComment: (comment: string) => Promise<void>;
}

function formatConfidence(value?: number): string | null {
  if (value == null || Number.isNaN(value)) return null;
  return `${Math.round(value * 100)}%`;
}

export function SuggestionModal({
  open,
  suggestion,
  whyItFits,
  confidence,
  usedKnowledge = [],
  loading,
  error,
  onOpenChange,
  onApprove,
  onReject,
  onApproveWithComment,
  onRejectWithComment,
}: SuggestionModalProps) {
  const [mode, setMode] = useState<ReviewMode>("none");
  const [comment, setComment] = useState("");

  const confidenceLabel = formatConfidence(confidence);

  function reset() {
    setMode("none");
    setComment("");
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function submitComment() {
    const trimmed = comment.trim();
    if (!trimmed) return;
    if (mode === "approve-comment") await onApproveWithComment(trimmed);
    if (mode === "reject-comment") await onRejectWithComment(trimmed);
    reset();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,800px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border bg-muted/20 px-6 py-5 text-start">
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="size-5 text-violet-500" />
            AI suggested reply
          </DialogTitle>
          <DialogDescription>
            Review the AI draft before sending it to the customer or recording
            your feedback.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 text-sm leading-relaxed">
            {suggestion || "No suggestion returned."}
          </div>

          {whyItFits ? (
            <div className="space-y-1.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Sparkles className="size-3.5 text-violet-500" />
                Why it fits
              </p>
              <p className="text-sm text-muted-foreground">{whyItFits}</p>
            </div>
          ) : null}

          {confidenceLabel ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Confidence</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  confidence != null && confidence >= 0.7
                    ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                    : "bg-amber-500/12 text-amber-700 dark:text-amber-300",
                )}
              >
                {confidenceLabel}
              </span>
            </div>
          ) : null}

          {usedKnowledge.length > 0 ? (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <BookOpen className="size-3.5" />
                Used knowledge
              </p>
              <div className="space-y-2">
                {usedKnowledge.map((item) => (
                  <div
                    key={`${item.document_id}-${item.title}`}
                    className="rounded-lg border border-border bg-card/60 p-3"
                  >
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
                      {item.chunk}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}

          {mode !== "none" ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {mode === "approve-comment"
                  ? "Add a comment with your approval"
                  : "Add a comment explaining the rejection"}
              </p>
              <Textarea
                placeholder="Optional review comment…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={reset} disabled={loading}>
                  Back
                </Button>
                <Button
                  onClick={() => void submitComment()}
                  disabled={loading || !comment.trim()}
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  Submit review
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        {mode === "none" ? (
          <DialogFooter className="flex-col gap-2 border-t border-border bg-muted/10 px-6 py-4 sm:flex-col sm:items-stretch">
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => void onApprove()}
                disabled={loading || !suggestion}
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                Approve & send
              </Button>
              <Button
                variant="destructive"
                onClick={() => void onReject()}
                disabled={loading || !suggestion}
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <X className="size-4" />
                )}
                Reject
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                onClick={() => setMode("approve-comment")}
                disabled={loading || !suggestion}
              >
                Approve with comment
              </Button>
              <Button
                variant="outline"
                onClick={() => setMode("reject-comment")}
                disabled={loading || !suggestion}
              >
                Reject with comment
              </Button>
            </div>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
