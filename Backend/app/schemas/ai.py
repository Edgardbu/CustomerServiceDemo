"""API schemas for AI settings and approvals.

AI Settings expose behavior/configuration only. FAQ and product content live in Knowledge Base.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.domain.models.ai import AIApprovalRequest, AISettings, ApprovalStatus, DEFAULT_APPROVAL_HANDOFF_MESSAGE


class AISettingsRead(BaseModel):
    """Frontend-facing AI settings — behavior, tone, and escalation rules only."""

    id: str
    tenant_id: str
    enabled: bool
    auto_reply_enabled: bool
    business_context: str
    tone_instructions: str
    approval_rules: str
    approval_handoff_message: str
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_domain(cls, settings: AISettings) -> "AISettingsRead":
        return cls(
            id=settings.id,
            tenant_id=settings.tenant_id,
            enabled=settings.enabled,
            auto_reply_enabled=settings.auto_reply_enabled,
            business_context=settings.business_context,
            tone_instructions=settings.tone_instructions,
            approval_rules=settings.approval_rules,
            approval_handoff_message=settings.approval_handoff_message,
            created_at=settings.created_at,
            updated_at=settings.updated_at,
        )


class AISettingsUpdate(BaseModel):
    """Update AI behavior settings. Deprecated faq/ai_purpose fields are accepted and ignored."""

    model_config = ConfigDict(extra="ignore")

    enabled: bool = False
    auto_reply_enabled: bool = False
    business_context: str = ""
    tone_instructions: str = ""
    approval_rules: str = ""
    approval_handoff_message: str = DEFAULT_APPROVAL_HANDOFF_MESSAGE
    # Deprecated — kept for backwards compatibility with older clients.
    ai_purpose: str | None = Field(
        default=None,
        deprecated="Use business_context for identity. Ignored on save.",
    )
    faq: str | None = Field(
        default=None,
        deprecated="Use Knowledge Base documents. Ignored on save.",
    )


class ConversationAINotesRead(BaseModel):
    tenant_id: str
    conversation_id: str
    notes: str
    updated_at: datetime


class ConversationAINotesUpdate(BaseModel):
    tenant_id: str
    notes: str = ""


class AIApprovalRead(BaseModel):
    id: str
    tenant_id: str
    conversation_id: str
    customer_message_id: str | None = None
    status: ApprovalStatus
    customer_summary: str
    ai_reasoning_summary: str
    suggested_response: str
    suggested_action_type: str
    risk_level: str
    requires_approval: bool
    customer_notified_handoff: bool = False
    agent_edit: str | None = None
    final_response: str | None = None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_domain(cls, approval: AIApprovalRequest) -> "AIApprovalRead":
        return cls(
            id=approval.id,
            tenant_id=approval.tenant_id,
            conversation_id=approval.conversation_id,
            customer_message_id=approval.customer_message_id,
            status=approval.status,
            customer_summary=approval.customer_summary,
            ai_reasoning_summary=approval.ai_reasoning_summary,
            suggested_response=approval.suggested_response,
            suggested_action_type=approval.suggested_action_type.value,
            risk_level=approval.risk_level.value,
            requires_approval=approval.requires_approval,
            customer_notified_handoff=approval.customer_notified_handoff,
            agent_edit=approval.agent_edit,
            final_response=approval.final_response,
            created_at=approval.created_at,
            updated_at=approval.updated_at,
        )


class EditAndSendRequest(BaseModel):
    tenant_id: str
    final_response: str = Field(min_length=1, max_length=1000)


class ApprovalActionRequest(BaseModel):
    tenant_id: str


class AgentReplySuggestRequest(BaseModel):
    tenant_id: str = "demo"
    extra_instruction: str | None = None


class UsedKnowledgeRead(BaseModel):
    document_id: str
    title: str
    chunk: str


class AgentReplySuggestResponse(BaseModel):
    conversation_id: str
    suggested_reply: str
    why_it_fits: str
    confidence: float
    used_knowledge: list[UsedKnowledgeRead]

    @classmethod
    def from_domain(
        cls,
        *,
        conversation_id: str,
        suggestion,
    ) -> "AgentReplySuggestResponse":
        return cls(
            conversation_id=conversation_id,
            suggested_reply=suggestion.suggested_reply,
            why_it_fits=suggestion.why_it_fits,
            confidence=suggestion.confidence,
            used_knowledge=[
                UsedKnowledgeRead(
                    document_id=item.document_id,
                    title=item.title,
                    chunk=item.chunk,
                )
                for item in suggestion.used_knowledge
            ],
        )
