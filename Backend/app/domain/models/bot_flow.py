from datetime import datetime, timezone
from enum import StrEnum
from uuid import uuid4

from pydantic import BaseModel, Field


class BotFlowSessionStatus(StrEnum):
    active = "active"
    completed = "completed"
    cancelled = "cancelled"
    handed_off = "handed_off"


class FlowNodeType(StrEnum):
    message = "message"
    input = "input"
    condition = "condition"
    action = "action"
    handoff = "handoff"
    approval = "approval"
    end = "end"


class BotFlow(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    tenant_id: str
    name: str
    description: str = ""
    trigger_intents: list[str] = Field(default_factory=list)
    enabled: bool = True
    version: int = 1
    definition: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BotFlowSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    tenant_id: str
    conversation_id: str
    flow_id: str
    current_node_id: str | None = None
    state: dict = Field(default_factory=dict)
    status: BotFlowSessionStatus = BotFlowSessionStatus.active
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class FlowInputExtractionContext(BaseModel):
    field: str
    customer_message: str
    expected_values: list[str] = Field(default_factory=list)
    validation_prompt: str = ""
    required: bool = True
    conversation_history: str = ""


class FlowInputExtractionResult(BaseModel):
    value: str | None = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    clarification_message: str | None = None


class FlowStepResult(BaseModel):
    message_to_send: str | None = None
    messages_to_send: list[str] = Field(default_factory=list)
    needs_approval: bool = False
    approval_suggested_response: str | None = None
    approval_customer_summary: str | None = None
    handoff_required: bool = False
    completed: bool = False
    awaiting_input: bool = False
