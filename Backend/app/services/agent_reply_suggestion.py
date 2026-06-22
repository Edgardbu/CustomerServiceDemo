from fastapi import HTTPException

from app.core.container import AppContainer
from app.domain.models.ai import (
    AgentReplySuggestion,
    AgentReplySuggestionContext,
    UsedKnowledgeReference,
)
from app.domain.models.user import User, UserRole
from app.services.ai_autoreply import load_relevant_knowledge_for_conversation


def _knowledge_references_from_chunks(chunks) -> list[UsedKnowledgeReference]:
    return [
        UsedKnowledgeReference(
            document_id=chunk.document_id,
            title=chunk.document_title,
            chunk=chunk.content,
        )
        for chunk in chunks
    ]


async def build_agent_reply_suggestion_context(
    *,
    container: AppContainer,
    tenant_id: str,
    conversation_id: str,
    extra_instruction: str | None = None,
) -> AgentReplySuggestionContext:
    conversation = await container.conversation_repository.get_conversation(
        tenant_id=tenant_id,
        conversation_id=conversation_id,
    )
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    settings = await container.ai_settings_repository.get_by_tenant(tenant_id)
    notes_row = await container.conversation_ai_notes_repository.get_by_conversation(
        tenant_id=tenant_id,
        conversation_id=conversation_id,
    )
    customer_profile = await container.customer_profile_repository.get_by_external_id(
        tenant_id=tenant_id,
        channel=conversation.channel,
        external_id=conversation.customer_id,
    )
    knowledge_chunks = await load_relevant_knowledge_for_conversation(
        container.knowledge_service,
        conversation,
    )

    return AgentReplySuggestionContext(
        tenant_id=tenant_id,
        conversation=conversation,
        customer_profile=customer_profile,
        recent_messages=conversation.messages[-20:],
        ai_notes=notes_row.notes if notes_row else "",
        knowledge_chunks=knowledge_chunks,
        business_context=settings.business_context if settings else "",
        tone_instructions=settings.tone_instructions if settings else "",
        approval_rules=settings.approval_rules if settings else "",
        extra_instruction=extra_instruction.strip() if extra_instruction else None,
    )


async def generate_agent_reply_suggestion(
    *,
    container: AppContainer,
    tenant_id: str,
    conversation_id: str,
    extra_instruction: str | None = None,
) -> AgentReplySuggestion:
    context = await build_agent_reply_suggestion_context(
        container=container,
        tenant_id=tenant_id,
        conversation_id=conversation_id,
        extra_instruction=extra_instruction,
    )

    suggestion = await container.ai.generate_agent_reply_suggestion(context)
    if suggestion is None:
        raise HTTPException(
            status_code=502,
            detail="Failed to generate agent reply suggestion",
        )

    if not suggestion.used_knowledge and context.knowledge_chunks:
        suggestion = suggestion.model_copy(
            update={
                "used_knowledge": _knowledge_references_from_chunks(
                    context.knowledge_chunks
                ),
            }
        )

    return suggestion


def assert_can_suggest_reply(current_user: User) -> None:
    if current_user.role == UserRole.viewer:
        raise HTTPException(
            status_code=403,
            detail="Viewers cannot request AI reply suggestions",
        )
    if current_user.role not in {UserRole.owner, UserRole.admin, UserRole.agent}:
        raise HTTPException(
            status_code=403,
            detail="Not allowed to request AI reply suggestions",
        )
