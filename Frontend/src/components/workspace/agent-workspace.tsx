"use client";



import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useSearchParams } from "next/navigation";

import { api } from "@/lib/api";

import {

  getAiSuggestionsToday,

  incrementAiSuggestionsToday,

} from "@/lib/ai-metrics";

import { TENANT_ID } from "@/lib/constants";
import type { AIUsedKnowledge } from "@/lib/types";

import type { Channel, ConversationFilters, Tenant } from "@/lib/types";

import { useSelectedConversation } from "@/hooks/use-selected-conversation";

import { AppShell } from "@/components/layout/app-shell";

import { ConversationList } from "@/components/inbox/conversation-list";

import { ChatWindow } from "@/components/inbox/chat-window";

import { CustomerPanel } from "@/components/inbox/customer-panel";

import { SuggestionModal } from "@/components/ai/suggestion-modal";

import { AISettingsPage } from "@/components/bot-studio/ai-settings/ai-settings-page";

import { ApprovalModalHost } from "@/components/ai/approval-modal-host";

import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";

import { workspaceViewFromSearchParam } from "@/lib/workspace-view";

import { useConversationStore } from "@/stores/conversation-store";

import { useCurrentUserStore } from "@/stores/current-user-store";

import { useMessageStore } from "@/stores/message-store";

import { ingestMessage, ingestMessages } from "@/lib/messages/ingest";

import { getCustomerSearchText } from "@/lib/customer-profile";

import {

  hydratePendingApprovals,

  syncConversationApproval,

} from "@/lib/approvals/sync";



function filterConversations(

  conversations: ReturnType<typeof useConversationStore.getState>["conversations"],

  filters: ConversationFilters,

) {

  return conversations.filter((conversation) => {

    if (filters.channel && filters.channel !== "all") {

      if (conversation.channel !== filters.channel) return false;

    }

    if (filters.search?.trim()) {

      const q = filters.search.trim().toLowerCase();

      const haystack = [

        getCustomerSearchText(conversation),

        conversation.assigned_agent?.display_name,

        conversation.assigned_agent?.email,

        ...(conversation.messages ?? []).map((m) => m.content),

      ]

        .join(" ")

        .toLowerCase();

      if (!haystack.includes(q)) return false;

    }

    return true;

  });

}



