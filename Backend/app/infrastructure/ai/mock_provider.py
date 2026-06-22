import re

from app.domain.models.ai import (
    AIAutoReplyContext,
    AIAutoReplyDecision,
    AgentReplySuggestion,
    AgentReplySuggestionContext,
    RiskLevel,
    SuggestedActionType,
    UsedKnowledgeReference,
)
from app.domain.models.bot import (
    BotAction,
    BotDecision,
    BotIntent,
    BotOrchestrationContext,
)
from app.domain.models.bot_flow import FlowInputExtractionContext, FlowInputExtractionResult
from app.domain.models.conversation import SenderType
from app.services.flow_input_extraction import heuristic_extract_flow_input
from app.services.bot_orchestrator import AUTO_REPLY_INTENTS

_INTENT_PATTERNS: list[tuple[BotIntent, re.Pattern[str]]] = [
  (BotIntent.refund_request, re.compile(r"refund|החזר|זיכוי", re.I)),
  (BotIntent.discount_request, re.compile(r"discount|הנחה|מבצע", re.I)),
  (BotIntent.complaint, re.compile(r"complaint|angry|not satisfied|לא מרוצה|תלונה|גרוע", re.I)),
  (BotIntent.human_request, re.compile(r"human|agent|נציג|בן אדם|אדם", re.I)),
  (BotIntent.menu_question, re.compile(r"menu|תפריט|מגש|פירות|מה יש", re.I)),
  (BotIntent.delivery_question, re.compile(r"delivery|משלוח|שליח|הגעה", re.I)),
  (BotIntent.payment_question, re.compile(r"payment|pay|תשלום|אשראי|bit", re.I)),
  (BotIntent.price_question, re.compile(r"price|cost|מחיר|כמה עולה|עלות", re.I)),
  (BotIntent.order_update, re.compile(r"update order|change order|לשנות הזמנה|עדכון הזמנה", re.I)),
  (BotIntent.order_start, re.compile(r"order|להזמין|הזמנה|רוצה לקנות", re.I)),
  (BotIntent.faq_question, re.compile(r"hours|שעות|איפה|where|when|פתוח", re.I)),
]


def _classify_by_keywords(message: str) -> BotIntent:
    for intent, pattern in _INTENT_PATTERNS:
        if pattern.search(message):
            return intent
    return BotIntent.unknown


