from pydantic import BaseModel, Field


class WhatsAppUserProfile(BaseModel):
    external_id: str
    display_name: str | None = None
    username: str | None = None
    profile_picture_url: str | None = None
    raw_profile: dict = Field(default_factory=dict)


class WhatsAppStatusUpdate(BaseModel):
    external_message_id: str
    status: str
    recipient_id: str | None = None
    raw_status: dict = Field(default_factory=dict)
