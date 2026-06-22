from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import selectinload

from app.domain.models.conversation import (
    Channel,
    Conversation,
    ConversationStatus,
    DeliveryStatus,
    Message,
    SenderType,
)
from app.infrastructure.database.postgres.models import ConversationModel, MessageModel


def _to_domain_message(model: MessageModel) -> Message:
    return Message(
        id=model.id,
        tenant_id=model.tenant_id,
        conversation_id=model.conversation_id,
        sender_type=SenderType(model.sender_type),
        content=model.content,
        attachments=list(model.attachments or []),
        external_message_id=model.external_message_id,
        delivery_status=DeliveryStatus(model.delivery_status)
        if model.delivery_status
        else None,
        external_raw_response=dict(model.external_raw_response)
        if model.external_raw_response
        else None,
        ai_generated=model.ai_generated,
        ai_approval_request_id=model.ai_approval_request_id,
        metadata=dict(model.message_metadata) if model.message_metadata else None,
        created_at=model.created_at,
    )


def _to_domain_conversation(
    model: ConversationModel,
    *,
    messages: list[Message] | None = None,
) -> Conversation:
    return Conversation(
        id=model.id,
        tenant_id=model.tenant_id,
        customer_id=model.customer_id,
        channel=Channel(model.channel),
        status=ConversationStatus(model.status),
        assigned_agent_id=model.assigned_agent_id,
        tags=list(model.tags or []),
        ai_auto_reply_enabled=model.ai_auto_reply_enabled,
        ai_status=model.ai_status,
        messages=messages
        if messages is not None
        else [_to_domain_message(message) for message in model.messages],
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


class PostgresConversationRepository:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def create_conversation(
        self,
        tenant_id: str,
        customer_id: str,
        channel: Channel,
    ) -> Conversation:
        now = datetime.now(timezone.utc)
        conversation_id = str(uuid4())

        async with self._session_factory() as session:
            model = ConversationModel(
                id=conversation_id,
                tenant_id=tenant_id,
                customer_id=customer_id,
                channel=channel.value,
                status=ConversationStatus.open.value,
                tags=[],
                created_at=now,
                updated_at=now,
            )
            session.add(model)
            await session.commit()
            await session.refresh(model)

            return _to_domain_conversation(model, messages=[])

    async def get_conversation(
        self,
        tenant_id: str,
        conversation_id: str,
    ) -> Conversation | None:
        async with self._session_factory() as session:
            stmt = (
                select(ConversationModel)
                .options(selectinload(ConversationModel.messages))
                .where(
                    ConversationModel.tenant_id == tenant_id,
                    ConversationModel.id == conversation_id,
                )
            )
            result = await session.execute(stmt)
            model = result.scalar_one_or_none()

            if model is None:
                return None

            return _to_domain_conversation(model)

    async def list_conversations(
        self,
        tenant_id: str,
        status: ConversationStatus | None = None,
        channel: Channel | None = None,
    ) -> list[Conversation]:
        async with self._session_factory() as session:
            stmt = (
                select(ConversationModel)
                .options(selectinload(ConversationModel.messages))
                .where(ConversationModel.tenant_id == tenant_id)
            )

            if status is not None:
                stmt = stmt.where(ConversationModel.status == status.value)

            if channel is not None:
                stmt = stmt.where(ConversationModel.channel == channel.value)

            stmt = stmt.order_by(ConversationModel.updated_at.desc())

            result = await session.execute(stmt)
            models = result.scalars().all()

            return [_to_domain_conversation(model) for model in models]

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
        now = datetime.now(timezone.utc)
        message_id = str(uuid4())

        async with self._session_factory() as session:
            stmt = select(ConversationModel).where(
                ConversationModel.tenant_id == tenant_id,
                ConversationModel.id == conversation_id,
            )
            result = await session.execute(stmt)
            conversation = result.scalar_one_or_none()

            if conversation is None:
                raise ValueError("Conversation not found")

            message = MessageModel(
                id=message_id,
                tenant_id=tenant_id,
                conversation_id=conversation_id,
                sender_type=sender_type.value,
                content=content,
                attachments=attachments,
                external_message_id=external_message_id,
                delivery_status=delivery_status.value if delivery_status else None,
                external_raw_response=external_raw_response,
                ai_generated=ai_generated,
                ai_approval_request_id=ai_approval_request_id,
                message_metadata=metadata,
                created_at=now,
            )
            conversation.updated_at = now
            session.add(message)
            await session.commit()
            await session.refresh(message)

            return _to_domain_message(message)

    async def get_or_create_by_external_customer(
        self,
        tenant_id: str,
        customer_id: str,
        channel: Channel,
    ) -> Conversation:
        async with self._session_factory() as session:
            stmt = (
                select(ConversationModel)
                .options(selectinload(ConversationModel.messages))
                .where(
                    ConversationModel.tenant_id == tenant_id,
                    ConversationModel.customer_id == customer_id,
                    ConversationModel.channel == channel.value,
                )
                .order_by(ConversationModel.updated_at.desc())
                .limit(1)
            )
            result = await session.execute(stmt)
            model = result.scalar_one_or_none()

            if model is not None:
                return _to_domain_conversation(model)

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
        async with self._session_factory() as session:
            stmt = (
                select(ConversationModel)
                .options(selectinload(ConversationModel.messages))
                .where(
                    ConversationModel.tenant_id == tenant_id,
                    ConversationModel.id == conversation_id,
                )
            )
            result = await session.execute(stmt)
            model = result.scalar_one_or_none()

            if model is None:
                raise ValueError("Conversation not found")

            if (
                ai_auto_reply_enabled is None
                and ai_status is None
                and tags is None
            ):
                return _to_domain_conversation(model)

            now = datetime.now(timezone.utc)
            if ai_auto_reply_enabled is not None:
                model.ai_auto_reply_enabled = ai_auto_reply_enabled
            if ai_status is not None:
                model.ai_status = ai_status
            if tags is not None:
                model.tags = tags
            model.updated_at = now

            await session.commit()
            await session.refresh(model)

            return _to_domain_conversation(model)

    async def update_assignment(
        self,
        tenant_id: str,
        conversation_id: str,
        *,
        assigned_agent_id: str | None,
    ) -> Conversation:
        async with self._session_factory() as session:
            stmt = (
                select(ConversationModel)
                .options(selectinload(ConversationModel.messages))
                .where(
                    ConversationModel.tenant_id == tenant_id,
                    ConversationModel.id == conversation_id,
                )
            )
            result = await session.execute(stmt)
            model = result.scalar_one_or_none()

            if model is None:
                raise ValueError("Conversation not found")

            model.assigned_agent_id = assigned_agent_id
            model.updated_at = datetime.now(timezone.utc)

            await session.commit()
            await session.refresh(model)

            return _to_domain_conversation(model)

    async def update_message_delivery_by_external_id(
        self,
        tenant_id: str,
        external_message_id: str,
        *,
        delivery_status: DeliveryStatus,
        metadata: dict | None = None,
        external_raw_response: dict | None = None,
    ) -> Message | None:
        async with self._session_factory() as session:
            stmt = select(MessageModel).where(
                MessageModel.tenant_id == tenant_id,
                MessageModel.external_message_id == external_message_id,
            )
            result = await session.execute(stmt)
            model = result.scalar_one_or_none()

            if model is None:
                return None

            model.delivery_status = delivery_status.value
            if metadata:
                existing = dict(model.message_metadata or {})
                existing.update(metadata)
                model.message_metadata = existing
            if external_raw_response is not None:
                model.external_raw_response = external_raw_response

            conversation_stmt = select(ConversationModel).where(
                ConversationModel.tenant_id == tenant_id,
                ConversationModel.id == model.conversation_id,
            )
            conversation_result = await session.execute(conversation_stmt)
            conversation = conversation_result.scalar_one_or_none()
            if conversation is not None:
                conversation.updated_at = datetime.now(timezone.utc)

            await session.commit()
            await session.refresh(model)

            return _to_domain_message(model)
