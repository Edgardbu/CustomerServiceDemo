from datetime import datetime, timezone
from uuid import uuid4

from app.domain.models.conversation import Channel
from app.domain.models.customer_profile import CustomerProfile
from app.infrastructure.database.customer_profile_sync import _merge_platform_sync_profile


class InMemoryCustomerProfileRepository:
    def __init__(self) -> None:
        self._profiles: dict[str, CustomerProfile] = {}

    def _key(self, tenant_id: str, channel: Channel, external_id: str) -> str:
        return f"{tenant_id}:{channel.value}:{external_id}"

    async def get_by_external_id(
        self,
        tenant_id: str,
        channel: Channel,
        external_id: str,
    ) -> CustomerProfile | None:
        return self._profiles.get(self._key(tenant_id, channel, external_id))

    async def get_many_by_external_ids(
        self,
        tenant_id: str,
        channel: Channel,
        external_ids: list[str],
    ) -> dict[str, CustomerProfile]:
        result: dict[str, CustomerProfile] = {}
        for external_id in external_ids:
            profile = await self.get_by_external_id(tenant_id, channel, external_id)
            if profile is not None:
                result[external_id] = profile
        return result

    async def upsert_profile(
        self,
        tenant_id: str,
        channel: Channel,
        external_id: str,
        *,
        display_name: str | None = None,
        username: str | None = None,
        profile_picture_url: str | None = None,
        raw_profile: dict | None = None,
    ) -> CustomerProfile:
        key = self._key(tenant_id, channel, external_id)
        existing = self._profiles.get(key)

        merged = _merge_platform_sync_profile(
            existing=existing,
            tenant_id=tenant_id,
            channel=channel,
            external_id=external_id,
            display_name=display_name,
            username=username,
            profile_picture_url=profile_picture_url,
            raw_profile=raw_profile,
        )

        self._profiles[key] = merged
        return merged

    async def update_agent_profile(
        self,
        tenant_id: str,
        channel: Channel,
        external_id: str,
        *,
        display_name: str | None = None,
        username: str | None = None,
        profile_picture_url: str | None = None,
        agent_label: str | None = None,
        agent_notes: str | None = None,
        profile_overridden: bool = False,
        updated_by_user_id: str | None = None,
    ) -> CustomerProfile:
        key = self._key(tenant_id, channel, external_id)
        now = datetime.now(timezone.utc)
        existing = self._profiles.get(key)

        if existing is None:
            profile = CustomerProfile(
                id=str(uuid4()),
                tenant_id=tenant_id,
                channel=channel,
                external_id=external_id,
                display_name=display_name,
                username=username,
                profile_picture_url=profile_picture_url,
                agent_label=agent_label,
                agent_notes=agent_notes,
                profile_overridden=profile_overridden,
                updated_by_user_id=updated_by_user_id,
                created_at=now,
                updated_at=now,
            )
        else:
            profile = existing.model_copy(
                update={
                    "display_name": display_name,
                    "username": username,
                    "profile_picture_url": profile_picture_url,
                    "agent_label": agent_label,
                    "agent_notes": agent_notes,
                    "profile_overridden": profile_overridden,
                    "updated_by_user_id": updated_by_user_id,
                    "updated_at": now,
                }
            )

        self._profiles[key] = profile
        return profile
