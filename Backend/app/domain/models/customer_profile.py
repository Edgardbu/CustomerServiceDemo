from datetime import datetime, timezone
from uuid import uuid4

from pydantic import BaseModel, Field

from app.domain.models.conversation import Channel


class CustomerProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    tenant_id: str
    channel: Channel
    external_id: str
    display_name: str | None = None
    username: str | None = None
    profile_picture_url: str | None = None
    agent_label: str | None = None
    agent_notes: str | None = None
    profile_overridden: bool = False
    updated_by_user_id: str | None = None
    last_synced_at: datetime | None = None
    raw_profile: dict | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
