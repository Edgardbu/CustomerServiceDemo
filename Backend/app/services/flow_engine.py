import logging
import re
from datetime import datetime, timezone
from uuid import uuid4

from app.domain.models.bot_flow import (
    BotFlow,
    BotFlowSession,
    BotFlowSessionStatus,
    FlowNodeType,
    FlowStepResult,
)
from app.domain.models.conversation import Conversation
from app.domain.ports.ai_provider import AIProvider
from app.domain.ports.bot_flow_repository import BotFlowRepository
from app.domain.ports.bot_flow_session_repository import BotFlowSessionRepository
from app.domain.models.bot_flow import FlowInputExtractionResult
from app.services.flow_input_extraction import (
    build_extraction_context,
    heuristic_extract_flow_input,
    is_extraction_successful,
    normalize_to_expected_value,
    resolve_clarification_message,
    resolve_confidence_threshold,
)

logger = logging.getLogger(__name__)

_MAX_CHAIN_STEPS = 50


class FlowEngine:
    def __init__(
        self,
        flow_repository: BotFlowRepository,
        session_repository: BotFlowSessionRepository,
        ai_provider: AIProvider | None = None,
    ) -> None:
        self._flows = flow_repository
        self._sessions = session_repository
        self._ai = ai_provider

    async def start_flow(
        self,
        tenant_id: str,
        conversation_id: str,
        flow_id: str,
    ) -> tuple[BotFlowSession, FlowStepResult]:
        flow = await self._flows.get_by_id(tenant_id, flow_id)
        if flow is None:
            raise ValueError("Bot flow not found")
        if not flow.enabled:
            raise ValueError("Bot flow is disabled")

        active = await self._sessions.get_active_by_conversation(tenant_id, conversation_id)
        if active is not None:
            await self.cancel_flow(active)

        start_node_id = _resolve_start_node_id(flow.definition)
        if start_node_id is None:
            raise ValueError("Flow definition has no start node")

        now = datetime.now(timezone.utc)
        session = BotFlowSession(
            id=str(uuid4()),
            tenant_id=tenant_id,
            conversation_id=conversation_id,
            flow_id=flow_id,
            current_node_id=start_node_id,
            state={},
            status=BotFlowSessionStatus.active,
            created_at=now,
            updated_at=now,
        )
        session = await self._sessions.create(session)
        result = await self._process_from_node(flow, session, start_node_id)
        session = await self._sessions.get_by_id(tenant_id, session.id) or session
        return session, result

    async def handle_customer_message(
        self,
        *,
        conversation: Conversation,
        message: str,
    ) -> FlowStepResult | None:
        session = await self._sessions.get_active_by_conversation(
            conversation.tenant_id,
            conversation.id,
        )
        if session is None:
            return None

        flow = await self._flows.get_by_id(session.tenant_id, session.flow_id)
        if flow is None:
            await self.cancel_flow(session)
            return FlowStepResult(completed=True)

        return await self.continue_flow(
            session=session,
            message=message,
            flow=flow,
            conversation=conversation,
        )

    async def continue_flow(
        self,
        *,
        session: BotFlowSession,
        message: str,
        flow: BotFlow | None = None,
        conversation: Conversation | None = None,
    ) -> FlowStepResult:
        if session.status != BotFlowSessionStatus.active:
            return FlowStepResult(completed=session.status == BotFlowSessionStatus.completed)

        if flow is None:
            flow = await self._flows.get_by_id(session.tenant_id, session.flow_id)
            if flow is None:
                await self.cancel_flow(session)
                return FlowStepResult(completed=True)

        current_node = _find_node(flow.definition, session.current_node_id)
        if current_node is None:
            await self.cancel_flow(session)
            return FlowStepResult(completed=True)

        if current_node.get("type") != FlowNodeType.input.value:
            return await self._process_from_node(flow, session, session.current_node_id)

        field_name = current_node.get("field")
        if not field_name:
            raise ValueError("Input node is missing field name")

        extracted_value, extraction_result = await self._resolve_input_value(
            node=current_node,
            message=message,
            conversation=conversation,
        )
        if extracted_value is None:
            clarification = resolve_clarification_message(
                node=current_node,
                result=extraction_result,
            )
            return FlowStepResult(
                messages_to_send=[clarification],
                message_to_send=clarification,
                awaiting_input=True,
            )

        state = dict(session.state)
        state[str(field_name)] = extracted_value
        state["_last_customer_message"] = message.strip()
        session = session.model_copy(update={"state": state})
        session = await self._sessions.update(session)

        next_node_id = _next_from_edges(flow.definition, session.current_node_id)
        if next_node_id is None:
            await self.complete_flow(session)
            return FlowStepResult(completed=True)

        return await self._process_from_node(flow, session, next_node_id)

    async def _resolve_input_value(
        self,
        *,
        node: dict,
        message: str,
        conversation: Conversation | None,
    ) -> tuple[str | None, FlowInputExtractionResult | None]:
        trimmed = message.strip()
        required = bool(node.get("required", True))

        if not trimmed:
            if required:
                return None, None
            return "", None

        if not node.get("extract_with_ai"):
            value = self._resolve_raw_input_value(node=node, message=trimmed)
            return value, None

        context = build_extraction_context(
            node=node,
            message=message,
            conversation=conversation,
        )
        threshold = resolve_confidence_threshold(node)
        expected_values = context.expected_values

        extraction = None
        if self._ai is not None:
            extraction = await self._ai.extract_flow_input(context)
        if extraction is None:
            extraction = heuristic_extract_flow_input(context)

        if not is_extraction_successful(
            result=extraction,
            expected_values=expected_values,
            threshold=threshold,
        ):
            return None, extraction

        normalized = normalize_to_expected_value(extraction.value, expected_values)
        resolved = normalized if normalized is not None else extraction.value
        return resolved, extraction

    def _resolve_raw_input_value(self, *, node: dict, message: str) -> str | None:
        expected_values = node.get("expected_values") or []
        if expected_values:
            normalized = normalize_to_expected_value(
                message,
                [str(value) for value in expected_values],
            )
            if normalized is None and node.get("required", True):
                return None
            return normalized or message

        return message

    async def complete_flow(self, session: BotFlowSession) -> BotFlowSession:
        updated = session.model_copy(
            update={
                "status": BotFlowSessionStatus.completed,
                "current_node_id": None,
                "updated_at": datetime.now(timezone.utc),
            }
        )
        return await self._sessions.update(updated)

    async def cancel_flow(self, session: BotFlowSession) -> BotFlowSession:
        updated = session.model_copy(
            update={
                "status": BotFlowSessionStatus.cancelled,
                "updated_at": datetime.now(timezone.utc),
            }
        )
        return await self._sessions.update(updated)

    async def _process_from_node(
        self,
        flow: BotFlow,
        session: BotFlowSession,
        node_id: str | None,
    ) -> FlowStepResult:
        result = FlowStepResult()
        current_id = node_id
        steps = 0

        while current_id and steps < _MAX_CHAIN_STEPS:
            steps += 1
            node = _find_node(flow.definition, current_id)
            if node is None:
                logger.warning("[flow] missing node id=%s flow=%s", current_id, flow.id)
                await self.cancel_flow(session)
                return FlowStepResult(completed=True)

            node_type = node.get("type")

            if node_type == FlowNodeType.message.value:
                text = str(node.get("text", "")).strip()
                if text:
                    result.messages_to_send.append(text)
                current_id = _next_from_edges(flow.definition, current_id)
                continue

            if node_type == FlowNodeType.input.value:
                session = session.model_copy(update={"current_node_id": current_id})
                session = await self._sessions.update(session)
                result.message_to_send = result.messages_to_send[-1] if result.messages_to_send else None
                return result

            if node_type == FlowNodeType.condition.value:
                current_id = _resolve_condition_target(node, session.state)
                continue

            if node_type == FlowNodeType.action.value:
                state = dict(session.state)
                action_name = node.get("name") or node.get("action") or "action"
                state[action_name] = node.get("value")
                session = session.model_copy(update={"state": state})
                session = await self._sessions.update(session)
                current_id = _next_from_edges(flow.definition, current_id) or node.get("next")
                continue

            if node_type == FlowNodeType.handoff.value:
                session = session.model_copy(
                    update={
                        "status": BotFlowSessionStatus.handed_off,
                        "current_node_id": current_id,
                    }
                )
                await self._sessions.update(session)
                result.handoff_required = True
                result.message_to_send = result.messages_to_send[-1] if result.messages_to_send else None
                return result

            if node_type == FlowNodeType.approval.value:
                session = session.model_copy(update={"current_node_id": current_id})
                await self._sessions.update(session)
                result.needs_approval = True
                result.approval_suggested_response = str(node.get("text", "")).strip() or None
                result.approval_customer_summary = str(
                    node.get("summary") or session.state.get("_last_customer_message", "")
                )
                result.message_to_send = result.messages_to_send[-1] if result.messages_to_send else None
                return result

            if node_type == FlowNodeType.end.value:
                await self.complete_flow(session)
                result.completed = True
                result.message_to_send = result.messages_to_send[-1] if result.messages_to_send else None
                return result

            logger.warning("[flow] unsupported node type=%s id=%s", node_type, current_id)
            current_id = _next_from_edges(flow.definition, current_id)

        result.message_to_send = result.messages_to_send[-1] if result.messages_to_send else None
        return result


