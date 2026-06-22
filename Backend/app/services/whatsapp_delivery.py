import logging
from typing import TYPE_CHECKING

from app.domain.models.conversation import DeliveryStatus
from app.domain.models.whatsapp import WhatsAppStatusUpdate

if TYPE_CHECKING:
    from app.core.container import AppContainer

logger = logging.getLogger(__name__)


def map_whatsapp_delivery_status(status: str) -> DeliveryStatus:
    if status == "failed":
        return DeliveryStatus.failed
    return DeliveryStatus.sent


async def apply_whatsapp_status_updates(
    *,
    container: "AppContainer",
    tenant_id: str,
    updates: list[WhatsAppStatusUpdate],
) -> None:
    for update in updates:
        delivery_status = map_whatsapp_delivery_status(update.status)
        metadata = {"whatsapp_status": update.status}
        if update.recipient_id:
            metadata["whatsapp_recipient_id"] = update.recipient_id

        message = await container.conversation_repository.update_message_delivery_by_external_id(
            tenant_id=tenant_id,
            external_message_id=update.external_message_id,
            delivery_status=delivery_status,
            metadata=metadata,
            external_raw_response=update.raw_status,
        )

        if message is None:
            logger.debug(
                "[whatsapp:webhook] no message found for status external_id=%s",
                update.external_message_id,
            )
            continue

        await container.realtime.publish(
            tenant_id=tenant_id,
            event="message.sent",
            payload=message.model_dump(mode="json"),
        )
