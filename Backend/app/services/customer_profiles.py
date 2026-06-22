import logging
from typing import TYPE_CHECKING

from app.domain.models.ai import AIApprovalRequest, ApprovalStatus
from app.domain.models.conversation import Channel, Conversation
from app.domain.models.customer_profile import CustomerProfile
from app.domain.models.user import User
from app.infrastructure.channels.instagram.instagram_provider import InstagramProvider
from app.infrastructure.channels.messenger.messenger_provider import MessengerProvider
from app.infrastructure.channels.whatsapp.whatsapp_provider import WhatsAppProvider
from app.schemas.ai import AIApprovalRead
from app.schemas.conversations import ConversationRead, CustomerProfileRead
from app.schemas.users import UserRead

if TYPE_CHECKING:
    from app.core.container import AppContainer

logger = logging.getLogger(__name__)


async def sync_instagram_customer_profile(
    *,
    container: "AppContainer",
    tenant_id: str,
    external_id: str,
    provider: InstagramProvider,
) -> CustomerProfile | None:
    try:
        ig_profile = await provider.get_user_profile(external_id)
        return await container.customer_profile_repository.upsert_profile(
            tenant_id=tenant_id,
            channel=Channel.instagram,
            external_id=external_id,
            display_name=ig_profile.display_name,
            username=ig_profile.username,
            profile_picture_url=ig_profile.profile_picture_url,
            raw_profile=ig_profile.raw_profile,
        )
    except Exception:
        logger.warning(
            "[instagram] failed to fetch/store profile external_id=%s",
            external_id,
            exc_info=True,
        )
        return None


async def sync_messenger_customer_profile(
    *,
    container: "AppContainer",
    tenant_id: str,
    external_id: str,
    provider: MessengerProvider,
) -> CustomerProfile | None:
    try:
        messenger_profile = await provider.get_user_profile(external_id)
        return await container.customer_profile_repository.upsert_profile(
            tenant_id=tenant_id,
            channel=Channel.facebook,
            external_id=external_id,
            display_name=messenger_profile.display_name,
            username=messenger_profile.username,
            profile_picture_url=messenger_profile.profile_picture_url,
            raw_profile=messenger_profile.raw_profile,
        )
    except Exception:
        logger.warning(
            "[messenger] failed to fetch/store profile external_id=%s",
            external_id,
            exc_info=True,
        )
        return None


async def sync_whatsapp_customer_profile(
    *,
    container: "AppContainer",
    tenant_id: str,
    external_id: str,
    provider: WhatsAppProvider,
    display_name: str | None = None,
) -> CustomerProfile | None:
    try:
        if not display_name:
            wa_profile = provider.get_user_profile(external_id)
            display_name = wa_profile.display_name

        return await container.customer_profile_repository.upsert_profile(
            tenant_id=tenant_id,
            channel=Channel.whatsapp,
            external_id=external_id,
            display_name=display_name or external_id,
            username=None,
            profile_picture_url=None,
            raw_profile={"wa_id": external_id, "display_name": display_name},
        )
    except Exception:
        logger.warning(
            "[whatsapp] failed to fetch/store profile external_id=%s",
            external_id,
            exc_info=True,
        )
        return None


def profile_summary_for_conversation(
    conversation: Conversation,
    profile: CustomerProfile | None,
) -> CustomerProfileRead | None:
    if profile is not None:
        return CustomerProfileRead.from_profile(profile)
    if conversation.channel in {
        Channel.instagram,
        Channel.facebook,
        Channel.whatsapp,
        Channel.sms,
        Channel.email,
    }:
        return CustomerProfileRead.fallback(conversation.customer_id, conversation.channel)
    return None


def to_conversation_read(
    conversation: Conversation,
    profile: CustomerProfile | None = None,
    pending_approval: AIApprovalRequest | None = None,
    assigned_agent: User | None = None,
) -> ConversationRead:
    summary = profile_summary_for_conversation(conversation, profile)
    data = conversation.model_dump()
    data["customer_profile"] = summary.model_dump() if summary else None
    data["pending_ai_approval"] = (
        AIApprovalRead.from_domain(pending_approval).model_dump()
        if pending_approval is not None
        else None
    )
    data["assigned_agent"] = (
        UserRead.from_domain(assigned_agent).to_assigned_agent().model_dump()
        if assigned_agent is not None
        else None
    )
    return ConversationRead.model_validate(data)


async def enrich_conversation_read_with_repos(
    *,
    conversation: Conversation,
    customer_profile_repository,
    ai_approval_repository,
    user_repository=None,
) -> ConversationRead:
    profile = await customer_profile_repository.get_by_external_id(
        tenant_id=conversation.tenant_id,
        channel=conversation.channel,
        external_id=conversation.customer_id,
    )
    pending_approval = await ai_approval_repository.get_pending_by_conversation(
        tenant_id=conversation.tenant_id,
        conversation_id=conversation.id,
    )
    assigned_agent = None
    if user_repository is not None and conversation.assigned_agent_id:
        assigned_agent = await user_repository.get_by_id(
            conversation.tenant_id,
            conversation.assigned_agent_id,
        )
    return to_conversation_read(conversation, profile, pending_approval, assigned_agent)


async def enrich_conversation_read(
    *,
    container: "AppContainer",
    conversation: Conversation,
) -> ConversationRead:
    return await enrich_conversation_read_with_repos(
        conversation=conversation,
        customer_profile_repository=container.customer_profile_repository,
        ai_approval_repository=container.ai_approval_repository,
        user_repository=container.user_repository,
    )


async def enrich_conversations_read(
    *,
    container: "AppContainer",
    conversations: list[Conversation],
) -> list[ConversationRead]:
    if not conversations:
        return []

    grouped: dict[tuple[str, Channel], list[Conversation]] = {}
    for conversation in conversations:
        key = (conversation.tenant_id, conversation.channel)
        grouped.setdefault(key, []).append(conversation)

    profiles_by_key: dict[tuple[str, Channel, str], CustomerProfile] = {}
    for (tenant_id, channel), items in grouped.items():
        external_ids = list({item.customer_id for item in items})
        profiles = await container.customer_profile_repository.get_many_by_external_ids(
            tenant_id=tenant_id,
            channel=channel,
            external_ids=external_ids,
        )
        for external_id, profile in profiles.items():
            profiles_by_key[(tenant_id, channel, external_id)] = profile

    pending_by_conversation: dict[str, AIApprovalRequest] = {}
    tenant_ids = {conversation.tenant_id for conversation in conversations}
    for tenant_id in tenant_ids:
        pending_approvals = await container.ai_approval_repository.list_by_tenant(
            tenant_id=tenant_id,
            status=ApprovalStatus.pending,
        )
        for approval in pending_approvals:
            pending_by_conversation.setdefault(approval.conversation_id, approval)

    agents_by_id: dict[str, User] = {}
    for tenant_id in tenant_ids:
        tenant_agent_ids = [
            conversation.assigned_agent_id
            for conversation in conversations
            if conversation.tenant_id == tenant_id and conversation.assigned_agent_id
        ]
        if tenant_agent_ids:
            agents_by_id.update(
                await container.user_repository.get_many_by_ids(tenant_id, tenant_agent_ids)
            )

    return [
        to_conversation_read(
            conversation,
            profiles_by_key.get(
                (conversation.tenant_id, conversation.channel, conversation.customer_id)
            ),
            pending_by_conversation.get(conversation.id),
            agents_by_id.get(conversation.assigned_agent_id)
            if conversation.assigned_agent_id
            else None,
        )
        for conversation in conversations
    ]