export function AgentWorkspace() {

  const searchParams = useSearchParams();

  const activeView = useMemo(

    () => workspaceViewFromSearchParam(searchParams.get("view")),

    [searchParams],

  );



  const conversations = useConversationStore((state) => state.conversations);

  const selectedId = useConversationStore((state) => state.selectedId);

  const initialLoading = useConversationStore((state) => state.initialLoading);

  const refreshing = useConversationStore((state) => state.refreshing);

  const listError = useConversationStore((state) => state.listError);

  const queueFilter = useConversationStore((state) => state.queueFilter);

  const channelFilter = useConversationStore((state) => state.channelFilter);

  const search = useConversationStore((state) => state.search);



  const setConversations = useConversationStore((state) => state.setConversations);

  const upsertConversation = useConversationStore((state) => state.upsertConversation);

  const selectConversation = useConversationStore((state) => state.selectConversation);

  const setInitialLoading = useConversationStore((state) => state.setInitialLoading);

  const setRefreshing = useConversationStore((state) => state.setRefreshing);

  const setListError = useConversationStore((state) => state.setListError);

  const setQueueFilter = useConversationStore((state) => state.setQueueFilter);

  const ensureQueueForRole = useConversationStore(

    (state) => state.ensureQueueForRole,

  );

  const setChannelFilter = useConversationStore((state) => state.setChannelFilter);

  const setSearch = useConversationStore((state) => state.setSearch);



  const currentUser = useCurrentUserStore((state) => state.getCurrentUser());

  const selectedUserId = useCurrentUserStore((state) => state.selectedUserId);

  const userHydrated = useCurrentUserStore((state) => state.hydrated);



  const hydrateFromConversations = useMessageStore(

    (state) => state.hydrateFromConversations,

  );



  const selectedConversation = useSelectedConversation();



  const [creating, setCreating] = useState(false);

  const [sending, setSending] = useState(false);

  const [suggesting, setSuggesting] = useState(false);

  const [reviewLoading, setReviewLoading] = useState(false);

  const [aiSuggestions, setAiSuggestions] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);

  const [suggestion, setSuggestion] = useState("");
  const [suggestionWhy, setSuggestionWhy] = useState("");
  const [suggestionConfidence, setSuggestionConfidence] = useState<number | undefined>();
  const [suggestionKnowledge, setSuggestionKnowledge] = useState<AIUsedKnowledge[]>(
    [],
  );

  const [reviewError, setReviewError] = useState<string | null>(null);

  const [tenant, setTenant] = useState<Tenant | null>(null);



  const isCreatingRef = useRef(false);

  const lastLoadedQueueRef = useRef<string | null>(null);

  const lastLoadedUserRef = useRef<string | null>(null);



  const filters = useMemo<ConversationFilters>(

    () => ({ queue: queueFilter, channel: channelFilter, search }),

    [queueFilter, channelFilter, search],

  );



  const visibleConversations = useMemo(

    () => filterConversations(conversations, filters),

    [conversations, filters],

  );



  const loadConversations = useCallback(async (silent = false) => {

    if (silent) {

      setRefreshing(true);

    } else {

      setInitialLoading(true);

    }

    setListError(null);



    const activeQueue = useConversationStore.getState().queueFilter;

    const activeChannel = useConversationStore.getState().channelFilter;



    try {

      const data = await api.getConversations({

        tenant_id: TENANT_ID,

        queue: activeQueue,

        ...(activeChannel !== "all" ? { channel: activeChannel } : {}),

      });

      setConversations(data);

      hydrateFromConversations(data);

      lastLoadedQueueRef.current = activeQueue;

      lastLoadedUserRef.current =

        useCurrentUserStore.getState().selectedUserId;



      try {

        await hydratePendingApprovals(TENANT_ID);

      } catch {

        /* approvals restore is best-effort; inbox still loads */

      }



      const selected = useConversationStore.getState().selectedId;

      const stillVisible = data.some((item) => item.id === selected);

      if (selected && stillVisible) {

        await syncConversationApproval(selected, TENANT_ID);

      } else if (data[0]) {

        selectConversation(data[0].id);

        await syncConversationApproval(data[0].id, TENANT_ID);

      } else {

        selectConversation(null);

      }

    } catch (err) {

      setListError(

        err instanceof Error ? err.message : "Failed to load conversations",

      );

    } finally {

      setInitialLoading(false);

      setRefreshing(false);

    }

  }, [

    hydrateFromConversations,

    selectConversation,

    setConversations,

    setInitialLoading,

    setListError,

    setRefreshing,

  ]);



  useEffect(() => {

    setAiSuggestions(getAiSuggestionsToday());

  }, []);



  useEffect(() => {

    let active = true;

    api

      .getTenant(TENANT_ID)

      .then((data) => {

        if (active) setTenant(data);

      })

      .catch(() => {

        if (active) setTenant(null);

      });

    return () => {

      active = false;

    };

  }, []);



  useEffect(() => {

    if (!userHydrated) return;

    ensureQueueForRole(currentUser?.role);

  }, [userHydrated, currentUser?.role, ensureQueueForRole]);



  useEffect(() => {

    if (!userHydrated) return;

    void loadConversations(false);

  }, [userHydrated, queueFilter, selectedUserId, loadConversations]);



  const handleQueueFilterChange = useCallback(

    (queue: typeof queueFilter) => {

      setQueueFilter(queue);

    },

    [setQueueFilter],

  );



  const handleChannelFilterChange = useCallback(

    (channel: Channel | "all") => {

      setChannelFilter(channel);

      void loadConversations(true);

    },

    [setChannelFilter, loadConversations],

  );



  const handleSearchChange = useCallback(

    (value: string) => {

      setSearch(value);

    },

    [setSearch],

  );



  const handleSelectConversation = useCallback(

    (conversationId: string) => {

      selectConversation(conversationId);

      void syncConversationApproval(conversationId, TENANT_ID);

    },

    [selectConversation],

  );



  async function handleCreateDemo() {

    if (isCreatingRef.current || creating) return;

    isCreatingRef.current = true;

    setCreating(true);

    setListError(null);

    try {

      const channels: Channel[] = [

        "whatsapp",

        "web_chat",

        "email",

        "sms",

        "facebook",

        "instagram",

      ];

      const channel = channels[Math.floor(Math.random() * channels.length)];

      const created = await api.createConversation({

        tenant_id: TENANT_ID,

        customer_id: `customer_${Date.now().toString().slice(-4)}`,

        channel,

      });



      upsertConversation(created, { toTop: true });

      ingestMessages(created.id, created.messages ?? []);

      selectConversation(created.id);

      setChannelFilter("all");

    } catch (err) {

      setListError(

        err instanceof Error ? err.message : "Failed to create conversation",

      );

    } finally {

      isCreatingRef.current = false;

      setCreating(false);

    }

  }



  async function handleSend(content: string) {

    if (!selectedConversation) return;

    setSending(true);

    try {

      const message = await api.sendMessage(selectedConversation.id, {

        tenant_id: TENANT_ID,

        sender_type: "agent",

        content,

        attachments: [],

      });



      ingestMessage(message);

    } catch (err) {

      setListError(

        err instanceof Error ? err.message : "Failed to send message",

      );

    } finally {

      setSending(false);

    }

  }



  async function handleSuggestReply(extraInstruction?: string) {
    if (!selectedConversation) return;
    setSuggesting(true);
    setReviewError(null);

    try {
      const response = await api.suggestReply(selectedConversation.id, {
        tenant_id: TENANT_ID,
        ...(extraInstruction?.trim()
          ? { extra_instruction: extraInstruction.trim() }
          : {}),
      });

      setSuggestion(response.suggested_reply);
      setSuggestionWhy(response.why_it_fits ?? "");
      setSuggestionConfidence(response.confidence);
      setSuggestionKnowledge(response.used_knowledge ?? []);
      setModalOpen(true);

      const count = incrementAiSuggestionsToday();
      setAiSuggestions(count);
    } catch (err) {
      setReviewError(
        err instanceof Error ? err.message : "Failed to get AI suggestion",
      );
      setSuggestion("");
      setSuggestionWhy("");
      setSuggestionConfidence(undefined);
      setSuggestionKnowledge([]);
      setModalOpen(true);
    } finally {
      setSuggesting(false);
    }
  }



  async function finalizeReview(
    _decision: "approve" | "reject",
    _comment: string | null,
    sendAsMessage: boolean,
  ) {
    if (!selectedConversation || !suggestion) return;
    setReviewLoading(true);
    setReviewError(null);

    try {
      if (sendAsMessage) {
        const message = await api.sendMessage(selectedConversation.id, {
          tenant_id: TENANT_ID,
          sender_type: "agent",
          content: suggestion,
          attachments: [],
        });
        ingestMessage(message);
      }

      setModalOpen(false);
      setSuggestion("");
      setSuggestionWhy("");
      setSuggestionConfidence(undefined);
      setSuggestionKnowledge([]);
    } catch (err) {
      setReviewError(
        err instanceof Error ? err.message : "Failed to submit review",
      );
    } finally {
      setReviewLoading(false);
    }
  }



  return (

    <AppShell

      tenant={tenant}

      workspaceView={activeView}

      onSearchChange={handleSearchChange}

    >

      {activeView === "ai-settings" ? (

        <AISettingsPage />

      ) : activeView === "analytics" ? (

        <AnalyticsDashboard />

      ) : (

        <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[clamp(280px,24%,360px)_minmax(0,1fr)] xl:grid-cols-[clamp(280px,23%,360px)_minmax(0,1fr)_clamp(280px,19%,340px)]">

          <div className="min-h-0 overflow-hidden">

            <ConversationList

              conversations={visibleConversations}

              selectedId={selectedId}

              loading={initialLoading && conversations.length === 0}

              refreshing={refreshing}

              error={listError}

              queueFilter={queueFilter}

              channelFilter={channelFilter}

              currentUserRole={currentUser?.role}

              aiSuggestionsToday={aiSuggestions}

              creating={creating}

              onSelect={(conversation) => handleSelectConversation(conversation.id)}

              onQueueFilterChange={handleQueueFilterChange}

              onChannelFilterChange={handleChannelFilterChange}

              onCreateDemo={() => void handleCreateDemo()}

              onRefresh={() => void loadConversations(true)}

            />

          </div>

          <div className="min-h-0 overflow-hidden">

            <ChatWindow

              sending={sending}

              suggesting={suggesting}

              onSend={handleSend}

              onSuggestReply={(extraInstruction) =>
                void handleSuggestReply(extraInstruction)
              }

            />

          </div>

          <div className="hidden min-h-0 overflow-hidden xl:block">

            <CustomerPanel conversation={selectedConversation} />

          </div>

        </div>

      )}



      <ApprovalModalHost />



      <SuggestionModal
        open={modalOpen}
        suggestion={suggestion}
        whyItFits={suggestionWhy}
        confidence={suggestionConfidence}
        usedKnowledge={suggestionKnowledge}
        loading={reviewLoading}
        error={reviewError}
        onOpenChange={setModalOpen}

        onApprove={() => finalizeReview("approve", null, true)}

        onReject={() => finalizeReview("reject", null, false)}

        onApproveWithComment={(comment) =>

          finalizeReview("approve", comment, true)

        }

        onRejectWithComment={(comment) =>

          finalizeReview("reject", comment, false)

        }

      />

    </AppShell>

  );

}


