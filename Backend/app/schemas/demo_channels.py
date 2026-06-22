from typing import Literal

from pydantic import BaseModel, Field

DemoChannelName = Literal["instagram", "facebook", "whatsapp", "sms", "email"]

SUPPORTED_DEMO_CHANNEL_NAMES: list[DemoChannelName] = [
    "instagram",
    "facebook",
    "whatsapp",
    "sms",
    "email",
]


class DemoChannelInboundRequest(BaseModel):
    tenant_id: str = "demo"
    channel: DemoChannelName
    customer_id: str = Field(min_length=1)
    display_name: str | None = None
    username: str | None = None
    profile_picture_url: str | None = None
    content: str = Field(min_length=1)
    metadata: dict | None = None


class DemoChannelInboundResponse(BaseModel):
    status: str = "ok"
    conversation_id: str
    external_message_id: str
    channel: DemoChannelName


class DemoChannelConfigResponse(BaseModel):
    enabled: bool
    channels: list[DemoChannelName]
