import json
import logging

from openai import AsyncOpenAI

from app.domain.models.ai import (
    AIAutoReplyContext,
    AIAutoReplyDecision,
    AgentReplySuggestion,
    AgentReplySuggestionContext,
    SuggestedActionType,
    UsedKnowledgeReference,
)
from app.domain.models.bot import BotAction, BotDecision, BotIntent, BotOrchestrationContext
from app.domain.models.bot_flow import FlowInputExtractionContext, FlowInputExtractionResult
from app.domain.models.conversation import Conversation

logger = logging.getLogger(__name__)

AI_DECISION_SCHEMA = {
    "type": "object",
    "properties": {
        "requires_approval": {"type": "boolean"},
        "suggested_response": {
            "type": "string",
            "description": (
                "The exact message to send to the customer. When requires_approval is true, "
                "write the real business answer only — never a handoff or transfer notice."
            ),
        },
        "customer_summary": {
            "type": "string",
            "description": "Brief summary of what the customer asked or needs.",
        },
        "ai_reasoning_summary": {
            "type": "string",
            "description": "Short explanation of why this response and approval level were chosen.",
        },
        "suggested_action_type": {
            "type": "string",
            "enum": [item.value for item in SuggestedActionType],
        },
        "risk_level": {
            "type": "string",
            "enum": ["low", "medium", "high"],
        },
    },
    "required": [
        "requires_approval",
        "suggested_response",
        "customer_summary",
        "ai_reasoning_summary",
        "suggested_action_type",
        "risk_level",
    ],
    "additionalProperties": False,
}

INTENT_CLASSIFICATION_SCHEMA = {
    "type": "object",
    "properties": {
        "intent": {
            "type": "string",
            "enum": [item.value for item in BotIntent],
        },
        "confidence": {"type": "number"},
        "reason_summary": {"type": "string"},
        "needs_approval": {"type": "boolean"},
        "should_handoff": {"type": "boolean"},
        "delivery_outside_allowed_area": {"type": "boolean"},
    },
    "required": [
        "intent",
        "confidence",
        "reason_summary",
        "needs_approval",
        "should_handoff",
        "delivery_outside_allowed_area",
    ],
    "additionalProperties": False,
}

FLOW_INPUT_EXTRACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "value": {
            "type": ["string", "null"],
            "description": (
                "Normalized extracted value. Must be one of expected_values when provided."
            ),
        },
        "confidence": {
            "type": "number",
            "description": "Confidence score between 0 and 1.",
        },
        "clarification_message": {
            "type": ["string", "null"],
            "description": (
                "Short customer-facing clarification question when value is unclear. "
                "Null when extraction succeeded."
            ),
        },
    },
    "required": ["value", "confidence", "clarification_message"],
    "additionalProperties": False,
}

AGENT_REPLY_SUGGESTION_SCHEMA = {
    "type": "object",
    "properties": {
        "suggested_reply": {
            "type": "string",
            "description": (
                "Draft reply the human agent can send to the customer after optional edits."
            ),
        },
        "why_it_fits": {
            "type": "string",
            "description": (
                "Brief practical explanation of why this draft fits the situation. "
                "No hidden chain-of-thought."
            ),
        },
        "confidence": {
            "type": "number",
            "description": "Confidence score between 0 and 1.",
        },
    },
    "required": ["suggested_reply", "why_it_fits", "confidence"],
    "additionalProperties": False,
}

HANDOFF_CORRECTION_SUFFIX = (
    "Your previous suggested_response incorrectly contained a handoff/transfer message. "
    "The customer already received a separate handoff notice. "
    "Regenerate the JSON with suggested_response containing ONLY the actual business "
    "answer, offer, price, or clarifying question that should be sent after approval."
)


def _format_knowledge_chunks_for_agent(context: AgentReplySuggestionContext) -> str:
    if not context.knowledge_chunks:
        return "No matching knowledge base chunks retrieved."

    sections: list[str] = []
    for index, item in enumerate(context.knowledge_chunks, start=1):
        sections.append(
            f"[{index}] document_id={item.document_id} title={item.document_title} "
            f"type={item.document_type} chunk_index={item.chunk_index}\n{item.content}"
        )
    return "\n\n".join(sections)


def _format_customer_profile_for_agent(context: AgentReplySuggestionContext) -> str:
    profile = context.customer_profile
    customer_id = context.conversation.customer_id
    if profile is None:
        return f"external_id={customer_id}"
    parts = [f"external_id={profile.external_id}"]
    if profile.display_name:
        parts.append(f"display_name={profile.display_name}")
    if profile.username:
        parts.append(f"username={profile.username}")
    return ", ".join(parts)


