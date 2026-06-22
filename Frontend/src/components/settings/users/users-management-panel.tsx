"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { TENANT_ID } from "@/lib/constants";
import type { TenantUser } from "@/lib/types";
import { canManageUsers } from "@/lib/users/roles";
import { useToast } from "@/components/providers/toast-provider";
import { useBootstrapStore } from "@/stores/bootstrap-store";
import { useCurrentUserStore } from "@/stores/current-user-store";
import { Button, buttonVariants } from "@/components/ui/button";
import { UserList } from "@/components/settings/users/user-list";
import {
  UserFormModal,
  type UserFormValues,
} from "@/components/settings/users/user-form-modal";
import { DisableUserDialog } from "@/components/settings/users/disable-user-dialog";
import { cn } from "@/lib/utils";

type ModalMode = "create" | "edit" | null;

const PERMISSION_MESSAGE = "You do not have permission.";

export function UsersManagementPanel() {
  const { showSuccess, showError } = useToast();
  const currentUser = useCurrentUserStore((state) => state.getCurrentUser());
  const selectedUserId = useCurrentUserStore((state) => state.selectedUserId);
  const demoUsers = useCurrentUserStore((state) => state.users);
  const refreshDemoUsers = useCurrentUserStore((state) => state.refreshUsers);
  const userStoreHydrated = useCurrentUserStore((state) => state.hydrated);
  const bootstrapRequired = useBootstrapStore((state) =>
    Boolean(state.status?.bootstrap_required),
  );

  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedUser, setSelectedUser] = useState<TenantUser | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [disableTarget, setDisableTarget] = useState<TenantUser | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [disableError, setDisableError] = useState<string | null>(null);

  const allowed = canManageUsers(currentUser?.role);

  const loadUsers = useCallback(
    async (silent = false) => {
      if (!userStoreHydrated) return;
      if (!allowed) {
        setLoading(false);
        return;
      }

      if (silent) setRefreshing(true);
      else setLoading(true);

      setListError(null);
      setForbidden(false);

      try {
        const data = await api.getTenantUsers(TENANT_ID);
        setUsers(
          [...data].sort((a, b) =>
            a.display_name.localeCompare(b.display_name),
          ),
        );
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) {
          setForbidden(true);
          setUsers([]);
        } else {
          setListError(
            err instanceof Error ? err.message : "Failed to load users",
          );
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [allowed, userStoreHydrated],
  );

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  function openCreateModal() {
    setSelectedUser(null);
    setFormError(null);
    setModalMode("create");
  }

  function openEditModal(user: TenantUser) {
    setSelectedUser(user);
    setFormError(null);
    setModalMode("edit");
  }

  function closeModal() {
    if (formSaving) return;
    setModalMode(null);
    setSelectedUser(null);
    setFormError(null);
  }

  async function handleFormSubmit(values: UserFormValues) {
    setFormSaving(true);
    setFormError(null);

    try {
      if (modalMode === "create") {
        await api.createTenantUser({
          tenant_id: TENANT_ID,
          email: values.email.trim(),
          display_name: values.display_name.trim(),
          role: values.role,
          status: values.status,
        });
        showSuccess("User created");
      } else if (selectedUser) {
        await api.updateTenantUser(selectedUser.id, {
          display_name: values.display_name.trim(),
          role: values.role,
          status: values.status,
        });
        showSuccess("User updated");
      }

      closeModal();
      await loadUsers(true);
      await refreshDemoUsers();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setFormError(PERMISSION_MESSAGE);
      } else {
        setFormError(
          err instanceof Error ? err.message : "Failed to save user",
        );
      }
    } finally {
      setFormSaving(false);
    }
  }

  async function handleDisableConfirm() {
    if (!disableTarget) return;

    setDisabling(true);
    setDisableError(null);

    try {
      await api.disableTenantUser(disableTarget.id, TENANT_ID);
      showSuccess(`${disableTarget.display_name} has been disabled`);
      setDisableTarget(null);
      await loadUsers(true);
      await refreshDemoUsers();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setDisableError(PERMISSION_MESSAGE);
      } else {
        setDisableError(
          err instanceof Error ? err.message : "Failed to disable user",
        );
      }
    } finally {
      setDisabling(false);
    }
  }

  if (!userStoreHydrated) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading workspace…
      </div>
    );
  }

  if (bootstrapRequired && demoUsers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-card/50 px-6 py-20 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck className="size-6" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">Create the first owner</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            No owner or admin exists yet. Bootstrap the workspace before managing
            team members.
          </p>
        </div>
        <Link href="/bootstrap" className={cn(buttonVariants())}>
          <ShieldCheck className="size-4" />
          Create first owner
        </Link>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-20 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="size-6" />
        </div>
        <p className="text-sm font-medium">{PERMISSION_MESSAGE}</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          User management is restricted to workspace owners and administrators.
        </p>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-20 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="size-6" />
        </div>
        <p className="text-sm font-medium">{PERMISSION_MESSAGE}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {users.length} team member{users.length === 1 ? "" : "s"}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadUsers(true)}
            disabled={refreshing || loading}
          >
            {refreshing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Refresh
          </Button>
          <Button type="button" size="sm" onClick={openCreateModal}>
            <Plus className="size-4" />
            Add user
          </Button>
        </div>
      </div>

      {listError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {listError}
        </div>
      ) : null}

      <UserList
        users={users}
        loading={loading}
        currentUserId={selectedUserId}
        onEdit={openEditModal}
        onDisable={(user) => {
          setDisableError(null);
          setDisableTarget(user);
        }}
      />

      <UserFormModal
        open={modalMode !== null}
        mode={modalMode === "edit" ? "edit" : "create"}
        user={selectedUser}
        saving={formSaving}
        error={formError}
        onOpenChange={(open) => {
          if (!open) closeModal();
        }}
        onSubmit={handleFormSubmit}
      />

      <DisableUserDialog
        open={disableTarget !== null}
        user={disableTarget}
        disabling={disabling}
        error={disableError}
        onOpenChange={(open) => {
          if (!open && !disabling) {
            setDisableTarget(null);
            setDisableError(null);
          }
        }}
        onConfirm={handleDisableConfirm}
      />
    </div>
  );
}
