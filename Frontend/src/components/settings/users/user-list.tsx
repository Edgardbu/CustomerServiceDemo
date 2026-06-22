"use client";

import { Ban, Pencil } from "lucide-react";
import type { TenantUser } from "@/lib/types";
import { formatRelativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ContactAvatar } from "@/components/ui/contact-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleBadge } from "@/components/settings/users/role-badge";
import { UserStatusBadge } from "@/components/settings/users/user-status-badge";

interface UserListProps {
  users: TenantUser[];
  loading?: boolean;
  currentUserId?: string | null;
  onEdit: (user: TenantUser) => void;
  onDisable: (user: TenantUser) => void;
}

export function UserList({
  users,
  loading = false,
  currentUserId,
  onEdit,
  onDisable,
}: UserListProps) {
  if (loading) {
    return (
      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="ml-auto h-5 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
        <p className="text-sm font-medium">No users yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Invite your first team member to collaborate in this workspace.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-start text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last seen</th>
              <th className="px-4 py-3 text-end font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              const canDisable = user.status === "active" && !isSelf;

              return (
                <tr
                  key={user.id}
                  className="group transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <ContactAvatar name={user.display_name} size="sm" />
                      <button
                        type="button"
                        onClick={() => onEdit(user)}
                        className="max-w-[220px] truncate text-start font-medium text-foreground transition-colors group-hover:text-primary"
                      >
                        {user.display_name}
                        {isSelf ? (
                          <span className="ms-1.5 text-[11px] font-normal text-muted-foreground">
                            (you)
                          </span>
                        ) : null}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {user.email}
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="px-4 py-3">
                    <UserStatusBadge status={user.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {user.last_seen_at
                      ? formatRelativeTime(user.last_seen_at)
                      : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => onEdit(user)}
                        aria-label={`Edit ${user.display_name}`}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        onClick={() => onDisable(user)}
                        disabled={!canDisable}
                        aria-label={`Disable ${user.display_name}`}
                        title={
                          isSelf
                            ? "You cannot disable your own account"
                            : user.status === "disabled"
                              ? "User is already disabled"
                              : "Disable user"
                        }
                      >
                        <Ban className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
