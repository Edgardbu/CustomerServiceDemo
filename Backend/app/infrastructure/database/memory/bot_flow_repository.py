from datetime import datetime, timezone

from app.domain.models.bot_flow import BotFlow, BotFlowSession, BotFlowSessionStatus


class InMemoryBotFlowRepository:
    def __init__(self) -> None:
        self._flows: dict[str, BotFlow] = {}

    def _key(self, tenant_id: str, flow_id: str) -> str:
        return f"{tenant_id}:{flow_id}"

    async def create(self, flow: BotFlow) -> BotFlow:
        self._flows[self._key(flow.tenant_id, flow.id)] = flow
        return flow

    async def get_by_id(self, tenant_id: str, flow_id: str) -> BotFlow | None:
        return self._flows.get(self._key(tenant_id, flow_id))

    async def list_by_tenant(self, tenant_id: str) -> list[BotFlow]:
        items = [flow for flow in self._flows.values() if flow.tenant_id == tenant_id]
        return sorted(items, key=lambda flow: flow.updated_at, reverse=True)

    async def find_by_trigger_intent(self, tenant_id: str, intent: str) -> BotFlow | None:
        for flow in await self.list_by_tenant(tenant_id):
            if flow.enabled and intent in flow.trigger_intents:
                return flow
        return None

    async def update(self, flow: BotFlow) -> BotFlow:
        key = self._key(flow.tenant_id, flow.id)
        if key not in self._flows:
            raise ValueError("Bot flow not found")
        updated = flow.model_copy(update={"updated_at": datetime.now(timezone.utc)})
        self._flows[key] = updated
        return updated

    async def delete(self, tenant_id: str, flow_id: str) -> None:
        self._flows.pop(self._key(tenant_id, flow_id), None)


class InMemoryBotFlowSessionRepository:
    def __init__(self) -> None:
        self._sessions: dict[str, BotFlowSession] = {}

    def _key(self, tenant_id: str, session_id: str) -> str:
        return f"{tenant_id}:{session_id}"

    async def create(self, session: BotFlowSession) -> BotFlowSession:
        self._sessions[self._key(session.tenant_id, session.id)] = session
        return session

    async def get_by_id(self, tenant_id: str, session_id: str) -> BotFlowSession | None:
        return self._sessions.get(self._key(tenant_id, session_id))

    async def get_active_by_conversation(
        self,
        tenant_id: str,
        conversation_id: str,
    ) -> BotFlowSession | None:
        matches = [
            session
            for session in self._sessions.values()
            if session.tenant_id == tenant_id
            and session.conversation_id == conversation_id
            and session.status == BotFlowSessionStatus.active
        ]
        if not matches:
            return None
        return max(matches, key=lambda session: session.updated_at)

    async def update(self, session: BotFlowSession) -> BotFlowSession:
        key = self._key(session.tenant_id, session.id)
        if key not in self._sessions:
            raise ValueError("Bot flow session not found")
        updated = session.model_copy(update={"updated_at": datetime.now(timezone.utc)})
        self._sessions[key] = updated
        return updated
