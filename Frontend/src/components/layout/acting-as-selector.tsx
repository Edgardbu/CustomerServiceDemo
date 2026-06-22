"use client";

import { ChevronDown, UserCog } from "lucide-react";
import { useCurrentUserStore } from "@/stores/current-user-store";
import { formatRoleLabel } from "@/lib/users/roles";
import { ContactAvatar } from "@/components/ui/contact-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function ActingAsSelector() {
  const users = useCurrentUserStore((state) => state.users);
  const selectedUserId = useCurrentUserStore((state) => state.selectedUserId);
  const setSelectedUserId = useCurrentUserStore(
    (state) => state.setSelectedUserId,
  );
  const currentUser = useCurrentUserStore((state) => state.getCurrentUser());

  const displayName = currentUser?.display_name ?? "Select user";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex max-w-[min(200px,28vw)] items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-1.5 py-1 text-start transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-[240px] sm:gap-2 sm:px-2 sm:py-1.5",
        )}
      >
        <UserCog className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
        <div className="min-w-0 flex-1">
          <p className="hidden truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:block">
            Acting as
          </p>
          <p className="truncate text-xs font-medium leading-tight">
            {displayName}
          </p>
        </div>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Development user impersonation
          </DropdownMenuLabel>
          {users.length === 0 ? (
            <DropdownMenuItem disabled>No users available</DropdownMenuItem>
          ) : (
            users.map((user) => (
              <DropdownMenuItem
                key={user.id}
                onClick={() => setSelectedUserId(user.id)}
                className="flex items-center gap-2"
              >
                <ContactAvatar name={user.display_name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {user.display_name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatRoleLabel(user.role)}
                    {user.status === "disabled" ? " · Disabled" : ""}
                  </p>
                </div>
                {user.id === selectedUserId ? (
                  <span className="text-[10px] font-medium text-primary">
                    Active
                  </span>
                ) : null}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface CurrentUserButtonProps {
  className?: string;
}

export function CurrentUserButton({ className }: CurrentUserButtonProps) {
  const currentUser = useCurrentUserStore((state) => state.getCurrentUser());
  const displayName = currentUser?.display_name ?? "Guest";
  const roleLabel = currentUser
    ? formatRoleLabel(currentUser.role)
    : "No user selected";

  return (
    <div className={cn("flex items-center gap-2 rounded-lg px-1.5 py-1", className)}>
      <ContactAvatar name={displayName} size="sm" />
      <div className="hidden text-start sm:block">
        <p className="text-xs font-medium leading-tight">{displayName}</p>
        <p className="text-[11px] leading-tight text-muted-foreground">
          {roleLabel}
        </p>
      </div>
    </div>
  );
}
