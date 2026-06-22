from pydantic import BaseModel, Field

from app.domain.models.conversation import Channel


class InboundChannelMessage(BaseModel):
    external_message_id: str | None = None
    external_conversation_id: str | None = None
    sender_external_id: str
    recipient_external_id: str | None = None
    text: str
    channel: Channel
    attachments: list[str] = Field(default_factory=list)
    metadata: dict | None = None
    contact_display_name: str | None = None
    raw_payload: dict = Field(default_factory=dict)