class MockAIProvider:
    async def classify_intent(
        self,
        context: BotOrchestrationContext,
    ) -> BotDecision | None:
        message = context.latest_customer_message or ""
        intent = _classify_by_keywords(message)
        has_knowledge = bool(context.relevant_knowledge)

        if intent == BotIntent.refund_request:
            return BotDecision(
                intent=intent,
                action=BotAction.require_approval,
                confidence=0.9,
                reason_summary="Mock: refund keyword detected.",
                needs_approval=True,
            )
        if intent == BotIntent.discount_request:
            return BotDecision(
                intent=intent,
                action=BotAction.require_approval,
                confidence=0.9,
                reason_summary="Mock: discount keyword detected.",
                needs_approval=True,
            )
        if intent == BotIntent.complaint:
            return BotDecision(
                intent=intent,
                action=BotAction.handoff_to_human,
                confidence=0.9,
                reason_summary="Mock: complaint keyword detected.",
                should_handoff=True,
            )
        if intent == BotIntent.human_request:
            return BotDecision(
                intent=intent,
                action=BotAction.handoff_to_human,
                confidence=0.9,
                reason_summary="Mock: human agent requested.",
                should_handoff=True,
            )
        if intent in {BotIntent.order_start, BotIntent.order_update}:
            return BotDecision(
                intent=intent,
                action=BotAction.continue_flow,
                confidence=0.8,
                reason_summary="Mock: order flow continuation.",
            )
        if intent in AUTO_REPLY_INTENTS:
            return BotDecision(
                intent=intent,
                action=(
                    BotAction.answer_from_knowledge
                    if has_knowledge
                    else BotAction.answer_with_ai
                ),
                confidence=0.75,
                reason_summary="Mock: informational question.",
            )
        if intent == BotIntent.price_question:
            return BotDecision(
                intent=intent,
                action=(
                    BotAction.answer_from_knowledge
                    if has_knowledge
                    else BotAction.require_approval
                ),
                confidence=0.7,
                reason_summary="Mock: pricing question.",
                needs_approval=not has_knowledge,
            )
        return BotDecision(
            intent=BotIntent.unknown,
            action=BotAction.ask_clarification,
            confidence=0.4,
            reason_summary="Mock: unclear intent.",
        )

    async def generate_auto_reply_decision(
        self,
        context: AIAutoReplyContext,
    ) -> AIAutoReplyDecision | None:
        last_message = (
            context.conversation.messages[-1].content
            if context.conversation.messages
            else ""
        )
        summary = last_message[:200] if last_message else "No message content"

        if context.bot_action == BotAction.ask_clarification:
            reply = (
                "כדי שאוכל לעזור בצורה הטובה ביותר, "
                "תוכל בבקשה לפרט קצת יותר מה אתה מחפש?"
            )
        elif context.bot_action == BotAction.continue_flow:
            reply = (
                "מעולה, נמשיך עם ההזמנה. "
                "תוכל לציין כמות, תאריך ושעה מועדפים?"
            )
        else:
            reply = (
                "שלום, תודה שפנית אלינו. "
                "בדקתי את ההודעה שלך ואשמח לעזור. "
                f"נושא אחרון שזוהה: {summary[:120]}"
            )

        return AIAutoReplyDecision(
            requires_approval=False,
            suggested_response=reply,
            customer_summary=summary,
            ai_reasoning_summary=(
                context.bot_reason_summary
                or "Mock provider auto-reply for development and testing."
            ),
            suggested_action_type=SuggestedActionType.normal_reply,
            risk_level=RiskLevel.low,
        )

    async def generate_agent_reply_suggestion(
        self,
        context: AgentReplySuggestionContext,
    ) -> AgentReplySuggestion | None:
        last_customer = ""
        for message in reversed(context.recent_messages):
            if message.sender_type == SenderType.customer:
                last_customer = message.content.strip()
                break

        used_knowledge = [
            UsedKnowledgeReference(
                document_id=chunk.document_id,
                title=chunk.document_title,
                chunk=chunk.content,
            )
            for chunk in context.knowledge_chunks[:3]
        ]

        if context.knowledge_chunks:
            first = context.knowledge_chunks[0]
            reply = (
                f"תודה על הפנייה. לפי המידע שיש לנו ({first.document_title}), "
                f"{first.content[:180].strip()}"
            )
            if last_customer:
                reply = f"היי, בנוגע ל\"{last_customer[:80]}\": {reply}"
            why = "הטיוטה מבוססת על קטע רלוונטי ממאגר הידע ועונה על השאלה האחרונה של הלקוח."
            confidence = 0.78
        elif last_customer:
            reply = (
                f"תודה על ההודעה. כדי לעזור לך בנוגע ל\"{last_customer[:100]}\", "
                "תוכל בבקשה לפרט עוד קצת?"
            )
            why = "אין מספיק מידע במאגר הידע, לכן מוצעת שאלת הבהרה."
            confidence = 0.45
        else:
            reply = "שלום, תודה שפנית אלינו. במה אוכל לעזור לך היום?"
            why = "אין היסטוריית שיחה או ידע רלוונטי — מוצעת פתיחה כללית."
            confidence = 0.35

        if context.extra_instruction:
            reply = f"{reply}\n\n(הערת נציג: {context.extra_instruction[:200]})"
            why = f"{why} כולל הנחיית נציג: {context.extra_instruction[:120]}."

        return AgentReplySuggestion(
            suggested_reply=reply.strip(),
            why_it_fits=why,
            confidence=confidence,
            used_knowledge=used_knowledge,
        )

    async def extract_flow_input(
        self,
        context: FlowInputExtractionContext,
    ) -> FlowInputExtractionResult | None:
        return heuristic_extract_flow_input(context)
