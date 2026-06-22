import logging
from uuid import uuid4

from app.domain.errors import ChannelSendError
from app.domain.models.channel import InboundChannelMessage
from app.domain.models.channel_send import ChannelSendResult
from app.domain.models.conversation import Channel

logger = logging.getLogger(__name__)


class DemoSMSProvider:
    """Demo SMS provider — logs sends locally without an external gateway."""

    @property
    def provider_name(self) -> str:
        return "demo"

    @property
    def channel(self) -> Channel:
        return Channel.sms

    async def close(self) -> None:
        return None

    def config_check(self) -> dict:
        return {
            "provider": "demo",
            "ready": True,
        }

    async def send_message(
        self,
        tenant_id: str,
        recipient_id: str,
        text: str,
        **kwargs: object,
    ) -> ChannelSendResult:
        del tenant_id, kwargs

        normalized_text = text.strip()
        if not normalized_text:
            raise ChannelSendError("Message text cannot be empty")

        external_message_id = f"demo_sms_{uuid4()}"
        logger.info("[sms:demo] send to %s: %s", recipient_id, normalized_text)

        return ChannelSendResult(
            success=True,
            external_message_id=external_message_id,
            recipient_id=recipient_id,
            raw_response={
                "provider": "demo",
                "recipient_id": recipient_id,
                "status": "sent",
            },
        )

    async def handle_webhook(
        self,
        tenant_id: str,
        payload: dict,
    ) -> list[InboundChannelMessage]:
        del tenant_id, payload
        return []
