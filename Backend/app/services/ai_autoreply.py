"""AI auto-reply helpers.

Factual answers are sourced from Knowledge Base search results, not AI Settings.
AI Settings supply behavior only: business identity, tone, and approval rules.
"""

import logging
import re
from typing import TYPE_CHECKING

from app.domain.models.ai import (
    AIAutoReplyContext,
    AIAutoReplyDecision,
    RiskLevel,
    SuggestedActionType,
)
from app.domain.models.bot import BotAction, BotDecision, BotIntent
from app.domain.models.conversation import Conversation, SenderType
from app.domain.models.customer_profile import CustomerProfile
from app.domain.models.knowledge import KnowledgeContextChunk
from app.domain.ports.ai_provider import AIProvider
from app.services.bot_orchestrator import AUTO_REPLY_INTENTS, should_route_to_approval

if TYPE_CHECKING:
    from app.services.knowledge import KnowledgeService

logger = logging.getLogger(__name__)

SENSITIVE_ACTION_TYPES = {
    SuggestedActionType.price_offer,
    SuggestedActionType.discount,
    SuggestedActionType.refund,
    SuggestedActionType.custom_offer,
}

HANDOFF_RESPONSE_PATTERNS = (
    r"human agent",
    r"transfer(?:ring)?(?:\s+\w+){0,4}\s+(?:to|this)",
    r"connect(?:ing)?\s+you\s+(?:with|to)",
    r"wait(?:ing)?\s+for\s+(?:a\s+)?(?:human|agent|approval)",
    r"hand(?:off| over)",
    r"נציג\s+אנושי",
    r"מעביר(?:\s+את)?",
    r"העבר(?:ה|תי)\s+(?:ל|את)",
    r"לבדיקה\s+של\s+נציג",
    r"אמתין\s+(?:ל|עם)",
    r"נחזור\s+אליך",
    r"representative",
    r"escalat",
)

_HANDOFF_PATTERN = re.compile("|".join(HANDOFF_RESPONSE_PATTERNS), re.IGNORECASE)


def enforce_approval_rules(decision: AIAutoReplyDecision) -> AIAutoReplyDecision:
    requires_approval = decision.requires_approval
    risk_level = decision.risk_level

    if decision.suggested_action_type in SENSITIVE_ACTION_TYPES:
        requires_approval = True
        if risk_level == RiskLevel.low:
            risk_level = RiskLevel.medium

    if decision.suggested_action_type == SuggestedActionType.other and risk_level != RiskLevel.low:
        requires_approval = True

    if risk_level in {RiskLevel.medium, RiskLevel.high}:
        requires_approval = True

    if requires_approval is False and risk_level != RiskLevel.low:
        requires_approval = True

    return decision.model_copy(
        update={
            "requires_approval": requires_approval,
            "risk_level": risk_level,
        }
    )


def should_auto_send(decision: AIAutoReplyDecision) -> bool:
    decision = enforce_approval_rules(decision)
    return not decision.requires_approval and decision.risk_level == RiskLevel.low


def looks_like_handoff_response(text: str) -> bool:
    normalized = text.strip()
    if not normalized:
        return False
    return _HANDOFF_PATTERN.search(normalized) is not None


def format_customer_profile(profile: CustomerProfile | None, customer_id: str) -> str:
    if profile is None:
        return f"external_id={customer_id}"
    parts = [f"external_id={profile.external_id}"]
    if profile.display_name:
        parts.append(f"display_name={profile.display_name}")
    if profile.username:
        parts.append(f"username={profile.username}")
    return ", ".join(parts)


def build_search_query(conversation: Conversation) -> str:
    customer_parts: list[str] = []
    for message in conversation.messages[-8:]:
        if message.sender_type == SenderType.customer:
            customer_parts.append(message.content.strip())

    if customer_parts:
        return " ".join(customer_parts)

    if conversation.messages:
        return conversation.messages[-1].content.strip()
    return ""


def build_auto_reply_context(
    *,
    settings_row,
    conversation: Conversation,
    conversation_notes: str,
    customer_profile: CustomerProfile | None,
    relevant_knowledge: list[KnowledgeContextChunk] | None = None,
    retry_after_handoff_correction: bool = False,
    bot_decision: BotDecision | None = None,
) -> AIAutoReplyContext:
    return AIAutoReplyContext(
        tenant_id=conversation.tenant_id,
        channel=conversation.channel,
        customer_id=conversation.customer_id,
        business_context=settings_row.business_context,
        approval_rules=settings_row.approval_rules,
        tone_instructions=settings_row.tone_instructions,
        conversation_notes=conversation_notes,
        customer_profile_text=format_customer_profile(
            customer_profile,
            conversation.customer_id,
        ),
        conversation=conversation,
        retry_after_handoff_correction=retry_after_handoff_correction,
        relevant_knowledge=relevant_knowledge or [],
        bot_intent=bot_decision.intent if bot_decision else None,
        bot_action=bot_decision.action if bot_decision else None,
        bot_reason_summary=bot_decision.reason_summary if bot_decision else "",
    )