def _resolve_start_node_id(definition: dict) -> str | None:
    nodes = definition.get("nodes", [])
    if not nodes:
        return None

    for node in nodes:
        if node.get("id") == "start":
            return node["id"]

    incoming = {edge.get("to") for edge in definition.get("edges", [])}
    for node in nodes:
        node_id = node.get("id")
        if node_id and node_id not in incoming:
            return node_id

    return nodes[0].get("id")


def find_node(definition: dict, node_id: str | None) -> dict | None:
    return _find_node(definition, node_id)


def _find_node(definition: dict, node_id: str | None) -> dict | None:
    if not node_id:
        return None
    for node in definition.get("nodes", []):
        if node.get("id") == node_id:
            return node
    return None


def _next_from_edges(definition: dict, node_id: str) -> str | None:
    for edge in definition.get("edges", []):
        if edge.get("from") == node_id:
            return edge.get("to")
    return None


def _resolve_condition_target(node: dict, state: dict) -> str | None:
    for condition in node.get("conditions", []):
        expression = condition.get("if", "")
        if _evaluate_condition(expression, state):
            return condition.get("next")
    return node.get("default_next")


def _evaluate_condition(expression: str, state: dict) -> bool:
    expression = expression.strip()
    if not expression:
        return False

    match = re.match(r"^(\w+)\s*==\s*['\"](.+?)['\"]$", expression)
    if match:
        field, expected = match.groups()
        return str(state.get(field, "")) == expected

    match = re.match(r"^(\w+)\s*!=\s*['\"](.+?)['\"]$", expression)
    if match:
        field, expected = match.groups()
        return str(state.get(field, "")) != expected

    return False
