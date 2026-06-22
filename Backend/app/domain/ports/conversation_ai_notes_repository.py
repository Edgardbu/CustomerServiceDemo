from typing import Protocol

from app.domain.models.ai import ConversationAINotes


class ConversationAINotesRepository(Protocol):
    async def get_by_conversation(
        self,
        tenant_id: str,
        conversation_id: str,
    ) -> ConversationAINotes | None:
        ...

    async def upsert(
        self,
        tenant_id: str,
        conversation_id: str,
        notes: str,
    ) -> ConversationAINotes:
        ...
