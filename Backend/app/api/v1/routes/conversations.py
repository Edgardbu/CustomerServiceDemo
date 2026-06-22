from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException

from app.api.dependencies import get_container
from app.core.container import AppContainer
from app.domain.models.ai import AIConversationStatus
from app.domain.models.conversation import Channel, ConversationStatus, SenderType
from app.domain.models.user import User
from app.schemas.ai import (
    AIApprovalRead,
    AgentReplySuggestRequest,
    AgentReplySuggestResponse,
    ConversationAINotesRead,
    ConversationAINotesUpdate,
)
from app.schemas.bot_flow import BotFlowSessionRead, CancelFlowSessionRequest
from app.schemas.conversations import (
    ConversationCreate,
    ConversationRead,
    MessageCreate,
    MessageRead,
)
from app.schemas.users import (
    ConversationAssignRequest,
    ConversationTenantAction,
    ConversationTransferRequest,
)
from app.services.conversation_assignments import (
    assign_conversation,
    claim_conversation,
    transfer_conversation,
)
from app.services.conversation_queues import ConversationQueue, filter_conversations_by_queue
from app.services.current_user import DEMO_USER_HEADER, get_current_user, resolve_current_user
from app.services.customer_profiles import enrich_conversation_read, enrich_conversations_read
from app.services.outbound_messages import create_outbound_message
from app.services.agent_reply_suggestion import (
    assert_can_suggest_reply,
    generate_agent_reply_suggestion,
)
from app.services.permissions import can_reply_to_conversation

router = APIRouter()


@router.post("", response_model=ConversationRead)
async def create_conversation(
    payload: ConversationCreate,
    container: AppContainer = Depends(get_container),
):
    conversation = await container.conversation_repository.create_conversation(
        tenant_id=payload.tenant_id,
        customer_id=payload.customer_id,
        channel=payload.channel,
    )

    conversation_read = await enrich_conversation_read(
        container=container,
        conversation=conversation,
    )

    await container.realtime.publish(
        tenant_id=payload.tenant_id,
        event="conversation.created",
        payload=conversation_read.model_dump(mode="json"),
    )

    return conversation_read


@router.get("", response_model=list[ConversationRead])
async def list_conversations(
    tenant_id: str,
    queue: ConversationQueue = ConversationQueue.all,
    status: ConversationStatus | None = None,
    channel: Channel | None = None,
    container: AppContainer = Depends(get_container),
    current_user: User = Depends(get_current_user),
):
    conversations = await container.conversation_repository.list_conversations(
        tenant_id=tenant_id,
        status=status,
        channel=channel,
    )
    filtered = filter_conversations_by_queue(
        conversations,
        queue=queue,
        current_user=current_user,
    )
    return await enrich_conversations_read(
        container=container,
        conversations=filtered,
    )