def _build_recent_messages_history(messages) -> str:
    lines: list[str] = []
    for message in messages:
        role = message.sender_type.value
        lines.append(f"{role}: {message.content}")
    return "\n".join(lines) if lines else "No prior messages."


def _build_agent_suggestion_system_prompt(context: AgentReplySuggestionContext) -> str:
    return f"""You are an AI co-pilot helping a human customer support agent draft a reply.

Return ONLY valid JSON matching the required schema.

This is a DRAFT for the agent only. The message will NOT be sent automatically.

Business identity (high-level only — not a facts source):
{context.business_context or "N/A"}

Tone / writing style:
{context.tone_instructions or "Professional, concise, friendly."}

Approval / escalation rules (sensitivity guidance for the agent):
{context.approval_rules or "Prices, discounts, refunds, legal promises, uncertain answers may need human judgment."}

Conversation-specific AI notes:
{context.ai_notes or "None"}

Customer profile:
{_format_customer_profile_for_agent(context)}

Knowledge base (ONLY source for factual answers):
{_format_knowledge_chunks_for_agent(context)}

Rules:
- suggested_reply must be directly usable by the agent (they may edit before sending).
- Match the business tone.
- Use knowledge base chunks for factual answers.
- Do NOT invent prices, menus, policies, or commitments not supported by knowledge.
- If information is missing, suggest a clear clarification question instead of guessing.
- why_it_fits must be short, practical, and agent-facing — no chain-of-thought.
- confidence is 0-1 based on how well the draft is grounded in context and knowledge.
- Do NOT mention that you are an AI unless the business tone requires it.
- Do NOT say the message was sent or will be sent automatically.
"""


def _build_agent_suggestion_user_prompt(context: AgentReplySuggestionContext) -> str:
    prompt = (
        f"Channel: {context.conversation.channel.value}\n"
        f"Recent conversation history:\n"
        f"{_build_recent_messages_history(context.recent_messages)}\n\n"
        "Draft the next agent reply to the customer."
    )
    if context.extra_instruction:
        prompt = (
            f"{prompt}\n\nAgent instruction for this suggestion:\n"
            f"{context.extra_instruction}"
        )
    return prompt


def _format_relevant_knowledge(context: AIAutoReplyContext) -> str:
    if not context.relevant_knowledge:
        return "No matching knowledge base chunks retrieved."

    sections: list[str] = []
    for index, item in enumerate(context.relevant_knowledge, start=1):
        sections.append(
            f"[{index}] title={item.document_title} type={item.document_type} "
            f"chunk={item.chunk_index}\n{item.content}"
        )
    return "\n\n".join(sections)


def _format_bot_guidance(context: AIAutoReplyContext) -> str:
    if context.bot_intent is None or context.bot_action is None:
        return "No orchestrator routing decision."

    return (
        f"intent={context.bot_intent.value}, action={context.bot_action.value}, "
        f"reason={context.bot_reason_summary or 'N/A'}"
    )


def _build_intent_system_prompt(context: BotOrchestrationContext) -> str:
    return f"""You are an intent classifier for a customer support bot.

Return ONLY valid JSON matching the required schema.

Business identity (high-level only — not a facts source):
{context.business_context or "N/A"}

Approval / escalation rules (routing hints only):
{context.approval_rules or "N/A"}

Conversation notes:
{context.conversation_notes or "None"}

Customer profile:
{context.customer_profile_text or "Unknown"}

Relevant knowledge snippets (primary facts source):
{_format_relevant_knowledge_for_bot(context)}

Classify the latest customer message intent. Suggest needs_approval / should_handoff flags,
but business rules in the backend may override your routing decision.

Set delivery_outside_allowed_area=true only when the customer asks for delivery to a location
that appears outside the business service area based on knowledge or context.
"""


def _format_relevant_knowledge_for_bot(context: BotOrchestrationContext) -> str:
    if not context.relevant_knowledge:
        return "None"
    return "\n".join(
        f"- {item.document_title}: {item.content[:300]}"
        for item in context.relevant_knowledge[:5]
    )


def _build_intent_user_prompt(context: BotOrchestrationContext) -> str:
    return (
        f"Channel: {context.channel.value}\n"
        f"Conversation history:\n{_build_conversation_history(context.conversation)}\n\n"
        f"Latest customer message:\n{context.latest_customer_message}\n\n"
        "Classify intent for the latest customer message."
    )


