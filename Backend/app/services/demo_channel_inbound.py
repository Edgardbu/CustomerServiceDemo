import logging
from uuid import uuid4

from app.core.container import AppContainer
from app.domain.models.conversation import Channel
from app.domain.models.inbound import InboundCustomerMessage
from app.schemas.demo_channels import DemoChannelInboundRequest, DemoChannelName
from app.services.demo_channel_detection import DEMO_CHANNEL_TAG
from app.services.email_subject import format_email_inbound_content

logger = logging.getLogger(__name__)

DEMO_CHANNEL_MAP: dict[DemoChannelName, Channel] = {
    "instagram": Channel.instagram,
    "facebook": Channel.facebook,
    "whatsapp": Channel.whatsapp,
    "sms": Channel.sms,
    "email": Channel.email,
}


def _resolve_display_name(
    *,
    channel: Channel,
    customer_id: str,
    display_name: str | None,
) -> str:
    if display_name and display_name.strip():
        return display_name.strip()
    return customer_id


def _resolve_message_content(
    *,
    channel: Channel,
    content: str,
    metadata: dict,
) -> str:
    if channel == Channel.email:
        subject = metadata.get("subject")
        if isinstance(subject, str) and subject.strip():
            return format_email_inbound_content(subject=subject, text=content)
    return content.strip()


def _build_message_metadata(
    *,
    channel: Channel,
    customer_id: str,
    display_name: str,
    incoming_metadata: dict | None,
) -> dict:
    metadata = {
        "source": "demo_simulator",
        "demo_channel": True,
        "original_channel": channel.value,
    }
    if incoming_metadata:
        metadata.update(incoming_metadata)

    if channel == Channel.email:
        metadata.setdefault("from_email", customer_id)
        metadata.setdefault("from_name", display_name)
        if "subject" not in metadata:
            metadata.setdefault("subject", "Demo email")

    return metadata


async def handle_omnichannel_demo_inbound(
    *,
    container: AppContainer,
    payload: DemoChannelInboundRequest,
) -> dict:
    channel = DEMO_CHANNEL_MAP[payload.channel]
    display_name = _resolve_display_name(
        channel=channel,
        customer_id=payload.customer_id,
        display_name=payload.display_name,
    )

    incoming_metadata = dict(payload.metadata) if payload.metadata else {}
    message_metadata = _build_message_metadata(
        channel=channel,
        customer_id=payload.customer_id,
        display_name=display_name,
        incoming_metadata=incoming_metadata,
    )
    content = _resolve_message_content(
        channel=channel,
        content=payload.content,
        metadata=message_metadata,
    )

    logger.info(
        "[demo:channels] inbound channel=%s customer_id=%s",
        payload.channel,
        payload.customer_id,
    )

    try:
        await container.customer_profile_repository.upsert_profile(
            tenant_id=payload.tenant_id,
            channel=channel,
            external_id=payload.customer_id,
            display_name=display_name,
            username=payload.username,
            profile_picture_url=payload.profile_picture_url,
            raw_profile={
                "source": "demo_simulator",
                "customer_id": payload.customer_id,
                "display_name": display_name,
                "username": payload.username,
            },
        )
    except Exception:
        logger.warning(
            "[demo:channels] failed to upsert profile channel=%s customer_id=%s",
            payload.channel,
            payload.customer_id,
            exc_info=True,
        )

    conversation = await container.conversation_repository.get_or_create_by_external_customer(
        tenant_id=payload.tenant_id,
        customer_id=payload.customer_id,
        channel=channel,
    )

    tags = list(conversation.tags)
    if DEMO_CHANNEL_TAG not in tags:
        tags.append(DEMO_CHANNEL_TAG)
        conversation = await container.conversation_repository.update_ai_state(
            tenant_id=payload.tenant_id,
            conversation_id=conversation.id,
            tags=tags,
        )

    external_message_id = f"demo_{payload.channel}_{uuid4()}"

    await container.bot_runtime.handle_inbound_customer_message(
        tenant_id=payload.tenant_id,
        conversation=conversation,
        customer_message=InboundCustomerMessage(
            content=content,
            external_message_id=external_message_id,
            metadata=message_metadata,
        ),
    )

    return {
        "status": "ok",
        "conversation_id": conversation.id,
        "external_message_id": external_message_id,
        "channel": payload.channel,
    }
