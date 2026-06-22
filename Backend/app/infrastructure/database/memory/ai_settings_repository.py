from datetime import datetime, timezone

from app.domain.models.ai import AISettings, DEFAULT_APPROVAL_HANDOFF_MESSAGE


class InMemoryAISettingsRepository:
    def __init__(self) -> None:
        self._settings: dict[str, AISettings] = {}

    async def get_by_tenant(self, tenant_id: str) -> AISettings | None:
        return self._settings.get(tenant_id)

    async def upsert(self, settings: AISettings) -> AISettings:
        now = datetime.now(timezone.utc)
        existing = self._settings.get(settings.tenant_id)

        if existing is None:
            stored = settings.model_copy(
                update={
                    "created_at": settings.created_at,
                    "updated_at": now,
                }
            )
        else:
            stored = existing.model_copy(
                update={
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
                }
            )

        self._settings[settings.tenant_id] = stored
        return stored
