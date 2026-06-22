from datetime import datetime

from pydantic import BaseModel, Field

from app.domain.models.bot_flow import BotFlow, BotFlowSession, BotFlowSessionStatus


class BotFlowRead(BaseModel):
    id: str
    tenant_id: str
    name: str
    description: str
    trigger_intents: list[str]
    enabled: bool
    version: int
    definition: dict
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_domain(cls, flow: BotFlow) -> "BotFlowRead":
        return cls.model_validate(flow.model_dump())


class BotFlowCreate(BaseModel):
    tenant_id: str
    name: str = Field(min_length=1, max_length=200)
    description: str = ""
    trigger_intents: list[str] = Field(default_factory=list)
    enabled: bool = True
    version: int = 1
    definition: dict = Field(default_factory=dict)


class BotFlowUpdate(BaseModel):
    tenant_id: str
    name: str = Field(min_length=1, max_length=200)
    description: str = ""
    trigger_intents: list[str] = Field(default_factory=list)
    enabled: bool = True
    version: int = 1
    definition: dict = Field(default_factory=dict)


class BotFlowSessionRead(BaseModel):
    id: str
    tenant_id: str
    conversation_id: str
    flow_id: str
    flow_name: str | None = None
    current_node_id: str | None = None
    state: dict
    status: BotFlowSessionStatus
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_domain(
        cls,
        session: BotFlowSession,
        *,
        flow_name: str | None = None,
    ) -> "BotFlowSessionRead":
        data = session.model_dump()
        data["flow_name"] = flow_name
        return cls.model_validate(data)


class CancelFlowSessionRequest(BaseModel):
    tenant_id: str
