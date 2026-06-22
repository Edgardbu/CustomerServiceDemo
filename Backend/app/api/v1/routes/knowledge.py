from fastapi import APIRouter, Depends, HTTPException, Response

from app.api.dependencies import get_container
from app.core.container import AppContainer
from app.domain.models.knowledge import KnowledgeChunk
from app.schemas.knowledge import (
    KnowledgeChunkRead,
    KnowledgeDocumentCreate,
    KnowledgeDocumentRead,
    KnowledgeDocumentUpdate,
    KnowledgeSearchRequest,
    KnowledgeSearchResponse,
)

router = APIRouter()


@router.get("/documents", response_model=list[KnowledgeDocumentRead])
async def list_knowledge_documents(
    tenant_id: str,
    container: AppContainer = Depends(get_container),
):
    documents = await container.knowledge_service.list_documents(tenant_id)
    return [KnowledgeDocumentRead.from_domain(document) for document in documents]


@router.post("/documents", response_model=KnowledgeDocumentRead, status_code=201)
async def create_knowledge_document(
    payload: KnowledgeDocumentCreate,
    container: AppContainer = Depends(get_container),
):
    document = await container.knowledge_service.create_document(
        tenant_id=payload.tenant_id,
        title=payload.title,
        content=payload.content,
        document_type=payload.document_type,
        tags=payload.tags,
        enabled=payload.enabled,
    )
    return KnowledgeDocumentRead.from_domain(document)


@router.get("/documents/{document_id}", response_model=KnowledgeDocumentRead)
async def get_knowledge_document(
    document_id: str,
    tenant_id: str,
    container: AppContainer = Depends(get_container),
):
    document = await container.knowledge_service.get_document(tenant_id, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Knowledge document not found")
    return KnowledgeDocumentRead.from_domain(document)


@router.put("/documents/{document_id}", response_model=KnowledgeDocumentRead)
async def update_knowledge_document(
    document_id: str,
    payload: KnowledgeDocumentUpdate,
    container: AppContainer = Depends(get_container),
):
    try:
        document = await container.knowledge_service.update_document(
            tenant_id=payload.tenant_id,
            document_id=document_id,
            title=payload.title,
            content=payload.content,
            document_type=payload.document_type,
            tags=payload.tags,
            enabled=payload.enabled,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return KnowledgeDocumentRead.from_domain(document)


@router.delete("/documents/{document_id}", status_code=204)
async def delete_knowledge_document(
    document_id: str,
    tenant_id: str,
    container: AppContainer = Depends(get_container),
):
    try:
        await container.knowledge_service.delete_document(
            tenant_id=tenant_id,
            document_id=document_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(status_code=204)


@router.post("/search", response_model=KnowledgeSearchResponse)
async def search_knowledge(
    payload: KnowledgeSearchRequest,
    container: AppContainer = Depends(get_container),
):
    result = await container.knowledge_service.search_relevant_knowledge(
        tenant_id=payload.tenant_id,
        query=payload.query,
        limit=payload.limit,
    )

    chunk_reads: list[KnowledgeChunkRead] = []
    for chunk, score in zip(result.chunks, result.scores, strict=False):
        chunk_reads.append(_chunk_to_read(chunk, score))

    return KnowledgeSearchResponse(
        query=result.query,
        chunks=chunk_reads,
        documents=[KnowledgeDocumentRead.from_domain(doc) for doc in result.documents],
    )


def _chunk_to_read(chunk: KnowledgeChunk, score: float | None = None) -> KnowledgeChunkRead:
    return KnowledgeChunkRead(
        id=chunk.id,
        tenant_id=chunk.tenant_id,
        document_id=chunk.document_id,
        content=chunk.content,
        chunk_index=chunk.chunk_index,
        embedding=chunk.embedding,
        metadata=chunk.metadata,
        created_at=chunk.created_at,
        score=score,
    )
