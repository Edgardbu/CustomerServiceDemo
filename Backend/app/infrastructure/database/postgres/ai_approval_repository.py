from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.domain.models.ai import (
    AIApprovalRequest,
    ApprovalStatus,
    RiskLevel,
    SuggestedActionType,
)
from app.infrastructure.database.postgres.models import AIApprovalRequestModel


def _to_domain(model: AIApprovalRequestModel) -> AIApprovalRequest:
    return AIApprovalRequest(
        id=model.id,
        tenant_id=model.tenant_id,
        conversation_id=model.conversation_id,
        customer_message_id=model.customer_message_id,
        status=ApprovalStatus(model.status),
        customer_summary=model.customer_summary,
        ai_reasoning_summary=model.ai_reasoning_summary,
        suggested_response=model.suggested_response,
        suggested_action_type=SuggestedActionType(model.suggested_action_type),
        risk_level=RiskLevel(model.risk_level),
        requires_approval=model.requires_approval,
        customer_notified_handoff=model.customer_notified_handoff,
        agent_edit=model.agent_edit,
        final_response=model.final_response,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


class PostgresAIApprovalRepository:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def create(self, request: AIApprovalRequest) -> AIApprovalRequest:
        async with self._session_factory() as session:
            model = AIApprovalRequestModel(
                id=request.id,
                tenant_id=request.tenant_id,
                conversation_id=request.conversation_id,
                customer_message_id=request.customer_message_id,
                status=request.status.value,
                customer_summary=request.customer_summary,
                ai_reasoning_summary=request.ai_reasoning_summary,
                suggested_response=request.suggested_response,
                suggested_action_type=request.suggested_action_type.value,
                risk_level=request.risk_level.value,
                requires_approval=request.requires_approval,
                customer_notified_handoff=request.customer_notified_handoff,
                agent_edit=request.agent_edit,
                final_response=request.final_response,
                created_at=request.created_at,
                updated_at=request.updated_at,
            )
            session.add(model)
            await session.commit()
            await session.refresh(model)
            return _to_domain(model)

    async def get_by_id(
        self,
        tenant_id: str,
        approval_id: str,
    ) -> AIApprovalRequest | None:
        async with self._session_factory() as session:
            stmt = select(AIApprovalRequestModel).where(
                AIApprovalRequestModel.tenant_id == tenant_id,
                AIApprovalRequestModel.id == approval_id,
            )
            result = await session.execute(stmt)
            model = result.scalar_one_or_none()
            if model is None:
                return None
            return _to_domain(model)

    async def list_by_tenant(
        self,
        tenant_id: str,
        *,
        status: ApprovalStatus | None = None,
    ) -> list[AIApprovalRequest]:
        async with self._session_factory() as session:
            stmt = select(AIApprovalRequestModel).where(
                AIApprovalRequestModel.tenant_id == tenant_id,
            )

            if status is not None:
                stmt = stmt.where(AIApprovalRequestModel.status == status.value)

            stmt = stmt.order_by(AIApprovalRequestModel.created_at.desc())

            result = await session.execute(stmt)
            models = result.scalars().all()
            return [_to_domain(model) for model in models]

    async def get_pending_by_conversation(
        self,
        tenant_id: str,
        conversation_id: str,
    ) -> AIApprovalRequest | None:
        async with self._session_factory() as session:
            stmt = (
                select(AIApprovalRequestModel)
                .where(
                    AIApprovalRequestModel.tenant_id == tenant_id,
                    AIApprovalRequestModel.conversation_id == conversation_id,
                    AIApprovalRequestModel.status == ApprovalStatus.pending.value,
                )
                .order_by(AIApprovalRequestModel.created_at.desc())
                .limit(1)
            )
            result = await session.execute(stmt)
            model = result.scalar_one_or_none()
            if model is None:
                return None
            return _to_domain(model)

    async def update(self, request: AIApprovalRequest) -> AIApprovalRequest:
        now = datetime.now(timezone.utc)

        async with self._session_factory() as session:
            stmt = select(AIApprovalRequestModel).where(
                AIApprovalRequestModel.tenant_id == request.tenant_id,
                AIApprovalRequestModel.id == request.id,
            )
            result = await session.execute(stmt)
            model = result.scalar_one_or_none()

            if model is None:
                raise ValueError("Approval request not found")

            model.conversation_id = request.conversation_id
            model.customer_message_id = request.customer_message_id
            model.status = request.status.value
            model.customer_summary = request.customer_summary
            model.ai_reasoning_summary = request.ai_reasoning_summary
            model.suggested_response = request.suggested_response
            model.suggested_action_type = request.suggested_action_type.value
            model.risk_level = request.risk_level.value
            model.requires_approval = request.requires_approval
            model.customer_notified_handoff = request.customer_notified_handoff
            model.agent_edit = request.agent_edit
            model.final_response = request.final_response
            model.updated_at = now

            await session.commit()
            await session.refresh(model)
            return _to_domain(model)
