from app.domain.models.bot_flow import FlowInputExtractionContext, FlowInputExtractionResult
from app.domain.models.conversation import Conversation, SenderType

DEFAULT_EXTRACTION_CONFIDENCE_THRESHOLD = 0.7

DEFAULT_CLARIFICATION_MESSAGE = (
    "לא הצלחתי להבין את התשובה. תוכל בבקשה לנסות שוב?"
)


def build_extraction_context(
    *,
    node: dict,
    message: str,
    conversation: Conversation | None = None,
) -> FlowInputExtractionContext:
    return FlowInputExtractionContext(
        field=str(node.get("field", "")),
        customer_message=message.strip(),
        expected_values=_coerce_expected_values(node.get("expected_values")),
        validation_prompt=str(node.get("validation_prompt") or "").strip(),
        required=bool(node.get("required", True)),
        conversation_history=_format_conversation_history(conversation),
    )


def resolve_confidence_threshold(node: dict) -> float:
    raw = node.get("min_confidence")
    if raw is None:
        return DEFAULT_EXTRACTION_CONFIDENCE_THRESHOLD
    try:
        return float(raw)
    except (TypeError, ValueError):
        return DEFAULT_EXTRACTION_CONFIDENCE_THRESHOLD


def normalize_to_expected_value(
    value: str | None,
    expected_values: list[str],
) -> str | None:
    if value is None:
        return None

    trimmed = value.strip()
    if not trimmed:
        return None
    if not expected_values:
        return trimmed

    for expected in expected_values:
        if trimmed == expected:
            return expected

    lowered = trimmed.casefold()
    for expected in expected_values:
        if lowered == expected.casefold():
            return expected

    for expected in expected_values:
        if expected in trimmed or trimmed in expected:
            return expected
        if expected.casefold() in lowered or lowered in expected.casefold():
            return expected

    return None


def is_extraction_successful(
    *,
    result: FlowInputExtractionResult,
    expected_values: list[str],
    threshold: float,
) -> bool:
    if result.confidence < threshold:
        return False

    normalized = normalize_to_expected_value(result.value, expected_values)
    if normalized is None:
        return False

    if expected_values and normalized not in expected_values:
        return False

    return True


def resolve_clarification_message(
    *,
    node: dict,
    result: FlowInputExtractionResult | None,
) -> str:
    if result is not None:
        clarification = (result.clarification_message or "").strip()
        if clarification:
            return clarification

    validation_prompt = str(node.get("validation_prompt") or "").strip()
    if validation_prompt:
        return validation_prompt

    prompt = str(node.get("prompt") or "").strip()
    if prompt:
        return prompt

    return DEFAULT_CLARIFICATION_MESSAGE


def heuristic_extract_flow_input(
    context: FlowInputExtractionContext,
) -> FlowInputExtractionResult:
    message = context.customer_message.strip()
    if not message:
        return FlowInputExtractionResult(
            value=None,
            confidence=0.0,
            clarification_message=resolve_clarification_message(node={}, result=None),
        )

    if context.expected_values:
        for expected in context.expected_values:
            if expected in message or expected.casefold() in message.casefold():
                return FlowInputExtractionResult(
                    value=expected,
                    confidence=0.97,
                )

        return FlowInputExtractionResult(
            value=None,
            confidence=0.2,
            clarification_message=context.validation_prompt or DEFAULT_CLARIFICATION_MESSAGE,
        )

    return FlowInputExtractionResult(value=message, confidence=0.9)


def _coerce_expected_values(raw: object) -> list[str]:
    if not raw:
        return []
    if isinstance(raw, list):
        return [str(item).strip() for item in raw if str(item).strip()]
    return [str(raw).strip()] if str(raw).strip() else []


def _format_conversation_history(conversation: Conversation | None) -> str:
    if conversation is None or not conversation.messages:
        return ""

    lines: list[str] = []
    for message in conversation.messages[-12:]:
        if message.sender_type == SenderType.customer:
            role = "customer"
        elif message.sender_type == SenderType.bot:
            role = "bot"
        else:
            role = message.sender_type.value
        lines.append(f"{role}: {message.content}")
    return "\n".join(lines)
