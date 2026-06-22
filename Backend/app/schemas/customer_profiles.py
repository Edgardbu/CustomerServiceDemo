from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.domain.models.conversation import Channel
from app.domain.models.customer_profile import CustomerProfile


class CustomerProfileRead(BaseModel):
    external_id: str
    channel: Channel
    display_name: str | None = None
    username: str | None = None
    profile_picture_url: str | None = None
    agent_label: str | None = None
    agent_notes: str | None = None
    profile_overridden: bool = False
    updated_at: datetime | None = None

    @classmethod
    def from_profile(cls, profile: CustomerProfile) -> "CustomerProfileRead":
        return cls(
            external_id=profile.external_id,
            channel=profile.channel,
            display_name=profile.display_name,
            username=profile.username,
            profile_picture_url=profile.profile_picture_url,
            agent_label=profile.agent_label,
            agent_notes=profile.agent_notes,
            profile_overridden=profile.profile_overridden,
            updated_at=profile.updated_at,
        )

    @classmethod
    def fallback(cls, external_id: str, channel: Channel) -> "CustomerProfileRead":
        return cls(
            external_id=external_id,
            channel=channel,
            display_name=external_id,
        )


class CustomerProfileUpdate(BaseModel):
    tenant_id: str
    display_name: str | None = None
    username: str | None = None
    profile_picture_url: str | None = None
    agent_label: str | None = None
    agent_notes: str | None = None

    model_config = ConfigDict(extra="ignore")
