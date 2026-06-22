import { create } from "zustand";
import { api } from "@/lib/api";
import { TENANT_ID } from "@/lib/constants";
import { getStoredDemoUserId, setStoredDemoUserId } from "@/lib/demo-auth";
import type { TenantUser } from "@/lib/types";

interface CurrentUserState {
  users: TenantUser[];
  selectedUserId: string | null;
  loading: boolean;
  error: string | null;
  hydrated: boolean;

  getCurrentUser: () => TenantUser | null;
  hydrate: () => Promise<void>;
  setSelectedUserId: (userId: string | null) => void;
  setBootstrapUser: (user: TenantUser) => void;
  refreshUsers: () => Promise<void>;
}

function pickDefaultUserId(users: TenantUser[]): string | null {
  if (users.length === 0) return null;
  const active = users.find((user) => user.status === "active");
  return (active ?? users[0]).id;
}

export const useCurrentUserStore = create<CurrentUserState>((set, get) => ({
  users: [],
  selectedUserId: null,
  loading: false,
  error: null,
  hydrated: false,

  getCurrentUser: () => {
    const { users, selectedUserId } = get();
    if (!selectedUserId) return null;
    return users.find((user) => user.id === selectedUserId) ?? null;
  },

  hydrate: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });

    try {
      const users = await api.getTenantUsers(TENANT_ID);
      const storedId = getStoredDemoUserId();
      let selectedUserId = storedId;

      if (storedId && !users.some((user) => user.id === storedId)) {
        selectedUserId = null;
        setStoredDemoUserId(null);
      }

      if (!selectedUserId) {
        selectedUserId = pickDefaultUserId(users);
        if (selectedUserId) {
          setStoredDemoUserId(selectedUserId);
        }
      }

      set({
        users,
        selectedUserId,
        loading: false,
        hydrated: true,
        error: null,
      });
    } catch (err) {
      set({
        loading: false,
        hydrated: true,
        error: err instanceof Error ? err.message : "Failed to load users",
      });
    }
  },

  setSelectedUserId: (userId) => {
    setStoredDemoUserId(userId);
    set({ selectedUserId: userId });
  },

  setBootstrapUser: (user) => {
    setStoredDemoUserId(user.id);
    set({
      users: [user],
      selectedUserId: user.id,
      hydrated: true,
      loading: false,
      error: null,
    });
  },

  refreshUsers: async () => {
    try {
      const users = await api.getTenantUsers(TENANT_ID);
      const { selectedUserId } = get();

      if (selectedUserId && !users.some((user) => user.id === selectedUserId)) {
        const nextId = pickDefaultUserId(users);
        setStoredDemoUserId(nextId);
        set({ users, selectedUserId: nextId });
        return;
      }

      set({ users });
    } catch {
      // ignore background refresh failures
    }
  },
}));
