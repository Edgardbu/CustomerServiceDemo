import { create } from "zustand";

import { mergeConversation, mergeCustomerProfile } from "@/lib/customer-profile";
import { conversationMatchesCustomerIdentity } from "@/lib/customer-profile-sync";

import { ingestMessages } from "@/lib/messages/ingest";

import type {

  Channel,
  Conversation,
  ConversationQueue,
  CustomerProfile,
  Message,
  UpdateCustomerProfileRequest,
} from "@/lib/types";

import { getAvailableQueues, getDefaultQueueForRole } from "@/lib/conversations/queues";



interface UpsertOptions {

  toTop?: boolean;

}



interface ConversationState {

  conversations: Conversation[];

  selectedId: string | null;

  initialLoading: boolean;

  refreshing: boolean;

  listError: string | null;

  queueFilter: ConversationQueue;

  channelFilter: Channel | "all";

  search: string;



  setConversations: (conversations: Conversation[]) => void;

  upsertConversation: (

    conversation: Conversation,

    options?: UpsertOptions,

  ) => void;

  patchConversation: (id: string, patch: Partial<Conversation>) => void;

  applyCustomerProfileByIdentity: (
    channel: Channel,
    externalId: string,
    profile: CustomerProfile,
  ) => void;

  removeConversation: (id: string) => void;

  applyIncomingMessage: (conversationId: string, message: Message) => void;

  moveToTop: (id: string) => void;

  selectConversation: (id: string | null) => void;

  setInitialLoading: (loading: boolean) => void;

  setRefreshing: (refreshing: boolean) => void;

  setListError: (error: string | null) => void;

  setQueueFilter: (queue: ConversationQueue) => void;

  ensureQueueForRole: (role?: string | null) => void;

  setChannelFilter: (channel: Channel | "all") => void;

  setSearch: (search: string) => void;

  clear: () => void;

}



function upsertInList(

  list: Conversation[],

  conversation: Conversation,

  toTop: boolean,

): Conversation[] {

  const existing = list.find((item) => item.id === conversation.id);

  const merged = existing ? mergeConversation(existing, conversation) : conversation;

  const without = list.filter((item) => item.id !== conversation.id);

  return toTop

    ? [merged, ...without]

    : [...without, merged].sort((a, b) => {

        const aTime = new Date(a.updated_at ?? a.created_at ?? 0).getTime();

        const bTime = new Date(b.updated_at ?? b.created_at ?? 0).getTime();

        return bTime - aTime;

      });

}



export const useConversationStore = create<ConversationState>((set, get) => ({

  conversations: [],

  selectedId: null,

  initialLoading: true,

  refreshing: false,

  listError: null,

  queueFilter: "human_needed",

  channelFilter: "all",

  search: "",



  setConversations: (conversations) => set({ conversations }),



  upsertConversation: (conversation, options) => {

    set((state) => ({

      conversations: upsertInList(

        state.conversations,

        conversation,

        options?.toTop ?? true,

      ),

    }));

  },



  patchConversation: (id, patch) => {

    set((state) => {

      const existing = state.conversations.find((item) => item.id === id);

      if (!existing) return state;



      const updated: Conversation = {

        ...existing,

        ...patch,

        id: existing.id,

        messages: existing.messages,

        assigned_agent:

          patch.assigned_agent !== undefined

            ? patch.assigned_agent

            : existing.assigned_agent,

        customer_profile:

          patch.customer_profile !== undefined

            ? mergeCustomerProfile(

                existing.customer_profile,

                patch.customer_profile,

              )

            : existing.customer_profile,

      };



      return {

        conversations: upsertInList(state.conversations, updated, true),

      };

    });

  },



  applyCustomerProfileByIdentity: (channel, externalId, profile) => {

    set((state) => {

      let changed = false;

      const conversations = state.conversations.map((conversation) => {

        if (

          !conversationMatchesCustomerIdentity(

            conversation,

            channel,

            externalId,

          )

        ) {

          return conversation;

        }

        changed = true;

        return {

          ...conversation,

          customer_profile: {

            ...profile,

            external_id: profile.external_id || externalId,

            channel: profile.channel || channel,

          },

        };

      });

      if (!changed) return state;

      return { conversations };

    });

  },



  removeConversation: (id) => {

    set((state) => ({

      conversations: state.conversations.filter((item) => item.id !== id),

      selectedId: state.selectedId === id ? null : state.selectedId,

    }));

  },



  applyIncomingMessage: (conversationId, message) => {

    set((state) => {

      const existing = state.conversations.find(

        (item) => item.id === conversationId,

      );



      const mergedMessages = existing?.messages?.some(

        (item) => item.id === message.id,

      )

        ? (existing.messages ?? [])

        : [...(existing?.messages ?? []), message];



      const updated: Conversation = existing

        ? {

            ...existing,

            messages: mergedMessages,

            updated_at: message.created_at,

          }

        : {

            id: conversationId,

            tenant_id: message.tenant_id ?? "demo",

            customer_id: conversationId,

            channel: "instagram",

            status: "open",

            messages: [message],

            updated_at: message.created_at,

          };



      return {

        conversations: upsertInList(state.conversations, updated, true),

      };

    });

  },



  moveToTop: (id) => {

    const conversation = get().conversations.find((item) => item.id === id);

    if (!conversation) return;

    set((state) => ({

      conversations: upsertInList(state.conversations, conversation, true),

    }));

  },



  selectConversation: (id) => {

    set({ selectedId: id });

    if (!id) return;



    const conversation = get().conversations.find((item) => item.id === id);

    if (conversation?.messages?.length) {

      ingestMessages(id, conversation.messages);

    }

  },



  setInitialLoading: (initialLoading) => set({ initialLoading }),

  setRefreshing: (refreshing) => set({ refreshing }),

  setListError: (listError) => set({ listError }),

  setQueueFilter: (queueFilter) => set({ queueFilter }),

  ensureQueueForRole: (role) => {
    const { queueFilter } = get();
    const available = getAvailableQueues(role);
    if (!available.includes(queueFilter)) {
      set({ queueFilter: getDefaultQueueForRole(role) });
    }
  },

  setChannelFilter: (channelFilter) => set({ channelFilter }),

  setSearch: (search) => set({ search }),



  clear: () =>

    set({

      conversations: [],

      selectedId: null,

      initialLoading: true,

      refreshing: false,

      listError: null,

      queueFilter: "human_needed",

      channelFilter: "all",

      search: "",

    }),

}));


