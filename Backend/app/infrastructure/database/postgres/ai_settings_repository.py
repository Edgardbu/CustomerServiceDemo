from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.domain.models.ai import AISettings, DEFAULT_APPROVAL_HANDOFF_MESSAGE
from app.infrastructure.database.postgres.models import AISettingsModel


def _to_domain(model: AISettingsModel) -> AISettings:
    return AISettings(
        id=model.id,
        tenant_id=model.tenant_id,
        enabled=model.enabled,
        auto_reply_enabled=model.auto_reply_enabled,
        business_context=model.business_context,
        ai_purpose=model.ai_purpose,
        faq=model.faq,
        approval_rules=model.approval_rules,
        tone_instructions=model.tone_instructions,
        approval_handoff_message=model.approval_handoff_message or DEFAULT_APPROVAL_HANDOFF_MESSAGE,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


class PostgresAISettingsRepository:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def get_by_tenant(self, tenant_id: str) -> AISettings | None:
        async with self._session_factory() as session:
            stmt = select(AISettingsModel).where(AISettingsModel.tenant_id == tenant_id)
            result = await session.execute(stmt)
            model = result.scalar_one_or_none()
            if model is None:
                return None
            return _to_domain(model)

    async def upsert(self, settings: AISettings) -> AISettings:
        now = datetime.now(timezone.utc)

        async with self._session_factory() as session:
            stmt = (
                insert(AISettingsModel)
                .values(
                    id=settings.id,
                    tenant_id=settings.tenant_id,
                    enabled=settings.enabled,
                    auto_reply_enabled=settings.auto_reply_enabled,
                    business_context=settings.business_context,
                    ai_purpose=settings.ai_purpose,
                    faq=settings.faq,
                    approval_rules=settings.approval_rules,
                    tone_instructions=settings.tone_instructions,
                    approval_handoff_message=settings.approval_handoff_message or DEFAULT_APPROVAL_HANDOFF_MESSAGE,
                    created_at=settings.created_at,
                    updated_at=now,
                )
                .on_conflict_do_update(
                    index_elements=["tenant_id"],
                    set_={
                        "enabled": settings.enabled,
                        "auto_reply_enabled": settings.auto_reply_enabled,
                        "business_context": settings.business_context,
                        "ai_purpose": settings.ai_purpose,
                        "faq": settings.faq,
                        "approval_rules": settings.approval_rules,
                        "tone_instructions": settings.tone_instructions,
                        "approval_handoff_message": settings.approval_handoff_message
                        or DEFAULT_APPROVAL_HANDOFF_MESSAGE,
                        "updated_at": now,
                    },
                )
                .returning(AISettingsModel)
            )
            result = await session.execute(stmt)
            model = result.scalar_one()
            await session.commit()
            return _to_domain(model)
