from typing import Protocol

from app.domain.models.conversation import (
    Channel,
    Conversation,
    ConversationStatus,
    DeliveryStatus,
    Message,
    SenderType,
)


class ConversationRepository(Protocol):
    async def create_conversation(
        self,
        tenant_id: str,
        customer_id: str,
        channel: Channel,
    ) -> Conversation:
        ...

    async def get_conversation(
        self,
        tenant_id: str,
        conversation_id: str,
    ) -> Conversation | None:
        ...

    async def list_conversations(
        self,
        tenant_id: str,
        status: ConversationStatus | None = None,
        channel: Channel | None = None,
    ) -> list[Conversation]:
        ...

    async def add_message(
        self,
        tenant_id: str,
        conversation_id: str,
        sender_type: SenderType,
        content: str,
        attachments: list[str],
        *,
        external_message_id: str | None = None,
        delivery_status: DeliveryStatus | None = None,
        external_raw_response: dict | None = None,
        ai_generated: bool = False,
        ai_approval_request_id: str | None = None,
        metadata: dict | None = None,
    ) -> Message:
        ...

    async def get_or_create_by_external_customer(
        self,
        tenant_id: str,
        customer_id: str,
        channel: Channel,
    ) -> Conversation:
        ...

    async def update_ai_state(
        self,
        tenant_id: str,
        conversation_id: str,
        *,
        ai_auto_reply_enabled: bool | None = None,
        ai_status: str | None = None,
        tags: list[str] | None = None,
    ) -> Conversation:
        ...

    async def update_assignment(
        self,
        tenant_id: str,
        conversation_id: str,
        *,
        assigned_agent_id: str | None,
    ) -> Conversation:
        ...

    async def update_message_delivery_by_external_id(
        self,
        tenant_id: str,
        external_message_id: str,
        *,
        delivery_status: DeliveryStatus,
        metadata: dict | None = None,
        external_raw_response: dict | None = None,
    ) -> Message | None:
        ...
