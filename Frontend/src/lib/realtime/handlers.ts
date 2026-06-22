import type { RealtimeEvent } from "@/lib/realtime/types";

import type { Conversation } from "@/lib/types";

import { ingestMessage, ingestMessages } from "@/lib/messages/ingest";

import {

  applyQueueAwareConversationUpdate,

  patchQueueAwareConversation,

} from "@/lib/conversations/queue-sync";

import { useApprovalStore } from "@/stores/approval-store";

import { useConversationStore } from "@/stores/conversation-store";

import { useFlowSessionStore } from "@/stores/flow-session-store";

import { applyConversationApprovalUpdate } from "@/lib/approvals/sync";
import { applyCustomerProfileByIdentity } from "@/lib/customer-profile-sync";



function patchConversationFields(

  conversationId: string,

  conversation?: Conversation,

  options?: { showAssignmentToast?: boolean },

) {

  if (!conversation) return;



  const existing = useConversationStore

    .getState()

    .conversations.find((item) => item.id === conversationId);



  const merged: Conversation = existing

    ? {

        ...existing,

        tenant_id: conversation.tenant_id,

        customer_id: conversation.customer_id,

        channel: conversation.channel,

        status: conversation.status,

        assigned_agent_id: conversation.assigned_agent_id,

        assigned_agent: conversation.assigned_agent,

        tags: conversation.tags,

        customer_profile: conversation.customer_profile,

        ai_status: conversation.ai_status,

        ai_auto_reply_enabled: conversation.ai_auto_reply_enabled,

        pending_ai_approval: conversation.pending_ai_approval,

        created_at: conversation.created_at,

        updated_at: conversation.updated_at,

      }

    : { ...conversation, messages: undefined };



  applyQueueAwareConversationUpdate(merged, {

    toTop: true,

    showAssignmentToast: options?.showAssignmentToast,

  });

}



export function handleRealtimeEvent(event: RealtimeEvent): void {
  const approvalStore = useApprovalStore.getState();



  switch (event.type) {

    case "message.created":

    case "message.sent": {

      ingestMessage(event.data.message);

      patchConversationFields(event.data.conversation_id, event.data.conversation);

      useFlowSessionStore

        .getState()

        .invalidateFlowSession(event.data.conversation_id);

      break;

    }

    case "conversation.created": {

      const { conversation } = event.data;

      applyQueueAwareConversationUpdate(

        { ...conversation, messages: undefined },

        { toTop: true },

      );

      if (conversation.messages?.length) {

        ingestMessages(conversation.id, conversation.messages);

      }

      break;

    }

    case "conversation.updated": {

      const { conversation } = event.data;

      patchConversationFields(conversation.id, conversation, {

        showAssignmentToast: true,

      });

      applyConversationApprovalUpdate(conversation);

      if (conversation.messages?.length) {

        ingestMessages(conversation.id, conversation.messages);

      }

      useFlowSessionStore.getState().invalidateFlowSession(conversation.id);

      break;

    }

    case "conversation.assigned": {

      const { conversation_id, assigned_agent_id, conversation } = event.data;

      if (conversation) {

        patchConversationFields(conversation.id, conversation, {

          showAssignmentToast: true,

        });

        break;

      }

      patchQueueAwareConversation(

        conversation_id,

        {

          assigned_agent_id,
          assigned_agent: null,

          updated_at: new Date().toISOString(),

        },

        { showAssignmentToast: true },

      );

      break;

    }

    case "ai.approval_requested": {

      const { approval, conversation } = event.data;

      approvalStore.setInconsistent(approval.conversation_id, false);

      approvalStore.setPendingApproval(approval);

      patchQueueAwareConversation(approval.conversation_id, {

        ai_status: "waiting_for_approval",

        pending_ai_approval: approval,

        updated_at: new Date().toISOString(),

        ...(conversation

          ? {

              customer_profile: conversation.customer_profile,

              ai_auto_reply_enabled: conversation.ai_auto_reply_enabled,

              tags: conversation.tags,

            }

          : {}),

      });

      if (conversation) {

        patchConversationFields(approval.conversation_id, conversation);

      }

      useFlowSessionStore

        .getState()

        .invalidateFlowSession(approval.conversation_id);

      break;

    }

    case "ai.approval_resolved": {

      const { approval_id, conversation_id, message, conversation } = event.data;

      approvalStore.clearPendingApproval(conversation_id);

      patchQueueAwareConversation(conversation_id, {

        ai_status: conversation?.ai_status ?? "active",

        ai_auto_reply_enabled: conversation?.ai_auto_reply_enabled,

        pending_ai_approval: null,

        updated_at: conversation?.updated_at ?? new Date().toISOString(),

      });

      if (conversation) {

        patchConversationFields(conversation_id, conversation);

      }

      if (message) {

        ingestMessage(message);

      }

      useFlowSessionStore.getState().invalidateFlowSession(conversation_id);

      void approval_id;

      break;

    }

    case "customer_profile.updated": {
      const { channel, external_id, customer_profile } = event.data;
      applyCustomerProfileByIdentity(channel, external_id, customer_profile);
      break;
    }

    default:

      break;

  }

}


