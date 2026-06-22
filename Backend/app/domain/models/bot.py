from enum import StrEnum

from pydantic import BaseModel, Field

from app.domain.models.conversation import Channel, Conversation
from app.domain.models.knowledge import KnowledgeContextChunk


class BotIntent(StrEnum):
    faq_question = "faq_question"
    order_start = "order_start"
    order_update = "order_update"
    price_question = "price_question"
    menu_question = "menu_question"
    delivery_question = "delivery_question"
    payment_question = "payment_question"
    complaint = "complaint"
    refund_request = "refund_request"
    discount_request = "discount_request"
    human_request = "human_request"
    unknown = "unknown"


class BotAction(StrEnum):
    answer_with_ai = "answer_with_ai"
    answer_from_knowledge = "answer_from_knowledge"
    continue_flow = "continue_flow"
    ask_clarification = "ask_clarification"
    require_approval = "require_approval"
    handoff_to_human = "handoff_to_human"
    ignore = "ignore"


class BotDecision(BaseModel):
    intent: BotIntent
    action: BotAction
    confidence: float = Field(ge=0.0, le=1.0)
    reason_summary: str
    needs_approval: bool = False
    should_handoff: bool = False


class BotOrchestrationContext(BaseModel):
    tenant_id: str
    channel: Channel
    business_context: str = ""
    approval_rules: str = ""
    conversation_notes: str = ""
    customer_profile_text: str = ""
    conversation: Conversation
    relevant_knowledge: list[KnowledgeContextChunk] = Field(default_factory=list)
    latest_customer_message: str = ""
    delivery_outside_allowed_area: bool = False