async def load_relevant_knowledge_for_conversation(
    knowledge_service: "KnowledgeService",
    conversation: Conversation,
) -> list[KnowledgeContextChunk]:
    query = build_search_query(conversation)
    if not query.strip():
        return []

    result = await knowledge_service.search_relevant_knowledge(
        tenant_id=conversation.tenant_id,
        query=query,
        limit=5,
    )
    return knowledge_service.to_context_chunks(result)


def merge_bot_with_ai_decision(
    bot_decision: BotDecision,
    ai_decision: AIAutoReplyDecision,
) -> AIAutoReplyDecision:
    if should_route_to_approval(bot_decision):
        suggested_type = ai_decision.suggested_action_type
        risk_level = ai_decision.risk_level
        if bot_decision.intent == BotIntent.refund_request:
            suggested_type = SuggestedActionType.refund
            risk_level = RiskLevel.medium
        elif bot_decision.intent == BotIntent.discount_request:
            suggested_type = SuggestedActionType.discount
            risk_level = RiskLevel.medium
        elif bot_decision.intent == BotIntent.price_question:
            suggested_type = SuggestedActionType.price_offer
            risk_level = RiskLevel.medium

        return ai_decision.model_copy(
            update={
                "requires_approval": True,
                "suggested_action_type": suggested_type,
                "risk_level": risk_level,
            }
        )

    if bot_decision.action == BotAction.ask_clarification:
        return ai_decision.model_copy(
            update={
                "requires_approval": False,
                "risk_level": RiskLevel.low,
                "suggested_action_type": SuggestedActionType.normal_reply,
            }
        )

    if bot_decision.action == BotAction.continue_flow:
        return ai_decision.model_copy(
            update={
                "requires_approval": False,
                "risk_level": RiskLevel.low,
                "suggested_action_type": SuggestedActionType.normal_reply,
            }
        )

    if bot_decision.intent in AUTO_REPLY_INTENTS and bot_decision.action in {
        BotAction.answer_with_ai,
        BotAction.answer_from_knowledge,
    }:
        return ai_decision.model_copy(
            update={
                "requires_approval": False,
                "risk_level": RiskLevel.low,
                "suggested_action_type": SuggestedActionType.normal_reply,
            }
        )

    return ai_decision


async def generate_ai_decision(
    *,
    ai_provider: AIProvider,
    settings_row,
    conversation: Conversation,
    conversation_notes: str,
    customer_profile: CustomerProfile | None,
    bot_decision: BotDecision | None = None,
    relevant_knowledge: list[KnowledgeContextChunk] | None = None,
    knowledge_service: "KnowledgeService | None" = None,
) -> AIAutoReplyDecision | None:
    if relevant_knowledge is None:
        if knowledge_service is not None:
            relevant_knowledge = await load_relevant_knowledge_for_conversation(
                knowledge_service,
                conversation,
            )
        else:
            relevant_knowledge = []

    context = build_auto_reply_context(
        settings_row=settings_row,
        conversation=conversation,
        conversation_notes=conversation_notes,
        customer_profile=customer_profile,
        relevant_knowledge=relevant_knowledge,
        bot_decision=bot_decision,
    )

    decision = await ai_provider.generate_auto_reply_decision(context)
    if decision is None:
        return None

    if bot_decision is not None:
        decision = merge_bot_with_ai_decision(bot_decision, decision)

    decision = enforce_approval_rules(decision)

    if decision.requires_approval and looks_like_handoff_response(decision.suggested_response):
        logger.warning(
            "[ai] suggested_response looked like a handoff notice; retrying with correction"
        )
        retry_context = build_auto_reply_context(
            settings_row=settings_row,
            conversation=conversation,
            conversation_notes=conversation_notes,
            customer_profile=customer_profile,
            relevant_knowledge=relevant_knowledge,
            bot_decision=bot_decision,
            retry_after_handoff_correction=True,
        )
        decision = await ai_provider.generate_auto_reply_decision(retry_context)
        if decision is None:
            return None
        if bot_decision is not None:
            decision = merge_bot_with_ai_decision(bot_decision, decision)
        decision = enforce_approval_rules(decision)

    return decision
