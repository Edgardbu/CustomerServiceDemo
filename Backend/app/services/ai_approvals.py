import logging
from datetime import datetime, timezone

from app.core.container import AppContainer
from app.domain.models.ai import (
    AIApprovalRequest,
    AIConversationStatus,
    ApprovalStatus,
)
from app.domain.models.conversation import SenderType
from app.services.channel_outbound import send_conversation_message
from app.services.customer_profiles import enrich_conversation_read

logger = logging.getLogger(__name__)

WAITING_TAG = "waiting_for_ai_approval"


async def approve_request(
    *,
    container: AppContainer,
    tenant_id: str,
    approval_id: str,
) -> AIApprovalRequest:
    approval = await _get_pending_approval(container, tenant_id, approval_id)
    conversation = await _get_conversation(container, tenant_id, approval.conversation_id)

    message = await send_conversation_message(
        conversation_repository=container.conversation_repository,
        channels=container.channels,
        conversation=conversation,
        tenant_id=tenant_id,
        conversation_id=approval.conversation_id,
        content=approval.suggested_response,
        sender_type=SenderType.agent,
        ai_generated=True,
        ai_approval_request_id=approval.id,
    )

    approval.status = ApprovalStatus.sent
    approval.final_response = approval.suggested_response
    approval.updated_at = datetime.now(timezone.utc)
    approval = await container.ai_approval_repository.update(approval)

    await _clear_waiting_state(
        container,
        tenant_id,
        approval.conversation_id,
        message,
        approval,
    )
    return approval


async def reject_request(
    *,
    container: AppContainer,
    tenant_id: str,
    approval_id: str,
) -> AIApprovalRequest:
    approval = await _get_pending_approval(container, tenant_id, approval_id)
    approval.status = ApprovalStatus.rejected
    approval.updated_at = datetime.now(timezone.utc)
    approval = await container.ai_approval_repository.update(approval)
    await _clear_waiting_state(
        container,
        tenant_id,
        approval.conversation_id,
        None,
        approval,
    )
    return approval


async def edit_and_send_request(
    *,
    container: AppContainer,
    tenant_id: str,
    approval_id: str,
    final_response: str,
) -> AIApprovalRequest:
    approval = await _get_pending_approval(container, tenant_id, approval_id)
    conversation = await _get_conversation(container, tenant_id, approval.conversation_id)
    text = final_response.strip()
    if not text:
        raise ValueError("final_response cannot be empty")

    message = await send_conversation_message(
        conversation_repository=container.conversation_repository,
        channels=container.channels,
        conversation=conversation,
        tenant_id=tenant_id,
        conversation_id=approval.conversation_id,
        content=text,
        sender_type=SenderType.agent,
        ai_generated=True,
        ai_approval_request_id=approval.id,
    )

    approval.status = ApprovalStatus.edited
    approval.agent_edit = text
    approval.final_response = text
    approval.updated_at = datetime.now(timezone.utc)
    approval = await container.ai_approval_repository.update(approval)

    await _clear_waiting_state(
        container,
        tenant_id,
        approval.conversation_id,
        message,
        approval,
    )
    return approval


async def _get_pending_approval(
    container: AppContainer,
    tenant_id: str,
    approval_id: str,
) -> AIApprovalRequest:
    approval = await container.ai_approval_repository.get_by_id(tenant_id, approval_id)
    if approval is None:
        raise ValueError("Approval request not found")
    if approval.status != ApprovalStatus.pending:
        raise ValueError("Approval request is not pending")
    return approval


async def _get_conversation(container: AppContainer, tenant_id: str, conversation_id: str):
    conversation = await container.conversation_repository.get_conversation(
        tenant_id=tenant_id,
        conversation_id=conversation_id,
    )
    if conversation is None:
        raise ValueError("Conversation not found")
    return conversation


async def _clear_waiting_state(
    container: AppContainer,
    tenant_id: str,
    conversation_id: str,
    message,
    approval: AIApprovalRequest,
) -> None:
    conversation = await container.conversation_repository.get_conversation(
        tenant_id=tenant_id,
        conversation_id=conversation_id,
    )
    tags = [tag for tag in (conversation.tags if conversation else []) if tag != WAITING_TAG]
    updated = await container.conversation_repository.update_ai_state(
        tenant_id=tenant_id,
        conversation_id=conversation_id,
        ai_status=AIConversationStatus.active.value,
        tags=tags,
    )
    conversation_read = await enrich_conversation_read(
        container=container,
        conversation=updated,
    )

    if message is not None:
        await container.realtime.publish(
            tenant_id=tenant_id,
            event="message.created",
            payload=message.model_dump(mode="json"),
        )
        await container.realtime.publish(
            tenant_id=tenant_id,
            event="message.sent",
            payload=message.model_dump(mode="json"),
        )

    await container.realtime.publish(
        tenant_id=tenant_id,
        event="ai.approval_resolved",
        payload=approval.model_dump(mode="json"),
    )
    await container.realtime.publish(
        tenant_id=tenant_id,
        event="conversation.updated",
        payload=conversation_read.model_dump(mode="json"),
    )
