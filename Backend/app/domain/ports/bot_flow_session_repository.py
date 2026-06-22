from typing import Protocol

from app.domain.models.bot_flow import BotFlowSession


class BotFlowSessionRepository(Protocol):
    async def create(self, session: BotFlowSession) -> BotFlowSession:
        ...

    async def get_by_id(self, tenant_id: str, session_id: str) -> BotFlowSession | None:
        ...

    async def get_active_by_conversation(
        self,
        tenant_id: str,
        conversation_id: str,
    ) -> BotFlowSession | None:
        ...

    async def update(self, session: BotFlowSession) -> BotFlowSession:
        ...
