from app.domain.models.conversation import Conversation

DEMO_CHANNEL_TAG = "demo_channel"


def is_demo_conversation(conversation: Conversation) -> bool:
    if DEMO_CHANNEL_TAG in conversation.tags:
        return True

    if conversation.customer_id.startswith("demo_"):
        return True

    for message in conversation.messages:
        metadata = message.metadata
        if not isinstance(metadata, dict):
            continue
        if metadata.get("demo_channel") is True:
            return True
        if metadata.get("source") == "demo_simulator":
            return True

    return False
