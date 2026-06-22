from fastapi import HTTPException

from app.core.container import AppContainer
from app.domain.models.conversation import Conversation
from app.domain.models.user import User, UserRole, UserStatus
from app.schemas.conversations import ConversationRead
from app.services.customer_profiles import enrich_conversation_read
from app.services.permissions import (
    Permission,
    can_assign_conversation,
    can_transfer_conversation,
    require_permission,
)


async def _validate_target_agent(
    container: AppContainer,
    *,
    tenant_id: str,
    agent_id: str,
) -> User:
    agent = await container.user_repository.get_by_id(tenant_id, agent_id)
    if agent is None or agent.status != UserStatus.active:
        raise HTTPException(status_code=404, detail="Target agent not found or inactive")
    if agent.role not in {UserRole.agent, UserRole.admin, UserRole.owner}:
        raise HTTPException(status_code=400, detail="Target user cannot be assigned conversations")
    return agent


async def claim_conversation(
    *,
    container: AppContainer,
    tenant_id: str,
    conversation_id: str,
    current_user: User,
) -> ConversationRead:
    require_permission(current_user, Permission.claim_conversation)

    conversation = await container.conversation_repository.get_conversation(
        tenant_id=tenant_id,
        conversation_id=conversation_id,
    )
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if conversation.assigned_agent_id and conversation.assigned_agent_id != current_user.id:
        raise HTTPException(status_code=409, detail="Conversation is already assigned")

    updated = await container.conversation_repository.update_assignment(
        tenant_id=tenant_id,
        conversation_id=conversation_id,
        assigned_agent_id=current_user.id,
    )
    return await _publish_conversation_update(container, updated)


async def assign_conversation(
    *,
    container: AppContainer,
    tenant_id: str,
    conversation_id: str,
    agent_id: str,
    current_user: User,
) -> ConversationRead:
    conversation = await container.conversation_repository.get_conversation(
        tenant_id=tenant_id,
        conversation_id=conversation_id,
    )
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if not can_assign_conversation(
        current_user,
        conversation_assigned_agent_id=conversation.assigned_agent_id,
        target_agent_id=agent_id,
    ):
        raise HTTPException(status_code=403, detail="Not allowed to assign this conversation")

    await _validate_target_agent(container, tenant_id=tenant_id, agent_id=agent_id)

    updated = await container.conversation_repository.update_assignment(
        tenant_id=tenant_id,
        conversation_id=conversation_id,
        assigned_agent_id=agent_id,
    )
    return await _publish_conversation_update(container, updated)


async def transfer_conversation(
    *,
    container: AppContainer,
    tenant_id: str,
    conversation_id: str,
    agent_id: str,
    current_user: User,
) -> ConversationRead:
    conversation = await container.conversation_repository.get_conversation(
        tenant_id=tenant_id,
        conversation_id=conversation_id,
    )
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if not can_transfer_conversation(
        current_user,
        conversation_assigned_agent_id=conversation.assigned_agent_id,
    ):
        raise HTTPException(status_code=403, detail="Not allowed to transfer this conversation")

    await _validate_target_agent(container, tenant_id=tenant_id, agent_id=agent_id)

    updated = await container.conversation_repository.update_assignment(
        tenant_id=tenant_id,
        conversation_id=conversation_id,
        assigned_agent_id=agent_id,
    )
    return await _publish_conversation_update(container, updated)


async def _publish_conversation_update(
    container: AppContainer,
    conversation: Conversation,
) -> ConversationRead:
    conversation_read = await enrich_conversation_read(
        container=container,
        conversation=conversation,
    )
    await container.realtime.publish(
        tenant_id=conversation.tenant_id,
        event="conversation.updated",
        payload=conversation_read.model_dump(mode="json"),
    )
    return conversation_read
