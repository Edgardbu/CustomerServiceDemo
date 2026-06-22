from typing import Any, Protocol

from app.domain.models.channel import InboundChannelMessage
from app.domain.models.channel_send import ChannelSendResult
from app.domain.models.conversation import Channel


class ChannelProvider(Protocol):
    @property
    def provider_name(self) -> str:
        ...

    @property
    def channel(self) -> Channel:
        ...

    async def send_message(
        self,
        tenant_id: str,
        recipient_id: str,
        text: str,
        **kwargs: Any,
    ) -> ChannelSendResult:
        ...

    async def handle_webhook(
        self,
        tenant_id: str,
        payload: dict,
    ) -> list[InboundChannelMessage]:
        ...
