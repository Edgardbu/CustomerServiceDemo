from typing import Any, Protocol


class RealtimePublisher(Protocol):
    async def publish(self, tenant_id: str, event: str, payload: dict[str, Any]) -> None:
        ...
