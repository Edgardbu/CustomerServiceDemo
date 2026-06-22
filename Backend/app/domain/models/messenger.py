from pydantic import BaseModel, Field


class MessengerUserProfile(BaseModel):
    external_id: str
    display_name: str | None = None
    username: str | None = None
    profile_picture_url: str | None = None
    raw_profile: dict = Field(default_factory=dict)