def _build_system_prompt(context: AIAutoReplyContext) -> str:
    return f"""You are a customer support AI assistant.

Return ONLY valid JSON matching the required schema.
Do NOT include chain-of-thought. Put a short summary in ai_reasoning_summary only.

Business identity (who the business is, what it does, target customers, limitations — NOT facts):
{context.business_context or "N/A"}

Tone / writing style:
{context.tone_instructions or "Professional, concise, friendly."}

Approval / escalation rules (when to require human approval or handoff):
{context.approval_rules or "Prices, discounts, refunds, legal promises, contract terms, SLA commitments, custom offers, uncertain answers."}

Conversation-specific notes:
{context.conversation_notes or "None"}

Customer profile:
{context.customer_profile_text or "Unknown"}

Knowledge base (ONLY source for factual answers — menu, FAQ, pricing, policies):
{_format_relevant_knowledge(context)}

Orchestrator routing decision:
{_format_bot_guidance(context)}

CONTENT RULES:
- Use knowledge base chunks for all factual answers (menu, prices, hours, policies, FAQ).
- Do NOT invent prices, menus, or policies not supported by knowledge base chunks.
- business_context describes identity and limitations only — not product facts.
- approval_rules govern risk/escalation only — not answer content.

APPROVAL WORKFLOW (critical):
The backend automatically sends a separate handoff notice to the customer when approval is needed.
That handoff message and suggested_response are TWO DIFFERENT messages.

When requires_approval=true:
- Assume the customer ALREADY received the handoff notice.
- suggested_response must be the ACTUAL business reply the agent will approve and send next.
- Write it exactly as it should appear to the customer after approval.
- Do NOT mention transferring to a human, waiting for approval, or an agent/representative.
- Do NOT repeat or paraphrase the handoff notice.
- Do NOT say you will check, escalate, or get back to them — give the real answer instead.

Wrong suggested_response (requires_approval=true):
"אני מעביר את הבקשה לנציג אנושי"

Correct suggested_response examples (requires_approval=true):
- "יש לנו מגשי פירות בגדלים הבאים: קטן (5-7 אנשים), בינוני (8-12), גדול (13-20). איזה גודל מתאים?"
- "תוכל לציין לכמה אנשים מיועד המגש?"
- "מחיר מגש הפירות הבינוני הוא 180 ₪. האם להמשיך להזמנה?"

Use customer_summary for context about what the customer wants.
Use ai_reasoning_summary for why approval is needed — not suggested_response.

Rules:
- Use suggested_action_type=normal_reply for simple FAQ/support answers.
- Use price_offer/discount/refund/custom_offer when proposing business terms.
- Set requires_approval=true for anything sensitive, uncertain, or business-impacting.
- Set risk_level=low only for safe FAQ replies with high confidence grounded in knowledge.
- When requires_approval=false, suggested_response must be ready to send to the customer as-is.
- When requires_approval=true, suggested_response must be ready to send to the customer AFTER
  the agent approves it — as the next substantive reply, not a handoff notice.
- If knowledge base has no relevant facts, ask a clarifying question or require approval
  rather than guessing.
"""


def _build_conversation_history(conversation: Conversation) -> str:
    lines: list[str] = []
    for message in conversation.messages[-20:]:
        role = message.sender_type.value
        if message.metadata and message.metadata.get("type") == "handoff_notice":
            lines.append(
                f"{role} [system handoff notice — already sent, do not repeat in suggested_response]: "
                f"{message.content}"
            )
            continue
        lines.append(f"{role}: {message.content}")
    return "\n".join(lines) if lines else "No prior messages."


def _build_user_prompt(context: AIAutoReplyContext) -> str:
    prompt = (
        f"Channel: {context.channel.value}\n"
        f"Conversation history:\n{_build_conversation_history(context.conversation)}\n\n"
        "Generate the JSON decision for the latest customer message.\n"
        "If requires_approval=true, suggested_response must be the substantive business reply "
        "only — never a handoff or transfer message."
    )
    if context.retry_after_handoff_correction:
        prompt = f"{prompt}\n\n{HANDOFF_CORRECTION_SUFFIX}"
    return prompt


def _build_flow_input_system_prompt(context: FlowInputExtractionContext) -> str:
    expected = (
        ", ".join(context.expected_values)
        if context.expected_values
        else "Any reasonable normalized value."
    )
    return f"""You extract structured values from customer messages for a bot flow input step.

Return ONLY valid JSON matching the required schema.

Field to extract: {context.field}
Required: {context.required}
Allowed values: {expected}
Validation guidance: {context.validation_prompt or "N/A"}

Rules:
- Return value normalized to exactly one allowed value when allowed values are provided.
- Set confidence between 0 and 1.
- If the message is ambiguous, missing the value, or confidence is low, set value=null and
  provide a short clarification_message in the customer's language.
- clarification_message should help the customer answer again (not an internal note).
- When extraction succeeds with high confidence, set clarification_message=null.
"""


