from typing import Protocol

from app.domain.models.bot_flow import BotFlow


class BotFlowRepository(Protocol):
    async def create(self, flow: BotFlow) -> BotFlow:
        ...

    async def get_by_id(self, tenant_id: str, flow_id: str) -> BotFlow | None:
        ...

    async def list_by_tenant(self, tenant_id: str) -> list[BotFlow]:
        ...

    async def find_by_trigger_intent(self, tenant_id: str, intent: str) -> BotFlow | None:
        ...

    async def update(self, flow: BotFlow) -> BotFlow:
        ...

    async def delete(self, tenant_id: str, flow_id: str) -> None:
        ...
