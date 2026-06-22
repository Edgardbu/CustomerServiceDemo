"""Bot intent routing and orchestration.

Uses AI Settings for business identity and approval rules.
Uses Knowledge Base search results for factual context — not AI Settings FAQ fields.
"""

import logging
import re

from app.domain.models.bot import (
    BotAction,
    BotDecision,
    BotIntent,
    BotOrchestrationContext,
)
from app.domain.models.conversation import Conversation, SenderType
from app.domain.models.customer_profile import CustomerProfile
from app.domain.models.knowledge import KnowledgeContextChunk
from app.domain.ports.ai_provider import AIProvider

logger = logging.getLogger(__name__)

HANDOFF_TO_HUMAN_TAG = "handoff_to_human"

AUTO_REPLY_INTENTS = {
    BotIntent.faq_question,
    BotIntent.menu_question,
    BotIntent.delivery_question,
    BotIntent.payment_question,
}

ORDER_INTENTS = {
    BotIntent.order_start,
    BotIntent.order_update,
}

OUTSIDE_DELIVERY_PATTERNS = (
    r"outside",
    r"לא מגיעים",
    r"לא משלמים",
    r"מחוץ לאזור",
    r"לא באזור",
)


class BotOrchestrator:
    def __init__(self, ai_provider: AIProvider) -> None:
        self._ai = ai_provider

    async def decide(self, context: BotOrchestrationContext) -> BotDecision:
        classified = await self._ai.classify_intent(context)
        if classified is None:
            classified = _fallback_decision(context)
        return apply_business_rules(classified, context)


def _format_customer_profile(profile: CustomerProfile | None, customer_id: str) -> str:
    if profile is None:
        return f"external_id={customer_id}"
    parts = [f"external_id={profile.external_id}"]
    if profile.display_name:
        parts.append(f"display_name={profile.display_name}")
    if profile.username:
        parts.append(f"username={profile.username}")
    return ", ".join(parts)


def build_orchestration_context(
    *,
    settings_row,
    conversation: Conversation,
    conversation_notes: str,
    customer_profile: CustomerProfile | None,
    relevant_knowledge: list[KnowledgeContextChunk],
) -> BotOrchestrationContext:
    return BotOrchestrationContext(
        tenant_id=conversation.tenant_id,
        channel=conversation.channel,
        business_context=settings_row.business_context,
        approval_rules=settings_row.approval_rules,
        conversation_notes=conversation_notes,
        customer_profile_text=_format_customer_profile(
            customer_profile,
            conversation.customer_id,
        ),
        conversation=conversation,
        relevant_knowledge=relevant_knowledge,
        latest_customer_message=_latest_customer_message(conversation),
        delivery_outside_allowed_area=detect_delivery_outside_allowed_area(
            conversation=conversation,
            business_context=settings_row.business_context,
            conversation_notes=conversation_notes,
        ),
    )


def apply_business_rules(
    decision: BotDecision,
    context: BotOrchestrationContext,
) -> BotDecision:
    intent = decision.intent
    action = _default_action_for_intent(intent, context)
    needs_approval = decision.needs_approval
    should_handoff = decision.should_handoff
    reason = decision.reason_summary

    if intent == BotIntent.refund_request:
        action = BotAction.require_approval
        needs_approval = True
        should_handoff = False
        reason = "Refund requests always require agent approval."
    elif intent == BotIntent.discount_request:
        action = BotAction.require_approval
        needs_approval = True
        should_handoff = False
        reason = "Discount requests always require agent approval."
    elif intent == BotIntent.complaint:
        action = BotAction.handoff_to_human
        should_handoff = True
        needs_approval = False
        reason = "Complaints are escalated to a human agent."
    elif intent == BotIntent.human_request:
        action = BotAction.handoff_to_human
        should_handoff = True
        needs_approval = False
        reason = "Customer explicitly requested a human agent."
    elif context.delivery_outside_allowed_area and intent == BotIntent.delivery_question:
        action = BotAction.require_approval
        needs_approval = True
        should_handoff = False
        reason = "Delivery question appears to be outside the allowed service area."

    if action == BotAction.handoff_to_human:
        should_handoff = True
    if action == BotAction.require_approval:
        needs_approval = True

    if intent in AUTO_REPLY_INTENTS and action in {
        BotAction.answer_with_ai,
        BotAction.answer_from_knowledge,
    }:
        needs_approval = False
        should_handoff = False

    if intent in ORDER_INTENTS and action == BotAction.continue_flow:
        needs_approval = False
        should_handoff = False

    if intent == BotIntent.unknown:
        action = BotAction.ask_clarification
        needs_approval = False
        should_handoff = False

    return decision.model_copy(
        update={
            "action": action,
            "needs_approval": needs_approval,
            "should_handoff": should_handoff,
            "reason_summary": reason,
        }
    )


def _default_action_for_intent(
    intent: BotIntent,
    context: BotOrchestrationContext,
) -> BotAction:
    has_knowledge = bool(context.relevant_knowledge)

    if intent in AUTO_REPLY_INTENTS:
        return (
            BotAction.answer_from_knowledge
            if has_knowledge
            else BotAction.answer_with_ai
        )

    if intent in ORDER_INTENTS:
        return BotAction.continue_flow

    if intent == BotIntent.price_question:
        return (
            BotAction.answer_from_knowledge
            if has_knowledge
            else BotAction.require_approval
        )

    if intent == BotIntent.refund_request:
        return BotAction.require_approval

    if intent == BotIntent.discount_request:
        return BotAction.require_approval

    if intent in {BotIntent.complaint, BotIntent.human_request}:
        return BotAction.handoff_to_human

    if intent == BotIntent.unknown:
        return BotAction.ask_clarification

    return BotAction.answer_with_ai


def _fallback_decision(context: BotOrchestrationContext) -> BotDecision:
    return BotDecision(
        intent=BotIntent.unknown,
        action=BotAction.ask_clarification,
        confidence=0.0,
        reason_summary="Intent classification unavailable; asking for clarification.",
        needs_approval=False,
        should_handoff=False,
    )


def _latest_customer_message(conversation: Conversation) -> str:
    for message in reversed(conversation.messages):
        if message.sender_type == SenderType.customer:
            return message.content.strip()
    if conversation.messages:
        return conversation.messages[-1].content.strip()
    return ""


def detect_delivery_outside_allowed_area(
    *,
    conversation: Conversation,
    business_context: str,
    conversation_notes: str,
) -> bool:
    latest = _latest_customer_message(conversation).lower()
    combined = f"{business_context}\n{conversation_notes}".lower()
    if not latest:
        return False

    for pattern in OUTSIDE_DELIVERY_PATTERNS:
        if re.search(pattern, latest, re.IGNORECASE):
            return True

    if "allowed delivery" in combined or "אזורי משלוח" in combined:
        if any(token in latest for token in ("far", "רחוק", "מחוץ", "outside")):
            return True

    return False


def should_route_to_approval(bot_decision: BotDecision) -> bool:
    return (
        bot_decision.action == BotAction.require_approval
        or bot_decision.needs_approval
    )


def should_handoff_without_approval(bot_decision: BotDecision) -> bool:
    return bot_decision.action == BotAction.handoff_to_human or bot_decision.should_handoff


def should_auto_reply_from_bot(bot_decision: BotDecision) -> bool:
    return bot_decision.action in {
        BotAction.answer_with_ai,
        BotAction.answer_from_knowledge,
        BotAction.continue_flow,
        BotAction.ask_clarification,
    }
