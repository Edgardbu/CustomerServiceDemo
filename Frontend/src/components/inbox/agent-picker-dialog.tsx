"use client";

import { useMemo, useState } from "react";
import { Loader2, Search, UserRound } from "lucide-react";
import type { TenantUser } from "@/lib/types";
import { isAssignableAgentRole } from "@/lib/conversations/permissions";
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
import { ContactAvatar } from "@/components/ui/contact-avatar";
import { cn } from "@/lib/utils";

interface AgentPickerDialogProps {
  open: boolean;
  title: string;
  description: string;
  users: TenantUser[];
  loading?: boolean;
  submitting?: boolean;
  excludeUserId?: string | null;
  onOpenChange: (open: boolean) => void;
  onSelect: (user: TenantUser) => Promise<void>;
}

export function AgentPickerDialog({
  open,
  title,
  description,
  users,
  loading = false,
  submitting = false,
  excludeUserId,
  onOpenChange,
  onSelect,
}: AgentPickerDialogProps) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const agents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .filter(
        (user) =>
          user.status === "active" &&
          isAssignableAgentRole(user.role) &&
          user.id !== excludeUserId,
      )
      .filter((user) => {
        if (!q) return true;
        return [user.display_name, user.email]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
  }, [users, query, excludeUserId]);

  async function handleSelect(user: TenantUser) {
    setError(null);
    try {
      await onSelect(user);
      onOpenChange(false);
      setQuery("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) {
          onOpenChange(next);
          if (!next) {
            setQuery("");
            setError(null);
          }
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or email"
            className="ps-9"
            disabled={loading || submitting}
          />
        </div>

        <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading agents…
            </div>
          ) : agents.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No active agents match your search.
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {agents.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleSelect(user)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2.5 text-start transition-colors hover:bg-muted/50",
                      submitting && "pointer-events-none opacity-60",
                    )}
                  >
                    <ContactAvatar name={user.display_name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {user.display_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                    <UserRound className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
