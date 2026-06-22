"use client";

import { useEffect } from "react";
import { useFlowSessionStore } from "@/stores/flow-session-store";

export function useFlowSession(conversationId: string | null) {
  const entry = useFlowSessionStore((state) =>
    conversationId ? state.byConversation[conversationId] : undefined,
  );
  const fetchFlowSession = useFlowSessionStore(
    (state) => state.fetchFlowSession,
  );

  useEffect(() => {
    if (!conversationId) return;
    void fetchFlowSession(conversationId);
  }, [conversationId, fetchFlowSession]);

  return {
    session: entry?.data ?? null,
    loading: entry?.loading ?? Boolean(conversationId),
    error: entry?.error ?? null,
    refresh: () => {
      if (conversationId) void fetchFlowSession(conversationId);
    },
  };
}
