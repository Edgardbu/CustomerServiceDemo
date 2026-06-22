"""AI domain models for settings, approvals, and auto-reply context.

Separation of concerns (Bot Studio):
- AISettings: global behavior — tone, approval/escalation rules, short business identity.
- Knowledge Base: factual content (FAQ, menu, pricing, policies, guides, scripts).
- Bot flows: deterministic conversation steps.
- FAQ and product/menu/pricing content belong in Knowledge Base, not AI Settings.
"""

from datetime import datetime, timezone
from enum import StrEnum
from uuid import uuid4

from pydantic import BaseModel, Field

from app.domain.models.bot import BotAction, BotIntent
from app.domain.models.conversation import Channel, Conversation, Message
from app.domain.models.customer_profile import CustomerProfile
from app.domain.models.knowledge import KnowledgeContextChunk


class AIConversationStatus(StrEnum):
    active = "active"
    paused = "paused"
    waiting_for_approval = "waiting_for_approval"


class ApprovalStatus(StrEnum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    edited = "edited"
    sent = "sent"


class SuggestedActionType(StrEnum):
    normal_reply = "normal_reply"
    price_offer = "price_offer"
    discount = "discount"
    refund = "refund"
    custom_offer = "custom_offer"
    other = "other"


class RiskLevel(StrEnum):
    low = "low"
    medium = "medium"
    high = "high"


DEFAULT_APPROVAL_HANDOFF_MESSAGE = (
    "רגע, אני מעביר את זה לבדיקה של נציג אנושי כדי לוודא שאתה מקבל תשובה מדויקת."
)


class AIDecision(BaseModel):
    requires_approval: bool
    suggested_response: str
    customer_summary: str
    ai_reasoning_summary: str
    suggested_action_type: SuggestedActionType
    risk_level: RiskLevel


class AIAutoReplyDecision(AIDecision):
    """AI decision for inbound auto-reply workflow."""


class AIAutoReplyContext(BaseModel):
    """Runtime context for AI auto-reply. Factual answers come from knowledge chunks only."""

    tenant_id: str
    channel: Channel
    customer_id: str
    business_context: str = ""
    approval_rules: str = ""
    tone_instructions: str = ""
    conversation_notes: str = ""
    customer_profile_text: str = ""
    conversation: Conversation
    retry_after_handoff_correction: bool = False
    relevant_knowledge: list[KnowledgeContextChunk] = Field(default_factory=list)
    bot_intent: BotIntent | None = None
    bot_action: BotAction | None = None
    bot_reason_summary: str = ""


class AISettings(BaseModel):
    """Tenant AI behavior configuration. Not a content store — use Knowledge Base for facts."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    tenant_id: str
    enabled: bool = False
    auto_reply_enabled: bool = False
    business_context: str = ""
    # Deprecated: persisted for DB compatibility only; not used in AI runtime.
    ai_purpose: str = ""
    # Deprecated: use Knowledge Base documents (document_type=faq) instead.
    faq: str = ""
    approval_rules: str = ""
    tone_instructions: str = ""
    approval_handoff_message: str = DEFAULT_APPROVAL_HANDOFF_MESSAGE
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ConversationAINotes(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    tenant_id: str
    conversation_id: str
    notes: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AIApprovalRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    tenant_id: str
    conversation_id: str
    customer_message_id: str | None = None
    status: ApprovalStatus = ApprovalStatus.pending
    customer_summary: str
    ai_reasoning_summary: str
    suggested_response: str
    suggested_action_type: SuggestedActionType
    risk_level: RiskLevel
    requires_approval: bool = True
    customer_notified_handoff: bool = False
    agent_edit: str | None = None
    final_response: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AgentReplySuggestionContext(BaseModel):
    tenant_id: str
    conversation: Conversation
    customer_profile: CustomerProfile | None = None
    recent_messages: list[Message] = Field(default_factory=list)
    ai_notes: str = ""
    knowledge_chunks: list[KnowledgeContextChunk] = Field(default_factory=list)
    business_context: str = ""
    tone_instructions: str = ""
    approval_rules: str = ""
    extra_instruction: str | None = None


class UsedKnowledgeReference(BaseModel):
    document_id: str
    title: str
    chunk: str


class AgentReplySuggestion(BaseModel):
    suggested_reply: str
    why_it_fits: str
    confidence: float = Field(ge=0.0, le=1.0)
    used_knowledge: list[UsedKnowledgeReference] = Field(default_factory=list)
