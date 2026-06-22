import { create } from "zustand";
import { api } from "@/lib/api";
import { TENANT_ID } from "@/lib/constants";
import type { BootstrapStatus } from "@/lib/types";

interface BootstrapState {
  status: BootstrapStatus | null;
  loading: boolean;
  error: string | null;
  checked: boolean;

  isBootstrapRequired: () => boolean;
  fetchStatus: () => Promise<BootstrapStatus>;
  markBootstrapComplete: () => void;
}

export const useBootstrapStore = create<BootstrapState>((set, get) => ({
  status: null,
  loading: false,
  error: null,
  checked: false,

  isBootstrapRequired: () => {
    const { status } = get();
    return Boolean(status?.bootstrap_required);
  },

  fetchStatus: async () => {
    set({ loading: true, error: null });
    try {
      const status = await api.getBootstrapStatus(TENANT_ID);
      set({ status, loading: false, checked: true, error: null });
      return status;
    } catch (err) {
      set({
        loading: false,
        checked: true,
        error:
          err instanceof Error ? err.message : "Failed to check bootstrap status",
      });
      throw err;
    }
  },

  markBootstrapComplete: () => {
    set((state) => ({
      status: state.status
        ? {
            ...state.status,
            bootstrap_required: false,
            has_owner_or_admin: true,
          }
        : {
            bootstrap_enabled: true,
            has_owner_or_admin: true,
            bootstrap_required: false,
          },
    }));
  },
}));
