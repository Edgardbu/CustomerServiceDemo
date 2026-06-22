from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.domain.models.ai import ConversationAINotes
from app.infrastructure.database.postgres.models import ConversationAINotesModel


def _to_domain(model: ConversationAINotesModel) -> ConversationAINotes:
    return ConversationAINotes(
        id=model.id,
        tenant_id=model.tenant_id,
        conversation_id=model.conversation_id,
        notes=model.notes,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


class PostgresConversationAINotesRepository:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def get_by_conversation(
        self,
        tenant_id: str,
        conversation_id: str,
    ) -> ConversationAINotes | None:
        async with self._session_factory() as session:
            stmt = select(ConversationAINotesModel).where(
                ConversationAINotesModel.tenant_id == tenant_id,
                ConversationAINotesModel.conversation_id == conversation_id,
            )
            result = await session.execute(stmt)
            model = result.scalar_one_or_none()
            if model is None:
                return None
            return _to_domain(model)

    async def upsert(
        self,
        tenant_id: str,
        conversation_id: str,
        notes: str,
    ) -> ConversationAINotes:
        now = datetime.now(timezone.utc)
        notes_id = str(uuid4())

        async with self._session_factory() as session:
            stmt = (
                insert(ConversationAINotesModel)
                .values(
                    id=notes_id,
                    tenant_id=tenant_id,
                    conversation_id=conversation_id,
                    notes=notes,
                    created_at=now,
                    updated_at=now,
                )
                .on_conflict_do_update(
                    index_elements=["tenant_id", "conversation_id"],
                    set_={
                        "notes": notes,
                        "updated_at": now,
                    },
                )
                .returning(ConversationAINotesModel)
            )
            result = await session.execute(stmt)
            model = result.scalar_one()
            await session.commit()
            return _to_domain(model)
