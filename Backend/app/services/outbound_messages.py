from app.core.container import AppContainer
from app.schemas.conversations import MessageCreate
from app.services.channel_outbound import send_conversation_message


async def create_outbound_message(
    *,
    container: AppContainer,
    conversation,
    conversation_id: str,
    payload: MessageCreate,
):
    return await send_conversation_message(
        conversation_repository=container.conversation_repository,
        channels=container.channels,
        conversation=conversation,
        tenant_id=payload.tenant_id,
        conversation_id=conversation_id,
        content=payload.content,
        sender_type=payload.sender_type,
        attachments=payload.attachments,
        ai_generated=False,
    )
