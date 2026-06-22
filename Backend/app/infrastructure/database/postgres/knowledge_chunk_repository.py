import re
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.domain.models.knowledge import KnowledgeChunk
from app.infrastructure.database.postgres.models import (
    KnowledgeChunkModel,
    KnowledgeDocumentModel,
)


def _to_domain(model: KnowledgeChunkModel) -> KnowledgeChunk:
    return KnowledgeChunk(
        id=model.id,
        tenant_id=model.tenant_id,
        document_id=model.document_id,
        content=model.content,
        chunk_index=model.chunk_index,
        embedding=list(model.embedding) if model.embedding else None,
        metadata=dict(model.chunk_metadata) if model.chunk_metadata else None,
        created_at=model.created_at,
    )


def _tokenize_query(query: str) -> list[str]:
    return [token for token in re.findall(r"\w+", query.lower()) if len(token) > 1]


def _score_text(text: str, terms: list[str]) -> float:
    if not terms:
        return 0.0
    lowered = text.lower()
    return float(sum(lowered.count(term) for term in terms))


class PostgresKnowledgeChunkRepository:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def replace_for_document(
        self,
        tenant_id: str,
        document_id: str,
        chunks: list[KnowledgeChunk],
    ) -> list[KnowledgeChunk]:
        async with self._session_factory() as session:
            await session.execute(
                delete(KnowledgeChunkModel).where(
                    KnowledgeChunkModel.tenant_id == tenant_id,
                    KnowledgeChunkModel.document_id == document_id,
                )
            )

            models: list[KnowledgeChunkModel] = []
            for chunk in chunks:
                model = KnowledgeChunkModel(
                    id=chunk.id,
                    tenant_id=tenant_id,
                    document_id=document_id,
                    content=chunk.content,
                    chunk_index=chunk.chunk_index,
                    embedding=chunk.embedding,
                    chunk_metadata=chunk.metadata,
                    created_at=chunk.created_at,
                )
                session.add(model)
                models.append(model)

            await session.commit()
            for model in models:
                await session.refresh(model)
            return [_to_domain(model) for model in models]

    async def delete_by_document(self, tenant_id: str, document_id: str) -> None:
        async with self._session_factory() as session:
            await session.execute(
                delete(KnowledgeChunkModel).where(
                    KnowledgeChunkModel.tenant_id == tenant_id,
                    KnowledgeChunkModel.document_id == document_id,
                )
            )
            await session.commit()

    async def list_by_document(
        self,
        tenant_id: str,
        document_id: str,
    ) -> list[KnowledgeChunk]:
        async with self._session_factory() as session:
            stmt = (
                select(KnowledgeChunkModel)
                .where(
                    KnowledgeChunkModel.tenant_id == tenant_id,
                    KnowledgeChunkModel.document_id == document_id,
                )
                .order_by(KnowledgeChunkModel.chunk_index.asc())
            )
            result = await session.execute(stmt)
            return [_to_domain(model) for model in result.scalars().all()]

    async def search_by_keywords(
        self,
        tenant_id: str,
        query: str,
        *,
        limit: int = 5,
    ) -> list[tuple[KnowledgeChunk, float]]:
        terms = _tokenize_query(query)
        if not terms:
            return []

        async with self._session_factory() as session:
            stmt = (
                select(KnowledgeChunkModel, KnowledgeDocumentModel)
                .join(
                    KnowledgeDocumentModel,
                    KnowledgeChunkModel.document_id == KnowledgeDocumentModel.id,
                )
                .where(
                    KnowledgeChunkModel.tenant_id == tenant_id,
                    KnowledgeDocumentModel.enabled.is_(True),
                )
            )
            result = await session.execute(stmt)
            rows = result.all()

        scored: list[tuple[KnowledgeChunk, float]] = []
        for chunk_model, doc_model in rows:
            chunk = _to_domain(chunk_model)
            text = " ".join(
                [
                    doc_model.title,
                    " ".join(doc_model.tags or []),
                    chunk_model.content,
                ]
            )
            score = _score_text(text, terms)
            if score > 0:
                scored.append((chunk, score))

        scored.sort(key=lambda item: item[1], reverse=True)
        return scored[:limit]
