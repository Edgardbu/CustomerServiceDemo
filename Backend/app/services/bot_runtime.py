import logging

from app.domain.models.ai import (
    AIApprovalRequest,
    AIAutoReplyDecision,
    AIConversationStatus,
    AISettings,
    ApprovalStatus,
    DEFAULT_APPROVAL_HANDOFF_MESSAGE,
    RiskLevel,
    SuggestedActionType,
)
from app.domain.models.bot import BotAction
from app.domain.models.bot_flow import FlowNodeType, FlowStepResult
from app.domain.models.conversation import Channel, Conversation, DeliveryStatus, Message, SenderType
from app.domain.models.inbound import InboundCustomerMessage
from app.domain.ports.ai_approval_repository import AIApprovalRepository
from app.domain.ports.ai_provider import AIProvider
from app.domain.ports.ai_settings_repository import AISettingsRepository
from app.domain.ports.bot_flow_repository import BotFlowRepository
from app.domain.ports.bot_flow_session_repository import BotFlowSessionRepository
from app.domain.ports.channel_provider import ChannelProvider
from app.domain.ports.conversation_ai_notes_repository import ConversationAINotesRepository
from app.domain.ports.conversation_repository import ConversationRepository
from app.domain.ports.customer_profile_repository import CustomerProfileRepository
from app.domain.ports.realtime import RealtimePublisher
from app.domain.ports.user_repository import UserRepository
from app.services.ai_autoreply import (
    generate_ai_decision,
    load_relevant_knowledge_for_conversation,
    should_auto_send,
)
from app.services.bot_orchestrator import (
    HANDOFF_TO_HUMAN_TAG,
    BotOrchestrator,
    build_orchestration_context,
    should_auto_reply_from_bot,
    should_handoff_without_approval,
    should_route_to_approval,
)
from app.services.channel_outbound import send_conversation_message
from app.services.customer_profiles import enrich_conversation_read_with_repos
from app.services.flow_engine import FlowEngine, find_node
from app.services.knowledge import KnowledgeService

logger = logging.getLogger(__name__)

WAITING_TAG = "waiting_for_ai_approval"
HANDOFF_NOTICE_METADATA = {"type": "handoff_notice"}


