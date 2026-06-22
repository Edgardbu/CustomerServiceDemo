from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.domain.models.knowledge import KnowledgeDocument, KnowledgeDocumentType
from app.infrastructure.database.postgres.models import KnowledgeDocumentModel


def _to_domain(model: KnowledgeDocumentModel) -> KnowledgeDocument:
    return KnowledgeDocument(
        id=model.id,
        tenant_id=model.tenant_id,
        title=model.title,
        content=model.content,
        document_type=KnowledgeDocumentType(model.document_type),
        tags=list(model.tags or []),
        enabled=model.enabled,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


class PostgresKnowledgeDocumentRepository:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def create(self, document: KnowledgeDocument) -> KnowledgeDocument:
        async with self._session_factory() as session:
            model = KnowledgeDocumentModel(
                id=document.id,
                tenant_id=document.tenant_id,
                title=document.title,
                content=document.content,
                document_type=document.document_type.value,
                tags=document.tags,
                enabled=document.enabled,
                created_at=document.created_at,
                updated_at=document.updated_at,
            )
            session.add(model)
            await session.commit()
            await session.refresh(model)
            return _to_domain(model)

    async def get_by_id(self, tenant_id: str, document_id: str) -> KnowledgeDocument | None:
        async with self._session_factory() as session:
            stmt = select(KnowledgeDocumentModel).where(
                KnowledgeDocumentModel.tenant_id == tenant_id,
                KnowledgeDocumentModel.id == document_id,
            )
            result = await session.execute(stmt)
            model = result.scalar_one_or_none()
            if model is None:
                return None
            return _to_domain(model)

    async def list_by_tenant(self, tenant_id: str) -> list[KnowledgeDocument]:
        async with self._session_factory() as session:
            stmt = (
                select(KnowledgeDocumentModel)
                .where(KnowledgeDocumentModel.tenant_id == tenant_id)
                .order_by(KnowledgeDocumentModel.updated_at.desc())
            )
            result = await session.execute(stmt)
            return [_to_domain(model) for model in result.scalars().all()]

    async def update(self, document: KnowledgeDocument) -> KnowledgeDocument:
        now = datetime.now(timezone.utc)
        async with self._session_factory() as session:
            stmt = select(KnowledgeDocumentModel).where(
                KnowledgeDocumentModel.tenant_id == document.tenant_id,
                KnowledgeDocumentModel.id == document.id,
            )
            result = await session.execute(stmt)
            model = result.scalar_one_or_none()
            if model is None:
                raise ValueError("Knowledge document not found")

            model.title = document.title
            model.content = document.content
            model.document_type = document.document_type.value
            model.tags = document.tags
            model.enabled = document.enabled
            model.updated_at = now

            await session.commit()
            await session.refresh(model)
            return _to_domain(model)

    async def delete(self, tenant_id: str, document_id: str) -> None:
        async with self._session_factory() as session:
            stmt = delete(KnowledgeDocumentModel).where(
                KnowledgeDocumentModel.tenant_id == tenant_id,
                KnowledgeDocumentModel.id == document_id,
            )
            await session.execute(stmt)
            await session.commit()
