from datetime import datetime, timezone
from uuid import uuid4

from app.domain.models.conversation import Channel
from app.domain.models.customer_profile import CustomerProfile


def _merge_platform_sync_profile(
    *,
    existing: CustomerProfile | None,
    tenant_id: str,
    channel: Channel,
    external_id: str,
    display_name: str | None,
    username: str | None,
    profile_picture_url: str | None,
    raw_profile: dict | None,
) -> CustomerProfile:
    now = datetime.now(timezone.utc)

    if existing is None:
        return CustomerProfile(
            id=str(uuid4()),
            tenant_id=tenant_id,
            channel=channel,
            external_id=external_id,
            display_name=display_name,
            username=username,
            profile_picture_url=profile_picture_url,
            raw_profile=raw_profile,
            last_synced_at=now,
            created_at=now,
            updated_at=now,
        )

    updates: dict = {
        "raw_profile": raw_profile,
        "last_synced_at": now,
        "updated_at": now,
    }

    if not existing.profile_overridden:
        updates.update(
            {
                "display_name": display_name,
                "username": username,
                "profile_picture_url": profile_picture_url,
            }
        )

    return existing.model_copy(update=updates)
