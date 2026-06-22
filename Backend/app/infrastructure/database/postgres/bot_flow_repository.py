from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.domain.models.bot_flow import BotFlow
from app.infrastructure.database.postgres.models import BotFlowModel


def _to_domain(model: BotFlowModel) -> BotFlow:
    return BotFlow(
        id=model.id,
        tenant_id=model.tenant_id,
        name=model.name,
        description=model.description,
        trigger_intents=list(model.trigger_intents or []),
        enabled=model.enabled,
        version=model.version,
        definition=dict(model.definition or {}),
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


class PostgresBotFlowRepository:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def create(self, flow: BotFlow) -> BotFlow:
        async with self._session_factory() as session:
            model = BotFlowModel(
                id=flow.id,
                tenant_id=flow.tenant_id,
                name=flow.name,
                description=flow.description,
                trigger_intents=flow.trigger_intents,
                enabled=flow.enabled,
                version=flow.version,
                definition=flow.definition,
                created_at=flow.created_at,
                updated_at=flow.updated_at,
            )
            session.add(model)
            await session.commit()
            await session.refresh(model)
            return _to_domain(model)

    async def get_by_id(self, tenant_id: str, flow_id: str) -> BotFlow | None:
        async with self._session_factory() as session:
            stmt = select(BotFlowModel).where(
                BotFlowModel.tenant_id == tenant_id,
                BotFlowModel.id == flow_id,
            )
            result = await session.execute(stmt)
            model = result.scalar_one_or_none()
            if model is None:
                return None
            return _to_domain(model)

    async def list_by_tenant(self, tenant_id: str) -> list[BotFlow]:
        async with self._session_factory() as session:
            stmt = (
                select(BotFlowModel)
                .where(BotFlowModel.tenant_id == tenant_id)
                .order_by(BotFlowModel.updated_at.desc())
            )
            result = await session.execute(stmt)
            return [_to_domain(model) for model in result.scalars().all()]

    async def find_by_trigger_intent(self, tenant_id: str, intent: str) -> BotFlow | None:
        flows = await self.list_by_tenant(tenant_id)
        for flow in flows:
            if flow.enabled and intent in flow.trigger_intents:
                return flow
        return None

    async def update(self, flow: BotFlow) -> BotFlow:
        now = datetime.now(timezone.utc)
        async with self._session_factory() as session:
            stmt = select(BotFlowModel).where(
                BotFlowModel.tenant_id == flow.tenant_id,
                BotFlowModel.id == flow.id,
            )
            result = await session.execute(stmt)
            model = result.scalar_one_or_none()
            if model is None:
                raise ValueError("Bot flow not found")

            model.name = flow.name
            model.description = flow.description
            model.trigger_intents = flow.trigger_intents
            model.enabled = flow.enabled
            model.version = flow.version
            model.definition = flow.definition
            model.updated_at = now

            await session.commit()
            await session.refresh(model)
            return _to_domain(model)

    async def delete(self, tenant_id: str, flow_id: str) -> None:
        async with self._session_factory() as session:
            stmt = delete(BotFlowModel).where(
                BotFlowModel.tenant_id == tenant_id,
                BotFlowModel.id == flow_id,
            )
            await session.execute(stmt)
            await session.commit()
