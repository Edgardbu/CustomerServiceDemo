from pydantic import BaseModel, ConfigDict

from app.domain.models.conversation import Channel, Conversation, Message, SenderType
from app.schemas.ai import AIApprovalRead
from app.schemas.customer_profiles import CustomerProfileRead
from app.schemas.users import AssignedAgentRead


class ConversationCreate(Conversation):
    id: str | None = None
    messages: list = []

    model_config = ConfigDict(extra="ignore")


class ConversationRead(Conversation):
    customer_profile: CustomerProfileRead | None = None
    pending_ai_approval: AIApprovalRead | None = None
    assigned_agent: AssignedAgentRead | None = None


class MessageCreate(Message):
    id: str | None = None
    conversation_id: str | None = None

    model_config = ConfigDict(extra="ignore")


MessageRead = Message
