from datetime import datetime, timezone
from uuid import uuid4

from app.domain.models.ai import ConversationAINotes


class InMemoryConversationAINotesRepository:
    def __init__(self) -> None:
        self._notes: dict[str, ConversationAINotes] = {}

    def _key(self, tenant_id: str, conversation_id: str) -> str:
        return f"{tenant_id}:{conversation_id}"

    async def get_by_conversation(
        self,
        tenant_id: str,
        conversation_id: str,
    ) -> ConversationAINotes | None:
        return self._notes.get(self._key(tenant_id, conversation_id))

    async def upsert(
        self,
        tenant_id: str,
        conversation_id: str,
        notes: str,
    ) -> ConversationAINotes:
        key = self._key(tenant_id, conversation_id)
        now = datetime.now(timezone.utc)
        existing = self._notes.get(key)

        if existing is None:
            stored = ConversationAINotes(
                id=str(uuid4()),
                tenant_id=tenant_id,
                conversation_id=conversation_id,
                notes=notes,
                created_at=now,
                updated_at=now,
            )
        else:
            stored = existing.model_copy(
                update={
                    "notes": notes,
                    "updated_at": now,
                }
            )

        self._notes[key] = stored
        return stored
