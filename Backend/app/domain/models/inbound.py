from dataclasses import dataclass, field


@dataclass(slots=True)
class InboundCustomerMessage:
    content: str
    id: str | None = None
    external_message_id: str | None = None
    attachments: list[str] = field(default_factory=list)
    metadata: dict | None = None
