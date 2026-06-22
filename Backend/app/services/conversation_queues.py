"""Conversation queue filtering by role."""

from enum import StrEnum

from app.domain.models.ai import AIConversationStatus
from app.domain.models.conversation import Conversation, ConversationStatus
from app.domain.models.user import User, UserRole
from app.services.bot_orchestrator import HANDOFF_TO_HUMAN_TAG

WAITING_TAG = "waiting_for_ai_approval"


class ConversationQueue(StrEnum):
    all = "all"
    unassigned = "unassigned"
    mine = "mine"
    human_needed = "human_needed"
    resolved = "resolved"


_OPEN_STATUSES = {ConversationStatus.open, ConversationStatus.pending}


def is_unassigned_open(conversation: Conversation) -> bool:
    return (
        conversation.assigned_agent_id is None
        and conversation.status in _OPEN_STATUSES
    )


def is_human_needed(conversation: Conversation) -> bool:
    if HANDOFF_TO_HUMAN_TAG in conversation.tags:
        return True
    if conversation.ai_status == AIConversationStatus.waiting_for_approval.value:
        return True
    if WAITING_TAG in conversation.tags:
        return True
    if is_unassigned_open(conversation):
        return True
    return False


def is_resolved(conversation: Conversation) -> bool:
    return conversation.status in {ConversationStatus.resolved, ConversationStatus.closed}


def filter_conversations_by_queue(
    conversations: list[Conversation],
    *,
    queue: ConversationQueue,
    current_user: User,
) -> list[Conversation]:
    if queue == ConversationQueue.resolved:
        return [conversation for conversation in conversations if is_resolved(conversation)]

    if current_user.role in {UserRole.owner, UserRole.admin, UserRole.viewer}:
        return _filter_admin_viewer_queue(conversations, queue=queue, current_user=current_user)

    return _filter_agent_queue(conversations, queue=queue, current_user=current_user)


def _filter_admin_viewer_queue(
    conversations: list[Conversation],
    *,
    queue: ConversationQueue,
    current_user: User,
) -> list[Conversation]:
    if queue == ConversationQueue.all:
        return conversations
    if queue == ConversationQueue.mine:
        return [
            conversation
            for conversation in conversations
            if conversation.assigned_agent_id == current_user.id
        ]
    if queue == ConversationQueue.unassigned:
        return [conversation for conversation in conversations if is_unassigned_open(conversation)]
    if queue == ConversationQueue.human_needed:
        return [conversation for conversation in conversations if is_human_needed(conversation)]
    return conversations


def _filter_agent_queue(
    conversations: list[Conversation],
    *,
    queue: ConversationQueue,
    current_user: User,
) -> list[Conversation]:
    mine = [
        conversation
        for conversation in conversations
        if conversation.assigned_agent_id == current_user.id
    ]
    human_needed = [
        conversation
        for conversation in conversations
        if is_human_needed(conversation)
        and (
            conversation.assigned_agent_id is None
            or conversation.assigned_agent_id == current_user.id
        )
    ]

    if queue == ConversationQueue.mine:
        return mine
    if queue in {ConversationQueue.unassigned, ConversationQueue.human_needed}:
        return [
            conversation
            for conversation in human_needed
            if conversation.assigned_agent_id is None or is_human_needed(conversation)
        ]
    if queue == ConversationQueue.all:
        combined = {conversation.id: conversation for conversation in mine}
        for conversation in human_needed:
            combined[conversation.id] = conversation
        return list(combined.values())

    return conversations
