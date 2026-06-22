from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.domain.models.conversation import Channel
from app.domain.models.customer_profile import CustomerProfile
from app.infrastructure.database.customer_profile_sync import _merge_platform_sync_profile
from app.infrastructure.database.postgres.models import CustomerProfileModel


def _to_domain(model: CustomerProfileModel) -> CustomerProfile:
    return CustomerProfile(
        id=model.id,
        tenant_id=model.tenant_id,
        channel=Channel(model.channel),
        external_id=model.external_id,
        display_name=model.display_name,
        username=model.username,
        profile_picture_url=model.profile_picture_url,
        agent_label=model.agent_label,
        agent_notes=model.agent_notes,
        profile_overridden=model.profile_overridden,
        updated_by_user_id=model.updated_by_user_id,
        last_synced_at=model.last_synced_at,
        raw_profile=dict(model.raw_profile) if model.raw_profile else None,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


class PostgresCustomerProfileRepository:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def get_by_external_id(
        self,
        tenant_id: str,
        channel: Channel,
        external_id: str,
    ) -> CustomerProfile | None:
        async with self._session_factory() as session:
            stmt = select(CustomerProfileModel).where(
                CustomerProfileModel.tenant_id == tenant_id,
                CustomerProfileModel.channel == channel.value,
                CustomerProfileModel.external_id == external_id,
            )
            result = await session.execute(stmt)
            model = result.scalar_one_or_none()
            if model is None:
                return None
            return _to_domain(model)

    async def get_many_by_external_ids(
        self,
        tenant_id: str,
        channel: Channel,
        external_ids: list[str],
    ) -> dict[str, CustomerProfile]:
        if not external_ids:
            return {}

        async with self._session_factory() as session:
            stmt = select(CustomerProfileModel).where(
                CustomerProfileModel.tenant_id == tenant_id,
                CustomerProfileModel.channel == channel.value,
                CustomerProfileModel.external_id.in_(external_ids),
            )
            result = await session.execute(stmt)
            models = result.scalars().all()

        return {model.external_id: _to_domain(model) for model in models}

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
        now = datetime.now(timezone.utc)

        async with self._session_factory() as session:
            stmt = select(CustomerProfileModel).where(
                CustomerProfileModel.tenant_id == tenant_id,
                CustomerProfileModel.channel == channel.value,
                CustomerProfileModel.external_id == external_id,
            )
            result = await session.execute(stmt)
            existing_model = result.scalar_one_or_none()
            existing = _to_domain(existing_model) if existing_model else None

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

            if existing_model is None:
                model = CustomerProfileModel(
                    id=merged.id,
                    tenant_id=merged.tenant_id,
                    channel=merged.channel.value,
                    external_id=merged.external_id,
                    display_name=merged.display_name,
                    username=merged.username,
                    profile_picture_url=merged.profile_picture_url,
                    agent_label=merged.agent_label,
                    agent_notes=merged.agent_notes,
                    profile_overridden=merged.profile_overridden,
                    updated_by_user_id=merged.updated_by_user_id,
                    last_synced_at=merged.last_synced_at,
                    raw_profile=merged.raw_profile,
                    created_at=merged.created_at,
                    updated_at=merged.updated_at,
                )
                session.add(model)
                await session.commit()
                await session.refresh(model)
                return _to_domain(model)

            existing_model.display_name = merged.display_name
            existing_model.username = merged.username
            existing_model.profile_picture_url = merged.profile_picture_url
            existing_model.raw_profile = merged.raw_profile
            existing_model.last_synced_at = merged.last_synced_at
            existing_model.updated_at = now
            await session.commit()
            await session.refresh(existing_model)
            return _to_domain(existing_model)

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
        now = datetime.now(timezone.utc)

        async with self._session_factory() as session:
            stmt = select(CustomerProfileModel).where(
                CustomerProfileModel.tenant_id == tenant_id,
                CustomerProfileModel.channel == channel.value,
                CustomerProfileModel.external_id == external_id,
            )
            result = await session.execute(stmt)
            model = result.scalar_one_or_none()

            if model is None:
                model = CustomerProfileModel(
                    id=str(uuid4()),
                    tenant_id=tenant_id,
                    channel=channel.value,
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
                session.add(model)
            else:
                model.display_name = display_name
                model.username = username
                model.profile_picture_url = profile_picture_url
                model.agent_label = agent_label
                model.agent_notes = agent_notes
                model.profile_overridden = profile_overridden
                model.updated_by_user_id = updated_by_user_id
                model.updated_at = now

            await session.commit()
            await session.refresh(model)
            return _to_domain(model)
