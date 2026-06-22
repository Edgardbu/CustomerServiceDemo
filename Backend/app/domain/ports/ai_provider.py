from typing import Protocol

from app.domain.models.ai import AIAutoReplyContext, AIAutoReplyDecision
from app.domain.models.ai import AgentReplySuggestion, AgentReplySuggestionContext
from app.domain.models.bot import BotDecision, BotOrchestrationContext
from app.domain.models.bot_flow import FlowInputExtractionContext, FlowInputExtractionResult


class AIProvider(Protocol):
    async def classify_intent(
        self,
        context: BotOrchestrationContext,
    ) -> BotDecision | None:
        ...

    async def generate_auto_reply_decision(
        self,
        context: AIAutoReplyContext,
    ) -> AIAutoReplyDecision | None:
        ...

    async def generate_agent_reply_suggestion(
        self,
        context: AgentReplySuggestionContext,
    ) -> AgentReplySuggestion | None:
        ...

    async def extract_flow_input(
        self,
        context: FlowInputExtractionContext,
    ) -> FlowInputExtractionResult | None:
        ...
