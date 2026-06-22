"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  Loader2,
  Pencil,
  Sparkles,
  X,
} from "lucide-react";
import type { AIApproval } from "@/lib/types";
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

interface ApprovalModalProps {
  open: boolean;
  approval: AIApproval | null;
  loading: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onApprove: () => Promise<void>;
  onEditAndSend: (finalResponse: string) => Promise<void>;
  onReject: () => Promise<void>;
}

export function ApprovalModal({
  open,
  approval,
  loading,
  error,
  onOpenChange,
  onApprove,
  onEditAndSend,
  onReject,
}: ApprovalModalProps) {
  const [draft, setDraft] = useState("");
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    if (approval) {
      setDraft(approval.suggested_response);
      setEditMode(false);
    }
  }, [approval]);

  if (!approval) return null;

  const risk = approval.risk_level?.toLowerCase() ?? "unknown";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
        <div className="border-b border-border bg-gradient-to-r from-amber-500/10 via-violet-500/10 to-transparent px-6 py-5">
          <DialogHeader className="text-start">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
                <Sparkles className="size-4" />
              </div>
              <div>
                <DialogTitle>AI response needs approval</DialogTitle>
                <DialogDescription>
                  Review the suggested reply before it is sent to the customer.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-5">
          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <InfoCard label="Customer summary" value={approval.customer_summary} />
            <InfoCard label="AI reasoning" value={approval.reasoning_summary} />
            <InfoCard
              label="Suggested action"
              value={approval.suggested_action_type}
            />
            <div className="rounded-xl border border-border bg-card/50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Risk level
              </p>
              <div className="mt-1 flex items-center gap-2">
                <AlertTriangle
                  className={cn(
                    "size-4",
                    risk === "high"
                      ? "text-destructive"
                      : risk === "medium"
                        ? "text-amber-500"
                        : "text-emerald-500",
                  )}
                />
                <span className="text-sm font-medium capitalize">
                  {approval.risk_level ?? "Unknown"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-medium">Suggested response</label>
              {!editMode ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditMode(true)}
                  disabled={loading}
                >
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
              ) : null}
            </div>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={6}
              dir="auto"
              disabled={loading || !editMode}
              className={cn(
                "min-h-[140px] resize-y text-[15px] leading-relaxed",
                !editMode && "bg-muted/40",
              )}
            />
          </div>
        </div>

        <DialogFooter className="border-t border-border bg-muted/20 px-6 py-4 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Close
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void onReject()}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <X className="size-4" />
              )}
              Reject
            </Button>
            {editMode ? (
              <Button
                type="button"
                onClick={() => void onEditAndSend(draft.trim())}
                disabled={loading || !draft.trim()}
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Pencil className="size-4" />
                )}
                Edit & Send
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => void onApprove()}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                Approve & Send
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-foreground">
        {value?.trim() || "—"}
      </p>
    </div>
  );
}
