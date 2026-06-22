import logging
from uuid import uuid4

from app.domain.errors import ChannelSendError
from app.domain.models.channel_send import ChannelSendResult
from app.domain.models.conversation import Channel

logger = logging.getLogger(__name__)


class DemoChannelProvider:
    async def send_message(
        self,
        tenant_id: str,
        channel: Channel,
        recipient_id: str,
        text: str,
        **kwargs: object,
    ) -> ChannelSendResult:
        del tenant_id, kwargs

        normalized_text = text.strip()
        if not normalized_text:
            raise ChannelSendError("Message text cannot be empty")

        external_message_id = f"demo_out_{channel.value}_{uuid4()}"
        logger.info(
            "[demo-channel] simulated send channel=%s recipient=%s",
            channel.value,
            recipient_id,
        )

        return ChannelSendResult(
            success=True,
            external_message_id=external_message_id,
            recipient_id=recipient_id,
            raw_response={
                "provider": "demo_channel",
                "channel": channel.value,
                "recipient_id": recipient_id,
                "status": "sent",
            },
        )
