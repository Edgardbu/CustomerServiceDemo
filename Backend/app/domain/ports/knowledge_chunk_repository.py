from typing import Protocol

from app.domain.models.knowledge import KnowledgeChunk


class KnowledgeChunkRepository(Protocol):
    async def replace_for_document(
        self,
        tenant_id: str,
        document_id: str,
        chunks: list[KnowledgeChunk],
    ) -> list[KnowledgeChunk]:
        ...

    async def delete_by_document(self, tenant_id: str, document_id: str) -> None:
        ...

    async def list_by_document(
        self,
        tenant_id: str,
        document_id: str,
    ) -> list[KnowledgeChunk]:
        ...

    async def search_by_keywords(
        self,
        tenant_id: str,
        query: str,
        *,
        limit: int = 5,
    ) -> list[tuple[KnowledgeChunk, float]]:
        ...