def _build_flow_input_user_prompt(context: FlowInputExtractionContext) -> str:
    history = context.conversation_history or "No prior messages."
    return (
        f"Conversation history:\n{history}\n\n"
        f"Latest customer message:\n{context.customer_message}\n\n"
        f"Extract field '{context.field}'."
    )


class OpenAIProvider:
    def __init__(self, *, api_key: str, model: str) -> None:
        self._client = AsyncOpenAI(api_key=api_key)
        self._model = model

    async def classify_intent(
        self,
        context: BotOrchestrationContext,
    ) -> BotDecision | None:
        try:
            response = await self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": _build_intent_system_prompt(context)},
                    {"role": "user", "content": _build_intent_user_prompt(context)},
                ],
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "bot_intent",
                        "schema": INTENT_CLASSIFICATION_SCHEMA,
                        "strict": True,
                    },
                },
            )
            content = response.choices[0].message.content or "{}"
            payload = json.loads(content)
            intent = BotIntent(payload["intent"])
            needs_approval = bool(payload["needs_approval"])
            if bool(payload.get("delivery_outside_allowed_area")):
                intent = BotIntent.delivery_question
                needs_approval = True

            return BotDecision(
                intent=intent,
                action=BotAction.answer_with_ai,
                confidence=float(payload["confidence"]),
                reason_summary=payload["reason_summary"],
                needs_approval=needs_approval,
                should_handoff=bool(payload["should_handoff"]),
            )
        except Exception:
            logger.exception("[openai] failed to classify intent")
            return None

    async def generate_auto_reply_decision(
        self,
        context: AIAutoReplyContext,
    ) -> AIAutoReplyDecision | None:
        system_prompt = _build_system_prompt(context)
        user_prompt = _build_user_prompt(context)

        try:
            response = await self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "ai_decision",
                        "schema": AI_DECISION_SCHEMA,
                        "strict": True,
                    },
                },
            )
            content = response.choices[0].message.content or "{}"
            payload = json.loads(content)
            return AIAutoReplyDecision.model_validate(payload)
        except Exception:
            logger.exception("[openai] failed to generate auto-reply decision")
            return None

    async def generate_agent_reply_suggestion(
        self,
        context: AgentReplySuggestionContext,
    ) -> AgentReplySuggestion | None:
        try:
            response = await self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {
                        "role": "system",
                        "content": _build_agent_suggestion_system_prompt(context),
                    },
                    {
                        "role": "user",
                        "content": _build_agent_suggestion_user_prompt(context),
                    },
                ],
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "agent_reply_suggestion",
                        "schema": AGENT_REPLY_SUGGESTION_SCHEMA,
                        "strict": True,
                    },
                },
            )
            content = response.choices[0].message.content or "{}"
            payload = json.loads(content)
            used_knowledge = [
                UsedKnowledgeReference(
                    document_id=chunk.document_id,
                    title=chunk.document_title,
                    chunk=chunk.content,
                )
                for chunk in context.knowledge_chunks
            ]
            return AgentReplySuggestion(
                suggested_reply=str(payload["suggested_reply"]).strip(),
                why_it_fits=str(payload["why_it_fits"]).strip(),
                confidence=float(payload["confidence"]),
                used_knowledge=used_knowledge,
            )
        except Exception:
            logger.exception("[openai] failed to generate agent reply suggestion")
            return None

    async def extract_flow_input(
        self,
        context: FlowInputExtractionContext,
    ) -> FlowInputExtractionResult | None:
        try:
            response = await self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": _build_flow_input_system_prompt(context)},
                    {"role": "user", "content": _build_flow_input_user_prompt(context)},
                ],
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "flow_input_extraction",
                        "schema": FLOW_INPUT_EXTRACTION_SCHEMA,
                        "strict": True,
                    },
                },
            )
            content = response.choices[0].message.content or "{}"
            payload = json.loads(content)
            clarification = payload.get("clarification_message")
            return FlowInputExtractionResult(
                value=payload.get("value"),
                confidence=float(payload.get("confidence", 0.0)),
                clarification_message=(
                    str(clarification).strip() if clarification else None
                ),
            )
        except Exception:
            logger.exception("[openai] failed to extract flow input")
            return None
