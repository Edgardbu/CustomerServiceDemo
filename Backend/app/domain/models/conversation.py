from datetime import datetime, timezone
from enum import StrEnum
from uuid import uuid4

from pydantic import BaseModel, Field


class Channel(StrEnum):
    whatsapp = "whatsapp"
    web_chat = "web_chat"
    email = "email"
    sms = "sms"
    facebook = "facebook"
    instagram = "instagram"


class ConversationStatus(StrEnum):
    open = "open"
    pending = "pending"
    resolved = "resolved"
    closed = "closed"


class SenderType(StrEnum):
    customer = "customer"
    agent = "agent"
    bot = "bot"
    system = "system"


class DeliveryStatus(StrEnum):
    pending = "pending"
    sent = "sent"
    failed = "failed"


class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    tenant_id: str
    conversation_id: str
    sender_type: SenderType
    content: str
    attachments: list[str] = Field(default_factory=list)
    external_message_id: str | None = None
    delivery_status: DeliveryStatus | None = None
    external_raw_response: dict | None = None
    ai_generated: bool = False
    ai_approval_request_id: str | None = None
    metadata: dict | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Conversation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    tenant_id: str
    customer_id: str
    channel: Channel
    status: ConversationStatus = ConversationStatus.open
    assigned_agent_id: str | None = None
    tags: list[str] = Field(default_factory=list)
    messages: list[Message] = Field(default_factory=list)
    ai_auto_reply_enabled: bool = True
    ai_status: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