class BotRuntimeService:
    def __init__(
        self,
        *,
        conversation_repository: ConversationRepository,
        ai_settings_repository: AISettingsRepository,
        conversation_ai_notes_repository: ConversationAINotesRepository,
        customer_profile_repository: CustomerProfileRepository,
        ai_approval_repository: AIApprovalRepository,
        user_repository: UserRepository,
        bot_flow_repository: BotFlowRepository,
        bot_flow_session_repository: BotFlowSessionRepository,
        flow_engine: FlowEngine,
        bot_orchestrator: BotOrchestrator,
        knowledge_service: KnowledgeService,
        ai_provider: AIProvider,
        channels: dict[Channel, ChannelProvider],
        realtime: RealtimePublisher,
    ) -> None:
        self._conversations = conversation_repository
        self._ai_settings = ai_settings_repository
        self._ai_notes = conversation_ai_notes_repository
        self._customer_profiles = customer_profile_repository
        self._ai_approvals = ai_approval_repository
        self._users = user_repository
        self._bot_flows = bot_flow_repository
        self._bot_flow_sessions = bot_flow_session_repository
        self._flow_engine = flow_engine
        self._bot_orchestrator = bot_orchestrator
        self._knowledge_service = knowledge_service
        self._ai = ai_provider
        self._channels = channels
        self._realtime = realtime

    async def handle_inbound_customer_message(
        self,
        tenant_id: str,
        conversation: Conversation,
        customer_message: InboundCustomerMessage,
    ) -> None:
        saved_message = await self._ensure_customer_message_saved(
            tenant_id=tenant_id,
            conversation=conversation,
            customer_message=customer_message,
        )
        conversation = await self._reload_conversation(tenant_id, conversation.id)
        if conversation is None:
            return

        await self._publish_customer_message_events(tenant_id, conversation, saved_message)

        if self._is_runtime_stopped(conversation):
            return

        message_text = saved_message.content.strip()
        customer_message_id = saved_message.id

        if await self._handle_active_flow_session(
            tenant_id=tenant_id,
            conversation=conversation,
            customer_message_id=customer_message_id,
            message_text=message_text,
        ):
            return

        settings = await self._ai_settings.get_by_tenant(tenant_id)
        if settings is None or not settings.enabled or not settings.auto_reply_enabled:
            return

        notes_row = await self._ai_notes.get_by_conversation(
            tenant_id=tenant_id,
            conversation_id=conversation.id,
        )
        customer_profile = await self._customer_profiles.get_by_external_id(
            tenant_id=tenant_id,
            channel=conversation.channel,
            external_id=conversation.customer_id,
        )
        conversation_notes = notes_row.notes if notes_row else ""
        relevant_knowledge = await load_relevant_knowledge_for_conversation(
            self._knowledge_service,
            conversation,
        )

        orchestration_context = build_orchestration_context(
            settings_row=settings,
            conversation=conversation,
            conversation_notes=conversation_notes,
            customer_profile=customer_profile,
            relevant_knowledge=relevant_knowledge,
        )
        bot_decision = await self._bot_orchestrator.decide(orchestration_context)

        if bot_decision.action == BotAction.ignore:
            return

        if await self._try_start_flow_from_intent(
            tenant_id=tenant_id,
            conversation=conversation,
            customer_message_id=customer_message_id,
            message_text=message_text,
            bot_decision=bot_decision,
            settings=settings,
        ):
            return

        if should_handoff_without_approval(bot_decision):
            await self._handoff_to_human(
                tenant_id=tenant_id,
                conversation=conversation,
                settings=settings,
                reason_summary=bot_decision.reason_summary,
            )
            return

        ai_decision = await generate_ai_decision(
            ai_provider=self._ai,
            settings_row=settings,
            conversation=conversation,
            conversation_notes=conversation_notes,
            customer_profile=customer_profile,
            bot_decision=bot_decision,
            relevant_knowledge=relevant_knowledge,
        )
        if ai_decision is None or not ai_decision.suggested_response.strip():
            return

        if should_route_to_approval(bot_decision) or not should_auto_send(ai_decision):
            await self._create_approval_request(
                tenant_id=tenant_id,
                conversation=conversation,
                customer_message_id=customer_message_id,
                decision=ai_decision,
                settings=settings,
            )
            return

        if should_auto_reply_from_bot(bot_decision) and should_auto_send(ai_decision):
            await self._send_bot_reply(
                tenant_id=tenant_id,
                conversation=conversation,
                text=ai_decision.suggested_response.strip(),
            )
            return

        await self._create_approval_request(
            tenant_id=tenant_id,
            conversation=conversation,
            customer_message_id=customer_message_id,
            decision=ai_decision,
            settings=settings,
        )

    async def _ensure_customer_message_saved(
        self,
        *,
        tenant_id: str,
        conversation: Conversation,
        customer_message: InboundCustomerMessage,
    ) -> Message:
        if customer_message.id:
            for message in conversation.messages:
                if message.id == customer_message.id:
                    return message

        if customer_message.external_message_id:
            for message in conversation.messages:
                if message.external_message_id == customer_message.external_message_id:
                    return message

        return await self._conversations.add_message(
            tenant_id=tenant_id,
            conversation_id=conversation.id,
            sender_type=SenderType.customer,
            content=customer_message.content,
            attachments=customer_message.attachments,
            external_message_id=customer_message.external_message_id,
            metadata=customer_message.metadata,
        )

    async def _reload_conversation(
        self,
        tenant_id: str,
        conversation_id: str,
    ) -> Conversation | None:
        return await self._conversations.get_conversation(
            tenant_id=tenant_id,
            conversation_id=conversation_id,
        )

    async def _enrich(self, conversation: Conversation):
        return await enrich_conversation_read_with_repos(
            conversation=conversation,
            customer_profile_repository=self._customer_profiles,
            ai_approval_repository=self._ai_approvals,
            user_repository=self._users,
        )

    async def _publish_customer_message_events(
        self,
        tenant_id: str,
        conversation: Conversation,
        message: Message,
    ) -> None:
        conversation_read = await self._enrich(conversation)
        await self._realtime.publish(
            tenant_id=tenant_id,
            event="message.created",
            payload=message.model_dump(mode="json"),
        )
        await self._realtime.publish(
            tenant_id=tenant_id,
            event="conversation.updated",
            payload=conversation_read.model_dump(mode="json"),
        )

    def _is_runtime_stopped(self, conversation: Conversation) -> bool:
        if not conversation.ai_auto_reply_enabled:
            return True
        if conversation.ai_status == AIConversationStatus.paused.value:
            return True
        if conversation.ai_status == AIConversationStatus.waiting_for_approval.value:
            return True
        return False

    async def _handle_active_flow_session(
        self,
        *,
        tenant_id: str,
        conversation: Conversation,
        customer_message_id: str,
        message_text: str,
    ) -> bool:
        active_session = await self._bot_flow_sessions.get_active_by_conversation(
            tenant_id,
            conversation.id,
        )
        if active_session is None:
            return False

        result = await self._flow_engine.handle_customer_message(
            conversation=conversation,
            message=message_text,
        )
        if result is None:
            return False

        settings = await self._ai_settings.get_by_tenant(tenant_id)
        await self._apply_flow_step_result(
            tenant_id=tenant_id,
            conversation=conversation,
            customer_message_id=customer_message_id,
            result=result,
            settings=settings,
        )
        return True

    async def _try_start_flow_from_intent(
        self,
        *,
        tenant_id: str,
        conversation: Conversation,
        customer_message_id: str,
        message_text: str,
        bot_decision,
        settings: AISettings | None,
    ) -> bool:
        if bot_decision.action != BotAction.continue_flow:
            return False

        flow = await self._bot_flows.find_by_trigger_intent(
            tenant_id,
            bot_decision.intent.value,
        )
        if flow is None:
            return False

        _session, start_result = await self._flow_engine.start_flow(
            tenant_id,
            conversation.id,
            flow.id,
        )
        results = [start_result]

        active_session = await self._bot_flow_sessions.get_active_by_conversation(
            tenant_id,
            conversation.id,
        )
        if active_session and message_text.strip():
            current_node = find_node(flow.definition, active_session.current_node_id)
            if current_node and current_node.get("type") == FlowNodeType.input.value:
                continue_result = await self._flow_engine.continue_flow(
                    session=active_session,
                    message=message_text,
                    flow=flow,
                    conversation=conversation,
                )
                results.append(continue_result)

        merged = _merge_flow_results(*results)
        await self._apply_flow_step_result(
            tenant_id=tenant_id,
            conversation=conversation,
            customer_message_id=customer_message_id,
            result=merged,
            settings=settings,
        )
        return True

    async def _apply_flow_step_result(
        self,
        *,
        tenant_id: str,
        conversation: Conversation,
        customer_message_id: str,
        result: FlowStepResult,
        settings: AISettings | None,
    ) -> None:
        messages = result.messages_to_send or (
            [result.message_to_send] if result.message_to_send else []
        )
        for text in messages:
            if not text or not text.strip():
                continue
            conversation = await self._send_bot_reply(
                tenant_id=tenant_id,
                conversation=conversation,
                text=text.strip(),
            )

        if result.handoff_required:
            await self._handoff_to_human(
                tenant_id=tenant_id,
                conversation=conversation,
                settings=settings,
                reason_summary="Flow handoff node reached.",
            )
            return

        if result.needs_approval and result.approval_suggested_response:
            flow_decision = AIAutoReplyDecision(
                requires_approval=True,
                suggested_response=result.approval_suggested_response.strip(),
                customer_summary=result.approval_customer_summary or "Flow approval step",
                ai_reasoning_summary="Approval required by bot flow.",
                suggested_action_type=SuggestedActionType.other,
                risk_level=RiskLevel.medium,
            )
            await self._create_approval_request(
                tenant_id=tenant_id,
                conversation=conversation,
                customer_message_id=customer_message_id,
                decision=flow_decision,
                settings=settings,
            )

    async def _send_bot_reply(
        self,
        *,
        tenant_id: str,
        conversation: Conversation,
        text: str,
    ) -> Conversation:
        message = await send_conversation_message(
            conversation_repository=self._conversations,
            channels=self._channels,
            conversation=conversation,
            tenant_id=tenant_id,
            conversation_id=conversation.id,
            content=text,
            sender_type=SenderType.bot,
            ai_generated=True,
        )

        updated = await self._conversations.update_ai_state(
            tenant_id=tenant_id,
            conversation_id=conversation.id,
            ai_status=AIConversationStatus.active.value,
        )
        conversation_read = await self._enrich(updated)

        await self._realtime.publish(
            tenant_id=tenant_id,
            event="message.created",
            payload=message.model_dump(mode="json"),
        )
        await self._realtime.publish(
            tenant_id=tenant_id,
            event="message.sent",
            payload=message.model_dump(mode="json"),
        )
        await self._realtime.publish(
            tenant_id=tenant_id,
            event="conversation.updated",
            payload=conversation_read.model_dump(mode="json"),
        )
        return updated

    async def _handoff_to_human(
        self,
        *,
        tenant_id: str,
        conversation: Conversation,
        settings: AISettings | None,
        reason_summary: str,
    ) -> None:
        handoff_text = _resolve_handoff_message(settings)
        handoff_message = await send_conversation_message(
            conversation_repository=self._conversations,
            channels=self._channels,
            conversation=conversation,
            tenant_id=tenant_id,
            conversation_id=conversation.id,
            content=handoff_text,
            sender_type=SenderType.bot,
            ai_generated=True,
            metadata=HANDOFF_NOTICE_METADATA,
            delivery_status=DeliveryStatus.sent,
        )

        await self._realtime.publish(
            tenant_id=tenant_id,
            event="message.created",
            payload=handoff_message.model_dump(mode="json"),
        )

        conversation = await self._reload_conversation(tenant_id, conversation.id)
        tags = list(conversation.tags) if conversation else []
        if HANDOFF_TO_HUMAN_TAG not in tags:
            tags.append(HANDOFF_TO_HUMAN_TAG)

        updated = await self._conversations.update_ai_state(
            tenant_id=tenant_id,
            conversation_id=conversation.id,
            ai_auto_reply_enabled=False,
            ai_status=AIConversationStatus.paused.value,
            tags=tags,
        )
        conversation_read = await self._enrich(updated)

        logger.info(
            "[bot-runtime] handoff tenant=%s conversation=%s reason=%s",
            tenant_id,
            conversation.id,
            reason_summary,
        )

        await self._realtime.publish(
            tenant_id=tenant_id,
            event="conversation.updated",
            payload=conversation_read.model_dump(mode="json"),
        )

    async def _create_approval_request(
        self,
        *,
        tenant_id: str,
        conversation: Conversation,
        customer_message_id: str,
        decision: AIAutoReplyDecision,
        settings: AISettings | None,
    ) -> None:
        handoff_text = _resolve_handoff_message(settings)
        handoff_message = await send_conversation_message(
            conversation_repository=self._conversations,
            channels=self._channels,
            conversation=conversation,
            tenant_id=tenant_id,
            conversation_id=conversation.id,
            content=handoff_text,
            sender_type=SenderType.bot,
            ai_generated=True,
            metadata=HANDOFF_NOTICE_METADATA,
            delivery_status=DeliveryStatus.sent,
        )

        await self._realtime.publish(
            tenant_id=tenant_id,
            event="message.created",
            payload=handoff_message.model_dump(mode="json"),
        )

        approval = AIApprovalRequest(
            tenant_id=tenant_id,
            conversation_id=conversation.id,
            customer_message_id=customer_message_id,
            status=ApprovalStatus.pending,
            customer_summary=decision.customer_summary,
            ai_reasoning_summary=decision.ai_reasoning_summary,
            suggested_response=decision.suggested_response.strip(),
            suggested_action_type=decision.suggested_action_type,
            risk_level=decision.risk_level,
            requires_approval=True,
            customer_notified_handoff=True,
        )
        approval = await self._ai_approvals.create(approval)

        conversation = await self._reload_conversation(tenant_id, conversation.id)
        tags = list(conversation.tags) if conversation else []
        if WAITING_TAG not in tags:
            tags.append(WAITING_TAG)

        updated = await self._conversations.update_ai_state(
            tenant_id=tenant_id,
            conversation_id=conversation.id,
            ai_status=AIConversationStatus.waiting_for_approval.value,
            tags=tags,
        )
        conversation_read = await self._enrich(updated)

        await self._realtime.publish(
            tenant_id=tenant_id,
            event="ai.approval_requested",
            payload=approval.model_dump(mode="json"),
        )
        await self._realtime.publish(
            tenant_id=tenant_id,
            event="conversation.updated",
            payload=conversation_read.model_dump(mode="json"),
        )


def _resolve_handoff_message(settings: AISettings | None) -> str:
    if settings is None:
        return DEFAULT_APPROVAL_HANDOFF_MESSAGE
    text = settings.approval_handoff_message.strip()
    return text or DEFAULT_APPROVAL_HANDOFF_MESSAGE


def _merge_flow_results(*results: FlowStepResult) -> FlowStepResult:
    merged = FlowStepResult()
    for result in results:
        merged.messages_to_send.extend(result.messages_to_send)
        merged.needs_approval = merged.needs_approval or result.needs_approval
        merged.handoff_required = merged.handoff_required or result.handoff_required
        merged.completed = merged.completed or result.completed
        if result.approval_suggested_response:
            merged.approval_suggested_response = result.approval_suggested_response
        if result.approval_customer_summary:
            merged.approval_customer_summary = result.approval_customer_summary
    merged.message_to_send = merged.messages_to_send[-1] if merged.messages_to_send else None
    return merged
