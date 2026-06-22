import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket
from starlette.websockets import WebSocketState

logger = logging.getLogger(__name__)


class WebSocketManager:
    """Manages active WebSocket connections grouped by tenant."""

    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, tenant_id: str, websocket: WebSocket) -> None:
        await websocket.accept()

        async with self._lock:
            self._connections.setdefault(tenant_id, set()).add(websocket)

        logger.info("[ws] client connected tenant_id=%s", tenant_id)

    async def disconnect(self, tenant_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            tenant_connections = self._connections.get(tenant_id)
            if tenant_connections is not None:
                tenant_connections.discard(websocket)
                if not tenant_connections:
                    del self._connections[tenant_id]

        logger.info("[ws] client disconnected tenant_id=%s", tenant_id)

    async def broadcast_to_tenant(
        self,
        tenant_id: str,
        event: str,
        data: dict[str, Any],
    ) -> None:
        logger.info("[ws] broadcasting event %s tenant_id=%s", event, tenant_id)

        async with self._lock:
            sockets = list(self._connections.get(tenant_id, set()))

        for websocket in sockets:
            await self._send_to_client(tenant_id, websocket, event, data)

    async def _send_to_client(
        self,
        tenant_id: str,
        websocket: WebSocket,
        event: str,
        data: dict[str, Any],
    ) -> None:
        if websocket.client_state != WebSocketState.CONNECTED:
            await self.disconnect(tenant_id, websocket)
            return

        message = json.dumps(
            {
                "event": event,
                "tenant_id": tenant_id,
                "data": data,
            }
        )

        try:
            await websocket.send_text(message)
        except Exception:
            logger.warning(
                "[ws] failed to send event %s tenant_id=%s; removing client",
                event,
                tenant_id,
                exc_info=True,
            )
            await self.disconnect(tenant_id, websocket)


class RealtimeService:
    """Publishes realtime events to connected WebSocket clients."""

    def __init__(self, manager: WebSocketManager) -> None:
        self._manager = manager

    async def publish(self, tenant_id: str, event: str, payload: dict[str, Any]) -> None:
        await self._manager.broadcast_to_tenant(
            tenant_id=tenant_id,
            event=event,
            data=payload,
        )