@router.get("/{conversation_id}", response_model=ConversationRead)
async def get_conversation(
    conversation_id: str,
    tenant_id: str,
    container: AppContainer = Depends(get_container),
):
    conversation = await container.conversation_repository.get_conversation(
        tenant_id=tenant_id,
        conversation_id=conversation_id,
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return await enrich_conversation_read(
        container=container,
        conversation=conversation,
    )


@router.get("/{conversation_id}/ai/approval", response_model=AIApprovalRead)
async def get_conversation_pending_approval(
    conversation_id: str,
    tenant_id: str,
    container: AppContainer = Depends(get_container),
):
    conversation = await container.conversation_repository.get_conversation(
        tenant_id=tenant_id,
        conversation_id=conversation_id,
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    approval = await container.ai_approval_repository.get_pending_by_conversation(
        tenant_id=tenant_id,
        conversation_id=conversation_id,
    )
    if approval is None:
        raise HTTPException(status_code=404, detail="No pending AI approval for conversation")

    return AIApprovalRead.from_domain(approval)


@router.get("/{conversation_id}/flow-session", response_model=BotFlowSessionRead)
async def get_conversation_flow_session(
    conversation_id: str,
    tenant_id: str,
    container: AppContainer = Depends(get_container),
):
    conversation = await container.conversation_repository.get_conversation(
        tenant_id=tenant_id,
        conversation_id=conversation_id,
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    session = await container.bot_flow_session_repository.get_active_by_conversation(
        tenant_id=tenant_id,
        conversation_id=conversation_id,
    )
    if session is None:
        raise HTTPException(status_code=404, detail="No active flow session for conversation")

    flow = await container.bot_flow_repository.get_by_id(tenant_id, session.flow_id)
    return BotFlowSessionRead.from_domain(session, flow_name=flow.name if flow else None)


@router.post("/{conversation_id}/flow-session/cancel", response_model=BotFlowSessionRead)
async def cancel_conversation_flow_session(
    conversation_id: str,
    payload: CancelFlowSessionRequest,
    container: AppContainer = Depends(get_container),
):
    conversation = await container.conversation_repository.get_conversation(
        tenant_id=payload.tenant_id,
        conversation_id=conversation_id,
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    session = await container.bot_flow_session_repository.get_active_by_conversation(
        tenant_id=payload.tenant_id,
        conversation_id=conversation_id,
    )
    if session is None:
        raise HTTPException(status_code=404, detail="No active flow session for conversation")

    session = await container.flow_engine.cancel_flow(session)
    flow = await container.bot_flow_repository.get_by_id(payload.tenant_id, session.flow_id)
    return BotFlowSessionRead.from_domain(session, flow_name=flow.name if flow else None)


@router.post("/{conversation_id}/messages", response_model=MessageRead)
async def add_message(
    conversation_id: str,
    payload: MessageCreate,
    container: AppContainer = Depends(get_container),
    x_demo_user_id: str | None = Header(default=None, alias=DEMO_USER_HEADER),
):
    conversation = await container.conversation_repository.get_conversation(
        tenant_id=payload.tenant_id,
        conversation_id=conversation_id,
    )

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if payload.sender_type in {SenderType.agent, SenderType.bot}:
        current_user = await resolve_current_user(
            tenant_id=payload.tenant_id,
            user_repository=container.user_repository,
            demo_user_id=x_demo_user_id,
        )
        if not can_reply_to_conversation(
            current_user,
            conversation_assigned_agent_id=conversation.assigned_agent_id,
        ):
            raise HTTPException(status_code=403, detail="Not allowed to reply to this conversation")

    message = await create_outbound_message(
        container=container,
        conversation=conversation,
        conversation_id=conversation_id,
        payload=payload,
    )

    await container.realtime.publish(
        tenant_id=payload.tenant_id,
        event="message.created",
        payload=message.model_dump(mode="json"),
    )

    if payload.sender_type in {SenderType.agent, SenderType.bot}:
        await container.realtime.publish(
            tenant_id=payload.tenant_id,
            event="message.sent",
            payload=message.model_dump(mode="json"),
        )

    return message


@router.get("/{conversation_id}/ai-notes", response_model=ConversationAINotesRead)
async def get_conversation_ai_notes(
    conversation_id: str,
    tenant_id: str,
    container: AppContainer = Depends(get_container),
):
    notes = await container.conversation_ai_notes_repository.get_by_conversation(
        tenant_id=tenant_id,
        conversation_id=conversation_id,
    )
    if notes is None:
        return ConversationAINotesRead(
            tenant_id=tenant_id,
            conversation_id=conversation_id,
            notes="",
            updated_at=datetime.now(timezone.utc),
        )
    return ConversationAINotesRead(
        tenant_id=notes.tenant_id,
        conversation_id=notes.conversation_id,
        notes=notes.notes,
        updated_at=notes.updated_at,
    )


@router.put("/{conversation_id}/ai-notes", response_model=ConversationAINotesRead)
async def update_conversation_ai_notes(
    conversation_id: str,
    payload: ConversationAINotesUpdate,
    container: AppContainer = Depends(get_container),
):
    notes = await container.conversation_ai_notes_repository.upsert(
        tenant_id=payload.tenant_id,
        conversation_id=conversation_id,
        notes=payload.notes,
    )
    return ConversationAINotesRead(
        tenant_id=notes.tenant_id,
        conversation_id=notes.conversation_id,
        notes=notes.notes,
        updated_at=notes.updated_at,
    )


@router.post("/{conversation_id}/ai/pause", response_model=ConversationRead)
async def pause_conversation_ai(
    conversation_id: str,
    tenant_id: str,
    container: AppContainer = Depends(get_container),
):
    try:
        conversation = await container.conversation_repository.update_ai_state(
            tenant_id=tenant_id,
            conversation_id=conversation_id,
            ai_auto_reply_enabled=False,
            ai_status=AIConversationStatus.paused.value,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    conversation_read = await enrich_conversation_read(
        container=container,
        conversation=conversation,
    )
    await container.realtime.publish(
        tenant_id=tenant_id,
        event="conversation.updated",
        payload=conversation_read.model_dump(mode="json"),
    )
    return conversation_read


@router.post("/{conversation_id}/ai/resume", response_model=ConversationRead)
async def resume_conversation_ai(
    conversation_id: str,
    tenant_id: str,
    container: AppContainer = Depends(get_container),
):
    try:
        conversation = await container.conversation_repository.update_ai_state(
            tenant_id=tenant_id,
            conversation_id=conversation_id,
            ai_auto_reply_enabled=True,
            ai_status=AIConversationStatus.active.value,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    conversation_read = await enrich_conversation_read(
        container=container,
        conversation=conversation,
    )
    await container.realtime.publish(
        tenant_id=tenant_id,
        event="conversation.updated",
        payload=conversation_read.model_dump(mode="json"),
    )
    return conversation_read


@router.post(
    "/{conversation_id}/ai/suggest-reply",
    response_model=AgentReplySuggestResponse,
)
async def suggest_agent_reply(
    conversation_id: str,
    payload: AgentReplySuggestRequest,
    container: AppContainer = Depends(get_container),
    x_demo_user_id: str | None = Header(default=None, alias=DEMO_USER_HEADER),
):
    current_user = await resolve_current_user(
        tenant_id=payload.tenant_id,
        user_repository=container.user_repository,
        demo_user_id=x_demo_user_id,
    )
    assert_can_suggest_reply(current_user)

    suggestion = await generate_agent_reply_suggestion(
        container=container,
        tenant_id=payload.tenant_id,
        conversation_id=conversation_id,
        extra_instruction=payload.extra_instruction,
    )

    return AgentReplySuggestResponse.from_domain(
        conversation_id=conversation_id,
        suggestion=suggestion,
    )


@router.post("/{conversation_id}/claim", response_model=ConversationRead)
async def claim_conversation_endpoint(
    conversation_id: str,
    payload: ConversationTenantAction,
    container: AppContainer = Depends(get_container),
    x_demo_user_id: str | None = Header(default=None, alias=DEMO_USER_HEADER),
):
    current_user = await resolve_current_user(
        tenant_id=payload.tenant_id,
        user_repository=container.user_repository,
        demo_user_id=x_demo_user_id,
    )
    return await claim_conversation(
        container=container,
        tenant_id=payload.tenant_id,
        conversation_id=conversation_id,
        current_user=current_user,
    )


@router.post("/{conversation_id}/assign", response_model=ConversationRead)
async def assign_conversation_endpoint(
    conversation_id: str,
    payload: ConversationAssignRequest,
    container: AppContainer = Depends(get_container),
    x_demo_user_id: str | None = Header(default=None, alias=DEMO_USER_HEADER),
):
    current_user = await resolve_current_user(
        tenant_id=payload.tenant_id,
        user_repository=container.user_repository,
        demo_user_id=x_demo_user_id,
    )
    return await assign_conversation(
        container=container,
        tenant_id=payload.tenant_id,
        conversation_id=conversation_id,
        agent_id=payload.agent_id,
        current_user=current_user,
    )


@router.post("/{conversation_id}/transfer", response_model=ConversationRead)
async def transfer_conversation_endpoint(
    conversation_id: str,
    payload: ConversationTransferRequest,
    container: AppContainer = Depends(get_container),
    x_demo_user_id: str | None = Header(default=None, alias=DEMO_USER_HEADER),
):
    current_user = await resolve_current_user(
        tenant_id=payload.tenant_id,
        user_repository=container.user_repository,
        demo_user_id=x_demo_user_id,
    )
    return await transfer_conversation(
        container=container,
        tenant_id=payload.tenant_id,
        conversation_id=conversation_id,
        agent_id=payload.agent_id,
        current_user=current_user,
    )
