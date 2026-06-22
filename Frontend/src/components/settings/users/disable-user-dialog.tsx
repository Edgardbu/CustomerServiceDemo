"use client";

import { Ban, Loader2 } from "lucide-react";
import type { TenantUser } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DisableUserDialogProps {
  open: boolean;
  user: TenantUser | null;
  disabling?: boolean;
  error?: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}

export function DisableUserDialog({
  open,
  user,
  disabling = false,
  error,
  onOpenChange,
  onConfirm,
}: DisableUserDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Disable user?</DialogTitle>
          <DialogDescription>
            This will disable{" "}
            <span className="font-medium text-foreground">
              {user?.display_name ?? "this user"}
            </span>
            . They will no longer be able to access the workspace, but their
            account history is preserved.
          </DialogDescription>
        </DialogHeader>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={disabling}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void onConfirm()}
            disabled={disabling || !user}
          >
            {disabling ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Ban className="size-4" />
            )}
            Disable user
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
