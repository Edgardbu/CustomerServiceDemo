from fastapi import HTTPException

from app.domain.errors import ChannelSendError
from app.domain.models.conversation import Channel, Conversation, DeliveryStatus, Message, SenderType
from app.domain.ports.channel_provider import ChannelProvider
from app.domain.ports.conversation_repository import ConversationRepository
from app.infrastructure.channels.demo.demo_channel_provider import DemoChannelProvider
from app.services.demo_channel_detection import is_demo_conversation
from app.services.email_subject import resolve_email_reply_subject

_demo_channel_provider = DemoChannelProvider()


async def send_conversation_message(
    *,
    conversation_repository: ConversationRepository,
    channels: dict[Channel, ChannelProvider],
    conversation: Conversation,
    tenant_id: str,
    conversation_id: str,
    content: str,
    sender_type: SenderType,
    attachments: list[str] | None = None,
    ai_generated: bool = False,
    ai_approval_request_id: str | None = None,
    metadata: dict | None = None,
    delivery_status: DeliveryStatus | None = None,
) -> Message:
    text = content.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message content cannot be empty")
    if len(text) > 1000:
        raise HTTPException(
            status_code=400,
            detail="Message content exceeds maximum length of 1000 characters",
        )

    attachments = attachments or []
    provider = channels.get(conversation.channel)
    use_demo_provider = is_demo_conversation(conversation)

    if sender_type in {SenderType.agent, SenderType.bot} and (
        use_demo_provider or provider is not None
    ):
        send_kwargs: dict = {}
        outbound_metadata = dict(metadata) if metadata else {}

        if conversation.channel == Channel.email:
            subject = resolve_email_reply_subject(conversation, metadata)
            send_kwargs["subject"] = subject
            outbound_metadata.setdefault("subject", subject)

        if use_demo_provider:
            outbound_metadata.setdefault("source", "demo_simulator")
            outbound_metadata.setdefault("demo_channel", True)

        try:
            if use_demo_provider:
                send_result = await _demo_channel_provider.send_message(
                    tenant_id=tenant_id,
                    channel=conversation.channel,
                    recipient_id=conversation.customer_id,
                    text=text,
                    **send_kwargs,
                )
            else:
                send_result = await provider.send_message(
                    tenant_id=tenant_id,
                    recipient_id=conversation.customer_id,
                    text=text,
                    **send_kwargs,
                )
        except ChannelSendError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to send channel message: {exc.message}",
            ) from exc

        return await conversation_repository.add_message(
            tenant_id=tenant_id,
            conversation_id=conversation_id,
            sender_type=sender_type,
            content=text,
            attachments=attachments,
            external_message_id=send_result.external_message_id,
            delivery_status=DeliveryStatus.sent,
            external_raw_response=send_result.raw_response,
            ai_generated=ai_generated,
            ai_approval_request_id=ai_approval_request_id,
            metadata=outbound_metadata or None,
        )

    return await conversation_repository.add_message(
        tenant_id=tenant_id,
        conversation_id=conversation_id,
        sender_type=sender_type,
        content=text,
        attachments=attachments,
        delivery_status=delivery_status,
        ai_generated=ai_generated,
        ai_approval_request_id=ai_approval_request_id,
        metadata=metadata,
    )
