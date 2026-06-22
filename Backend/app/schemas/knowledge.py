from datetime import datetime

from pydantic import BaseModel, Field

from app.domain.models.knowledge import KnowledgeDocument, KnowledgeDocumentType


class KnowledgeDocumentRead(BaseModel):
    id: str
    tenant_id: str
    title: str
    content: str
    document_type: KnowledgeDocumentType
    tags: list[str]
    enabled: bool
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_domain(cls, document: KnowledgeDocument) -> "KnowledgeDocumentRead":
        return cls.model_validate(document.model_dump())


class KnowledgeDocumentCreate(BaseModel):
    tenant_id: str
    title: str = Field(min_length=1, max_length=500)
    content: str = Field(min_length=1)
    document_type: KnowledgeDocumentType = KnowledgeDocumentType.other
    tags: list[str] = Field(default_factory=list)
    enabled: bool = True


class KnowledgeDocumentUpdate(BaseModel):
    tenant_id: str
    title: str = Field(min_length=1, max_length=500)
    content: str = Field(min_length=1)
    document_type: KnowledgeDocumentType = KnowledgeDocumentType.other
    tags: list[str] = Field(default_factory=list)
    enabled: bool = True


class KnowledgeChunkRead(BaseModel):
    id: str
    tenant_id: str
    document_id: str
    content: str
    chunk_index: int
    embedding: list[float] | None = None
    metadata: dict | None = None
    created_at: datetime
    score: float | None = None


class KnowledgeSearchRequest(BaseModel):
    tenant_id: str
    query: str = Field(min_length=1)
    limit: int = Field(default=5, ge=1, le=20)


class KnowledgeSearchResponse(BaseModel):
    query: str
    chunks: list[KnowledgeChunkRead]
    documents: list[KnowledgeDocumentRead]
