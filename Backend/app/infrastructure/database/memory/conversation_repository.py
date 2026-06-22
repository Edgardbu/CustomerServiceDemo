from datetime import datetime, timezone

from app.domain.models.conversation import (
    Channel,
    Conversation,
    ConversationStatus,
    DeliveryStatus,
    Message,
    SenderType,
)


class InMemoryConversationRepository:
    def __init__(self) -> None:
        self._conversations: dict[str, Conversation] = {}

    def _key(self, tenant_id: str, conversation_id: str) -> str:
        return f"{tenant_id}:{conversation_id}"

    async def create_conversation(
        self,
        tenant_id: str,
        customer_id: str,
        channel: Channel,
    ) -> Conversation:
        conversation = Conversation(
            tenant_id=tenant_id,
            customer_id=customer_id,
            channel=channel,
        )
        self._conversations[self._key(tenant_id, conversation.id)] = conversation
        return conversation

    async def get_conversation(
        self,
        tenant_id: str,
        conversation_id: str,
    ) -> Conversation | None:
        return self._conversations.get(self._key(tenant_id, conversation_id))

    async def list_conversations(
        self,
        tenant_id: str,
        status: ConversationStatus | None = None,
        channel: Channel | None = None,
    ) -> list[Conversation]:
        items = [
            conv
            for conv in self._conversations.values()
            if conv.tenant_id == tenant_id
        ]

        if status:
            items = [conv for conv in items if conv.status == status]

        if channel:
            items = [conv for conv in items if conv.channel == channel]

        return sorted(items, key=lambda conv: conv.updated_at, reverse=True)

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
        conversation = await self.get_conversation(tenant_id, conversation_id)
        if conversation is None:
            raise ValueError("Conversation not found")

        message = Message(
            tenant_id=tenant_id,
            conversation_id=conversation_id,
            sender_type=sender_type,
            content=content,
            attachments=attachments,
            external_message_id=external_message_id,
            delivery_status=delivery_status,
            external_raw_response=external_raw_response,
            ai_generated=ai_generated,
            ai_approval_request_id=ai_approval_request_id,
            metadata=metadata,
        )
        conversation.messages.append(message)
        conversation.updated_at = datetime.now(timezone.utc)
        return message

    async def get_or_create_by_external_customer(
        self,
        tenant_id: str,
        customer_id: str,
        channel: Channel,
    ) -> Conversation:
        matches = [
            conv
            for conv in self._conversations.values()
            if conv.tenant_id == tenant_id
            and conv.customer_id == customer_id
            and conv.channel == channel
        ]

        if matches:
            return max(matches, key=lambda conv: conv.updated_at)

        return await self.create_conversation(
            tenant_id=tenant_id,
            customer_id=customer_id,
            channel=channel,
        )

    async def update_ai_state(
        self,
        tenant_id: str,
        conversation_id: str,
        *,
        ai_auto_reply_enabled: bool | None = None,
        ai_status: str | None = None,
        tags: list[str] | None = None,
    ) -> Conversation:
        conversation = await self.get_conversation(tenant_id, conversation_id)
        if conversation is None:
            raise ValueError("Conversation not found")

        if (
            ai_auto_reply_enabled is None
            and ai_status is None
            and tags is None
        ):
            return conversation

        updates: dict = {"updated_at": datetime.now(timezone.utc)}
        if ai_auto_reply_enabled is not None:
            updates["ai_auto_reply_enabled"] = ai_auto_reply_enabled
        if ai_status is not None:
            updates["ai_status"] = ai_status
        if tags is not None:
            updates["tags"] = tags

        updated = conversation.model_copy(update=updates)
        self._conversations[self._key(tenant_id, conversation_id)] = updated
        return updated

    async def update_assignment(
        self,
        tenant_id: str,
        conversation_id: str,
        *,
        assigned_agent_id: str | None,
    ) -> Conversation:
        conversation = await self.get_conversation(tenant_id, conversation_id)
        if conversation is None:
            raise ValueError("Conversation not found")

        updated = conversation.model_copy(
            update={
                "assigned_agent_id": assigned_agent_id,
                "updated_at": datetime.now(timezone.utc),
            }
        )
        self._conversations[self._key(tenant_id, conversation_id)] = updated
        return updated

    async def update_message_delivery_by_external_id(
        self,
        tenant_id: str,
        external_message_id: str,
        *,
        delivery_status: DeliveryStatus,
        metadata: dict | None = None,
        external_raw_response: dict | None = None,
    ) -> Message | None:
        for conversation in self._conversations.values():
            if conversation.tenant_id != tenant_id:
                continue

            for index, message in enumerate(conversation.messages):
                if message.external_message_id != external_message_id:
                    continue

                merged_metadata = dict(message.metadata or {})
                if metadata:
                    merged_metadata.update(metadata)

                updated_message = message.model_copy(
                    update={
                        "delivery_status": delivery_status,
                        "metadata": merged_metadata or None,
                        "external_raw_response": external_raw_response
                        or message.external_raw_response,
                    }
                )
                conversation.messages[index] = updated_message
                conversation.updated_at = datetime.now(timezone.utc)
                return updated_message

        return None
