from datetime import datetime, timezone
from enum import StrEnum
from uuid import uuid4

from pydantic import BaseModel, Field


class UserRole(StrEnum):
    owner = "owner"
    admin = "admin"
    agent = "agent"
    viewer = "viewer"


class UserStatus(StrEnum):
    active = "active"
    disabled = "disabled"


class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    tenant_id: str
    email: str
    display_name: str
    role: UserRole
    status: UserStatus = UserStatus.active
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_seen_at: datetime | None = None
