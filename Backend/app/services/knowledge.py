"""Knowledge Base service — single source of tenant factual content.

Store FAQ, menu, pricing, policies, guides, and scripts here.
AI Settings hold behavior/tone/rules only, not product or FAQ content.
"""

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import uuid4

from app.domain.models.knowledge import (
    KnowledgeChunk,
    KnowledgeContextChunk,
    KnowledgeDocument,
    KnowledgeDocumentType,
)
from app.domain.ports.knowledge_chunk_repository import KnowledgeChunkRepository
from app.domain.ports.knowledge_document_repository import KnowledgeDocumentRepository

MIN_CHUNK_SIZE = 500
MAX_CHUNK_SIZE = 1000


@dataclass(slots=True)
class KnowledgeSearchResult:
    query: str
    chunks: list[KnowledgeChunk]
    documents: list[KnowledgeDocument]
    scores: list[float]


class KnowledgeService:
    def __init__(
        self,
        document_repository: KnowledgeDocumentRepository,
        chunk_repository: KnowledgeChunkRepository,
    ) -> None:
        self._documents = document_repository
        self._chunks = chunk_repository

    async def create_document(
        self,
        *,
        tenant_id: str,
        title: str,
        content: str,
        document_type: KnowledgeDocumentType = KnowledgeDocumentType.other,
        tags: list[str] | None = None,
        enabled: bool = True,
    ) -> KnowledgeDocument:
        now = datetime.now(timezone.utc)
        document = KnowledgeDocument(
            id=str(uuid4()),
            tenant_id=tenant_id,
            title=title.strip(),
            content=content.strip(),
            document_type=document_type,
            tags=tags or [],
            enabled=enabled,
            created_at=now,
            updated_at=now,
        )
        document = await self._documents.create(document)
        await self.chunk_document(document)
        return document

    async def update_document(
        self,
        *,
        tenant_id: str,
        document_id: str,
        title: str,
        content: str,
        document_type: KnowledgeDocumentType,
        tags: list[str],
        enabled: bool,
    ) -> KnowledgeDocument:
        existing = await self._documents.get_by_id(tenant_id, document_id)
        if existing is None:
            raise ValueError("Knowledge document not found")

        document = existing.model_copy(
            update={
                "title": title.strip(),
                "content": content.strip(),
                "document_type": document_type,
                "tags": tags,
                "enabled": enabled,
                "updated_at": datetime.now(timezone.utc),
            }
        )
        document = await self._documents.update(document)
        await self.chunk_document(document)
        return document

    async def delete_document(self, *, tenant_id: str, document_id: str) -> None:
        existing = await self._documents.get_by_id(tenant_id, document_id)
        if existing is None:
            raise ValueError("Knowledge document not found")
        await self._chunks.delete_by_document(tenant_id, document_id)
        await self._documents.delete(tenant_id, document_id)

    async def get_document(self, tenant_id: str, document_id: str) -> KnowledgeDocument | None:
        return await self._documents.get_by_id(tenant_id, document_id)

    async def list_documents(self, tenant_id: str) -> list[KnowledgeDocument]:
        return await self._documents.list_by_tenant(tenant_id)

    async def chunk_document(self, document: KnowledgeDocument) -> list[KnowledgeChunk]:
        pieces = split_into_chunks(document.content)
        chunks: list[KnowledgeChunk] = []
        for index, piece in enumerate(pieces):
            chunks.append(
                KnowledgeChunk(
                    id=str(uuid4()),
                    tenant_id=document.tenant_id,
                    document_id=document.id,
                    content=piece,
                    chunk_index=index,
                    embedding=None,
                    metadata={
                        "document_title": document.title,
                        "document_type": document.document_type.value,
                        "tags": document.tags,
                    },
                    created_at=datetime.now(timezone.utc),
                )
            )
        return await self._chunks.replace_for_document(
            document.tenant_id,
            document.id,
            chunks,
        )

    async def search_relevant_knowledge(
        self,
        *,
        tenant_id: str,
        query: str,
        limit: int = 5,
    ) -> KnowledgeSearchResult:
        hits = await self._chunks.search_by_keywords(
            tenant_id=tenant_id,
            query=query,
            limit=limit,
        )
        chunks = [chunk for chunk, _score in hits]
        scores = [score for _chunk, score in hits]

        documents_by_id: dict[str, KnowledgeDocument] = {}
        for chunk in chunks:
            if chunk.document_id in documents_by_id:
                continue
            document = await self._documents.get_by_id(tenant_id, chunk.document_id)
            if document is not None:
                documents_by_id[chunk.document_id] = document

        return KnowledgeSearchResult(
            query=query,
            chunks=chunks,
            documents=list(documents_by_id.values()),
            scores=scores,
        )

    def to_context_chunks(self, result: KnowledgeSearchResult) -> list[KnowledgeContextChunk]:
        context_chunks: list[KnowledgeContextChunk] = []
        for chunk in result.chunks:
            metadata = chunk.metadata or {}
            context_chunks.append(
                KnowledgeContextChunk(
                    document_id=chunk.document_id,
                    document_title=str(metadata.get("document_title", "")),
                    document_type=str(metadata.get("document_type", "other")),
                    chunk_index=chunk.chunk_index,
                    content=chunk.content,
                )
            )
        return context_chunks


def split_into_chunks(
    content: str,
    *,
    min_size: int = MIN_CHUNK_SIZE,
    max_size: int = MAX_CHUNK_SIZE,
) -> list[str]:
    text = content.strip()
    if not text:
        return []
    if len(text) <= max_size:
        return [text]

    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", text) if part.strip()]
    if not paragraphs:
        paragraphs = [text]

    chunks: list[str] = []
    current = ""

    def flush() -> None:
        nonlocal current
        if current.strip():
            chunks.append(current.strip())
        current = ""

    for paragraph in paragraphs:
        if len(paragraph) > max_size:
            if current:
                flush()
            chunks.extend(_split_long_paragraph(paragraph, max_size=max_size))
            continue

        candidate = f"{current}\n\n{paragraph}".strip() if current else paragraph
        if len(candidate) <= max_size:
            current = candidate
            continue

        if current:
            flush()
        current = paragraph

    if current:
        flush()

    return _merge_small_chunks(chunks, min_size=min_size, max_size=max_size)


def _split_long_paragraph(paragraph: str, *, max_size: int) -> list[str]:
    sentences = re.split(r"(?<=[.!?])\s+", paragraph)
    parts: list[str] = []
    current = ""
    for sentence in sentences:
        candidate = f"{current} {sentence}".strip() if current else sentence
        if len(candidate) <= max_size:
            current = candidate
            continue
        if current:
            parts.append(current)
        current = sentence
    if current:
        parts.append(current)
    return parts


def _merge_small_chunks(chunks: list[str], *, min_size: int, max_size: int) -> list[str]:
    if not chunks:
        return []

    merged: list[str] = []
    buffer = chunks[0]
    for chunk in chunks[1:]:
        if len(buffer) < min_size and len(buffer) + len(chunk) + 2 <= max_size:
            buffer = f"{buffer}\n\n{chunk}"
            continue
        merged.append(buffer)
        buffer = chunk
    merged.append(buffer)
    return merged
