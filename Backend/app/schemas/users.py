from datetime import datetime

from pydantic import BaseModel, Field

from app.domain.models.user import User, UserRole, UserStatus


class AssignedAgentRead(BaseModel):
    id: str
    display_name: str
    email: str
    role: UserRole
    status: UserStatus


class UserRead(BaseModel):
    id: str
    tenant_id: str
    email: str
    display_name: str
    role: UserRole
    status: UserStatus
    created_at: datetime
    updated_at: datetime
    last_seen_at: datetime | None = None

    @classmethod
    def from_domain(cls, user: User) -> "UserRead":
        return cls.model_validate(user.model_dump())

    def to_assigned_agent(self) -> AssignedAgentRead:
        return AssignedAgentRead(
            id=self.id,
            display_name=self.display_name,
            email=self.email,
            role=self.role,
            status=self.status,
        )


class UserCreate(BaseModel):
    tenant_id: str
    email: str = Field(min_length=3, max_length=320)
    display_name: str = Field(min_length=1, max_length=200)
    role: UserRole
    status: UserStatus = UserStatus.active


class UserUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=200)
    role: UserRole | None = None
    status: UserStatus | None = None


class ConversationTenantAction(BaseModel):
    tenant_id: str


class ConversationAssignRequest(BaseModel):
    tenant_id: str
    agent_id: str


class ConversationTransferRequest(BaseModel):
    tenant_id: str
    agent_id: str
