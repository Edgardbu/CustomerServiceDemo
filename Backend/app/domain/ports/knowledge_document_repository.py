from typing import Protocol

from app.domain.models.knowledge import KnowledgeDocument


class KnowledgeDocumentRepository(Protocol):
    async def create(self, document: KnowledgeDocument) -> KnowledgeDocument:
        ...

    async def get_by_id(self, tenant_id: str, document_id: str) -> KnowledgeDocument | None:
        ...

    async def list_by_tenant(self, tenant_id: str) -> list[KnowledgeDocument]:
        ...

    async def update(self, document: KnowledgeDocument) -> KnowledgeDocument:
        ...

    async def delete(self, tenant_id: str, document_id: str) -> None:
        ...
