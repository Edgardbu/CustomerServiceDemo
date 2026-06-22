from pydantic import BaseModel, Field


class BootstrapOwnerCreate(BaseModel):
    tenant_id: str
    email: str = Field(min_length=3, max_length=320)
    display_name: str = Field(min_length=1, max_length=200)
    bootstrap_secret: str = Field(min_length=1)


class BootstrapStatusRead(BaseModel):
    bootstrap_enabled: bool
    has_owner_or_admin: bool
    bootstrap_required: bool
