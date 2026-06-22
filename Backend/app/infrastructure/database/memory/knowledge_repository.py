import re
from datetime import datetime, timezone

from app.domain.models.knowledge import KnowledgeDocument


def _tokenize_query(query: str) -> list[str]:
    return [token for token in re.findall(r"\w+", query.lower()) if len(token) > 1]


def _score_text(text: str, terms: list[str]) -> float:
    if not terms:
        return 0.0
    lowered = text.lower()
    return float(sum(lowered.count(term) for term in terms))


class InMemoryKnowledgeDocumentRepository:
    def __init__(self) -> None:
        self._documents: dict[str, KnowledgeDocument] = {}

    def _key(self, tenant_id: str, document_id: str) -> str:
        return f"{tenant_id}:{document_id}"

    async def create(self, document: KnowledgeDocument) -> KnowledgeDocument:
        self._documents[self._key(document.tenant_id, document.id)] = document
        return document

    async def get_by_id(self, tenant_id: str, document_id: str) -> KnowledgeDocument | None:
        return self._documents.get(self._key(tenant_id, document_id))

    async def list_by_tenant(self, tenant_id: str) -> list[KnowledgeDocument]:
        items = [doc for doc in self._documents.values() if doc.tenant_id == tenant_id]
        return sorted(items, key=lambda doc: doc.updated_at, reverse=True)

    async def update(self, document: KnowledgeDocument) -> KnowledgeDocument:
        key = self._key(document.tenant_id, document.id)
        if key not in self._documents:
            raise ValueError("Knowledge document not found")
        updated = document.model_copy(update={"updated_at": datetime.now(timezone.utc)})
        self._documents[key] = updated
        return updated

    async def delete(self, tenant_id: str, document_id: str) -> None:
        self._documents.pop(self._key(tenant_id, document_id), None)


class InMemoryKnowledgeChunkRepository:
    def __init__(self, document_repository: InMemoryKnowledgeDocumentRepository) -> None:
        self._documents = document_repository
        self._chunks: dict[str, list] = {}

    def _key(self, tenant_id: str, document_id: str) -> str:
        return f"{tenant_id}:{document_id}"

    async def replace_for_document(
        self,
        tenant_id: str,
        document_id: str,
        chunks: list,
    ) -> list:
        self._chunks[self._key(tenant_id, document_id)] = list(chunks)
        return chunks

    async def delete_by_document(self, tenant_id: str, document_id: str) -> None:
        self._chunks.pop(self._key(tenant_id, document_id), None)

    async def list_by_document(
        self,
        tenant_id: str,
        document_id: str,
    ) -> list:
        return sorted(
            self._chunks.get(self._key(tenant_id, document_id), []),
            key=lambda chunk: chunk.chunk_index,
        )

    async def search_by_keywords(
        self,
        tenant_id: str,
        query: str,
        *,
        limit: int = 5,
    ) -> list[tuple]:
        terms = _tokenize_query(query)
        if not terms:
            return []

        scored: list[tuple] = []
        for key, chunks in self._chunks.items():
            if not key.startswith(f"{tenant_id}:"):
                continue
            document = self._documents._documents.get(key)
            if document is None or not document.enabled:
                continue
            for chunk in chunks:
                text = " ".join([document.title, " ".join(document.tags), chunk.content])
                score = _score_text(text, terms)
                if score > 0:
                    scored.append((chunk, score))

        scored.sort(key=lambda item: item[1], reverse=True)
        return scored[:limit]
