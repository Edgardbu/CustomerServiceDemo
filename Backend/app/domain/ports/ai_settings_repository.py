from typing import Protocol

from app.domain.models.ai import AISettings


class AISettingsRepository(Protocol):
    async def get_by_tenant(self, tenant_id: str) -> AISettings | None:
        ...

    async def upsert(self, settings: AISettings) -> AISettings:
        ...
