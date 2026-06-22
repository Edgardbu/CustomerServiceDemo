from pydantic import BaseModel, Field


class ChannelSendResult(BaseModel):
    success: bool
    external_message_id: str | None = None
    recipient_id: str
    raw_response: dict = Field(default_factory=dict)
