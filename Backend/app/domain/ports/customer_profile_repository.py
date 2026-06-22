from typing import Protocol

from app.domain.models.conversation import Channel
from app.domain.models.customer_profile import CustomerProfile


class CustomerProfileRepository(Protocol):
    async def get_by_external_id(
        self,
        tenant_id: str,
        channel: Channel,
        external_id: str,
    ) -> CustomerProfile | None:
        ...

    async def get_many_by_external_ids(
        self,
        tenant_id: str,
        channel: Channel,
        external_ids: list[str],
    ) -> dict[str, CustomerProfile]:
        ...

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
        ...

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
        ...
