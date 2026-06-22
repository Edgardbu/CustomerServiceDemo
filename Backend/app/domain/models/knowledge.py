from datetime import datetime, timezone
from enum import StrEnum
from uuid import uuid4

from pydantic import BaseModel, Field


class KnowledgeDocumentType(StrEnum):
    faq = "faq"
    menu = "menu"
    policy = "policy"
    guide = "guide"
    script = "script"
    other = "other"


class KnowledgeDocument(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    tenant_id: str
    title: str
    content: str
    document_type: KnowledgeDocumentType = KnowledgeDocumentType.other
    tags: list[str] = Field(default_factory=list)
    enabled: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class KnowledgeChunk(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    tenant_id: str
    document_id: str
    content: str
    chunk_index: int
    embedding: list[float] | None = None
    metadata: dict | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class KnowledgeContextChunk(BaseModel):
    document_id: str
    document_title: str
    document_type: str
    chunk_index: int
    content: str
