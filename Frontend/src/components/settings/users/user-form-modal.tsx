"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import type {
  TenantUser,
  TenantUserRole,
  TenantUserStatus,
} from "@/lib/types";
import { TENANT_USER_ROLES, formatRoleLabel } from "@/lib/users/roles";
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

export interface UserFormValues {
  email: string;
  display_name: string;
  role: TenantUserRole;
  status: TenantUserStatus;
}

const EMPTY_FORM: UserFormValues = {
  email: "",
  display_name: "",
  role: "agent",
  status: "active",
};

interface UserFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  user?: TenantUser | null;
  saving?: boolean;
  error?: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: UserFormValues) => Promise<void>;
}

export function UserFormModal({
  open,
  mode,
  user,
  saving = false,
  error,
  onOpenChange,
  onSubmit,
}: UserFormModalProps) {
  const [form, setForm] = useState<UserFormValues>(EMPTY_FORM);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && user) {
      setForm({
        email: user.email,
        display_name: user.display_name,
        role: user.role,
        status: user.status,
      });
      return;
    }
    setForm(EMPTY_FORM);
  }, [open, mode, user]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await onSubmit(form);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add user" : "Edit user"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Create a new team member with a role and access level."
              : "Update this team member's profile, role, or status."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          {mode === "create" ? (
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="user-email">
                Email
              </label>
              <Input
                id="user-email"
                type="email"
                required
                value={form.email}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, email: event.target.value }))
                }
                placeholder="name@company.com"
                disabled={saving}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                {form.email}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="user-display-name">
              Display name
            </label>
            <Input
              id="user-display-name"
              required
              value={form.display_name}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  display_name: event.target.value,
                }))
              }
              placeholder="Jane Smith"
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="user-role">
              Role
            </label>
            <Select
              value={form.role}
              onValueChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  role: value as TenantUserRole,
                }))
              }
              disabled={saving}
            >
              <SelectTrigger id="user-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TENANT_USER_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {formatRoleLabel(role)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="user-status">
              Status
            </label>
            <Select
              value={form.status}
              onValueChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  status: value as TenantUserStatus,
                }))
              }
              disabled={saving}
            >
              <SelectTrigger id="user-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
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
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {mode === "create" ? "Create user" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
