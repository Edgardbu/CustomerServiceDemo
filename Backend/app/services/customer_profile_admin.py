from fastapi import HTTPException

from app.core.container import AppContainer
from app.domain.models.conversation import Channel, ConversationStatus
from app.domain.models.user import User, UserRole
from app.schemas.customer_profiles import CustomerProfileRead, CustomerProfileUpdate
from app.services.customer_profiles import enrich_conversation_read


def assert_can_view_customer_profile(current_user: User) -> None:
    if current_user.role not in {
        UserRole.owner,
        UserRole.admin,
        UserRole.agent,
        UserRole.viewer,
    }:
        raise HTTPException(status_code=403, detail="Not allowed to view customer profiles")


def assert_can_edit_customer_profile(current_user: User) -> None:
    if current_user.role == UserRole.viewer:
        raise HTTPException(status_code=403, detail="Viewers cannot edit customer profiles")
    if current_user.role not in {UserRole.owner, UserRole.admin, UserRole.agent}:
        raise HTTPException(status_code=403, detail="Not allowed to edit customer profiles")


def _display_fields_changed(
    existing,
    *,
    display_name: str | None,
    username: str | None,
    profile_picture_url: str | None,
) -> bool:
    if existing is None:
        return any(
            value is not None and str(value).strip()
            for value in (display_name, username, profile_picture_url)
        )

    return (
        (display_name or None) != (existing.display_name or None)
        or (username or None) != (existing.username or None)
        or (profile_picture_url or None) != (existing.profile_picture_url or None)
    )


async def get_customer_profile_read(
    *,
    container: AppContainer,
    tenant_id: str,
    channel: Channel,
    external_id: str,
) -> CustomerProfileRead:
    profile = await container.customer_profile_repository.get_by_external_id(
        tenant_id=tenant_id,
        channel=channel,
        external_id=external_id,
    )
    if profile is None:
        return CustomerProfileRead.fallback(external_id, channel)
    return CustomerProfileRead.from_profile(profile)


async def update_customer_profile_by_agent(
    *,
    container: AppContainer,
    tenant_id: str,
    channel: Channel,
    external_id: str,
    payload: CustomerProfileUpdate,
    current_user: User,
) -> CustomerProfileRead:
    existing = await container.customer_profile_repository.get_by_external_id(
        tenant_id=tenant_id,
        channel=channel,
        external_id=external_id,
    )

    profile_overridden = existing.profile_overridden if existing else False
    if _display_fields_changed(
        existing,
        display_name=payload.display_name,
        username=payload.username,
        profile_picture_url=payload.profile_picture_url,
    ):
        profile_overridden = True

    profile = await container.customer_profile_repository.update_agent_profile(
        tenant_id=tenant_id,
        channel=channel,
        external_id=external_id,
        display_name=payload.display_name,
        username=payload.username,
        profile_picture_url=payload.profile_picture_url,
        agent_label=payload.agent_label,
        agent_notes=payload.agent_notes,
        profile_overridden=profile_overridden,
        updated_by_user_id=current_user.id,
    )

    profile_read = CustomerProfileRead.from_profile(profile)
    await _broadcast_profile_updates(
        container=container,
        tenant_id=tenant_id,
        channel=channel,
        external_id=external_id,
        profile_read=profile_read,
    )
    return profile_read


async def _broadcast_profile_updates(
    *,
    container: AppContainer,
    tenant_id: str,
    channel: Channel,
    external_id: str,
    profile_read: CustomerProfileRead,
) -> None:
    await container.realtime.publish(
        tenant_id=tenant_id,
        event="customer_profile.updated",
        payload=profile_read.model_dump(mode="json"),
    )

    conversations = await container.conversation_repository.list_conversations(
        tenant_id=tenant_id,
        channel=channel,
    )
    for conversation in conversations:
        if conversation.customer_id != external_id:
            continue
        if conversation.status == ConversationStatus.closed:
            continue

        conversation_read = await enrich_conversation_read(
            container=container,
            conversation=conversation,
        )
        await container.realtime.publish(
            tenant_id=tenant_id,
            event="conversation.updated",
            payload=conversation_read.model_dump(mode="json"),
        )
