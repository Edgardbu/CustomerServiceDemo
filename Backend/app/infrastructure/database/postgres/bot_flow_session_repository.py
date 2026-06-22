from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.domain.models.bot_flow import BotFlowSession, BotFlowSessionStatus
from app.infrastructure.database.postgres.models import BotFlowSessionModel


def _to_domain(model: BotFlowSessionModel) -> BotFlowSession:
    return BotFlowSession(
        id=model.id,
        tenant_id=model.tenant_id,
        conversation_id=model.conversation_id,
        flow_id=model.flow_id,
        current_node_id=model.current_node_id,
        state=dict(model.state or {}),
        status=BotFlowSessionStatus(model.status),
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


class PostgresBotFlowSessionRepository:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def create(self, session_model: BotFlowSession) -> BotFlowSession:
        async with self._session_factory() as session:
            model = BotFlowSessionModel(
                id=session_model.id,
                tenant_id=session_model.tenant_id,
                conversation_id=session_model.conversation_id,
                flow_id=session_model.flow_id,
                current_node_id=session_model.current_node_id,
                state=session_model.state,
                status=session_model.status.value,
                created_at=session_model.created_at,
                updated_at=session_model.updated_at,
            )
            session.add(model)
            await session.commit()
            await session.refresh(model)
            return _to_domain(model)

    async def get_by_id(self, tenant_id: str, session_id: str) -> BotFlowSession | None:
        async with self._session_factory() as session:
            stmt = select(BotFlowSessionModel).where(
                BotFlowSessionModel.tenant_id == tenant_id,
                BotFlowSessionModel.id == session_id,
            )
            result = await session.execute(stmt)
            model = result.scalar_one_or_none()
            if model is None:
                return None
            return _to_domain(model)

    async def get_active_by_conversation(
        self,
        tenant_id: str,
        conversation_id: str,
    ) -> BotFlowSession | None:
        async with self._session_factory() as session:
            stmt = (
                select(BotFlowSessionModel)
                .where(
                    BotFlowSessionModel.tenant_id == tenant_id,
                    BotFlowSessionModel.conversation_id == conversation_id,
                    BotFlowSessionModel.status == BotFlowSessionStatus.active.value,
                )
                .order_by(BotFlowSessionModel.updated_at.desc())
                .limit(1)
            )
            result = await session.execute(stmt)
            model = result.scalar_one_or_none()
            if model is None:
                return None
            return _to_domain(model)

    async def update(self, session_model: BotFlowSession) -> BotFlowSession:
        now = datetime.now(timezone.utc)
        async with self._session_factory() as session:
            stmt = select(BotFlowSessionModel).where(
                BotFlowSessionModel.tenant_id == session_model.tenant_id,
                BotFlowSessionModel.id == session_model.id,
            )
            result = await session.execute(stmt)
            model = result.scalar_one_or_none()
            if model is None:
                raise ValueError("Bot flow session not found")

            model.current_node_id = session_model.current_node_id
            model.state = session_model.state
            model.status = session_model.status.value
            model.updated_at = now

            await session.commit()
            await session.refresh(model)
            return _to_domain(model)
