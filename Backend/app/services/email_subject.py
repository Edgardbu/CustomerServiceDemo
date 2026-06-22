from app.domain.models.conversation import Conversation


def format_email_inbound_content(*, subject: str, text: str) -> str:
    return f"Subject: {subject.strip()}\n\n{text.strip()}"


def resolve_email_reply_subject(
    conversation: Conversation,
    metadata: dict | None,
) -> str:
    if metadata and metadata.get("subject"):
        subject = str(metadata["subject"]).strip()
        if subject:
            return subject

    for message in reversed(conversation.messages):
        if not message.metadata:
            continue
        subject = message.metadata.get("subject")
        if not subject:
            continue
        subject_text = str(subject).strip()
        if not subject_text:
            continue
        if subject_text.lower().startswith("re:"):
            return subject_text
        return f"Re: {subject_text}"

    return "Support reply"
