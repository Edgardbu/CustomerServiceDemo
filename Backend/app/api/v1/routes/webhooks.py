import logging

from pydantic import AliasChoices

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse

from app.api.dependencies import get_container
from app.core.config import get_settings
from app.core.container import AppContainer
from app.domain.models.conversation import Channel
from app.domain.models.inbound import InboundCustomerMessage
from app.infrastructure.channels.messenger.messenger_provider import MessengerProvider
from app.services.customer_profiles import (
    sync_instagram_customer_profile,
    sync_messenger_customer_profile,
    sync_whatsapp_customer_profile,
)
from app.infrastructure.channels.whatsapp.whatsapp_provider import WhatsAppProvider
from app.services.whatsapp_delivery import apply_whatsapp_status_updates

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/instagram")
async def verify_instagram_webhook(
    hub_mode: str = Query(alias="hub.mode"),
    hub_verify_token: str = Query(alias="hub.verify_token"),
    hub_challenge: str = Query(alias="hub.challenge"),
):
    settings = get_settings()

    if hub_mode == "subscribe" and hub_verify_token == settings.instagram_verify_token:
        return PlainTextResponse(content=hub_challenge)

    raise HTTPException(status_code=403, detail="Webhook verification failed")


@router.post("/instagram")
async def receive_instagram_webhook(
    payload: dict,
    container: AppContainer = Depends(get_container),
):
    provider = container.channels.get(Channel.instagram)
    if provider is None:
        raise HTTPException(
            status_code=400,
            detail="Instagram channel is not configured on this server.",
        )

    # Production should resolve tenant_id from the Instagram account ID in the webhook
    # payload (entry[].id) instead of using a hardcoded demo tenant.
    tenant_id = "demo"

    inbound_messages = await provider.handle_webhook(tenant_id=tenant_id, payload=payload)

    for inbound in inbound_messages:
        await sync_instagram_customer_profile(
            container=container,
            tenant_id=tenant_id,
            external_id=inbound.sender_external_id,
            provider=provider,
        )

        conversation = await container.conversation_repository.get_or_create_by_external_customer(
            tenant_id=tenant_id,
            customer_id=inbound.sender_external_id,
            channel=Channel.instagram,
        )

        await container.bot_runtime.handle_inbound_customer_message(
            tenant_id=tenant_id,
            conversation=conversation,
            customer_message=InboundCustomerMessage(
                content=inbound.text,
                external_message_id=inbound.external_message_id,
            ),
        )

    return {"status": "ok"}


@router.get("/whatsapp")
async def verify_whatsapp_webhook(
    hub_mode: str = Query(validation_alias=AliasChoices("hub.mode", "hub_mode")),
    hub_verify_token: str = Query(
        validation_alias=AliasChoices("hub.verify_token", "hub_verify_token")
    ),
    hub_challenge: str = Query(validation_alias=AliasChoices("hub.challenge", "hub_challenge")),
):
    settings = get_settings()

    if hub_mode == "subscribe" and hub_verify_token == settings.whatsapp_verify_token:
        logger.info("[whatsapp:webhook] verified")
        return PlainTextResponse(content=hub_challenge)

    raise HTTPException(status_code=403, detail="Webhook verification failed")


@router.post("/whatsapp")
async def receive_whatsapp_webhook(
    payload: dict,
    container: AppContainer = Depends(get_container),
):
    provider = container.channels.get(Channel.whatsapp)
    if not isinstance(provider, WhatsAppProvider):
        raise HTTPException(
            status_code=400,
            detail="WhatsApp channel is not configured on this server.",
        )

    tenant_id = "demo"

    status_updates = provider.parse_status_updates(payload)
    if status_updates:
        await apply_whatsapp_status_updates(
            container=container,
            tenant_id=tenant_id,
            updates=status_updates,
        )

    inbound_messages = await provider.handle_webhook(tenant_id=tenant_id, payload=payload)

    for inbound in inbound_messages:
        await sync_whatsapp_customer_profile(
            container=container,
            tenant_id=tenant_id,
            external_id=inbound.sender_external_id,
            provider=provider,
            display_name=inbound.contact_display_name,
        )

        conversation = await container.conversation_repository.get_or_create_by_external_customer(
            tenant_id=tenant_id,
            customer_id=inbound.sender_external_id,
            channel=Channel.whatsapp,
        )

        await container.bot_runtime.handle_inbound_customer_message(
            tenant_id=tenant_id,
            conversation=conversation,
            customer_message=InboundCustomerMessage(
                content=inbound.text,
                external_message_id=inbound.external_message_id,
                attachments=inbound.attachments,
                metadata=inbound.metadata,
            ),
        )

    return {"status": "ok"}


@router.get("/messenger")
async def verify_messenger_webhook(
    hub_mode: str = Query(validation_alias=AliasChoices("hub.mode", "hub_mode")),
    hub_verify_token: str = Query(
        validation_alias=AliasChoices("hub.verify_token", "hub_verify_token")
    ),
    hub_challenge: str = Query(validation_alias=AliasChoices("hub.challenge", "hub_challenge")),
):
    settings = get_settings()
    expected_token = settings.resolved_meta_webhook_verify_token()

    if hub_mode == "subscribe" and hub_verify_token == expected_token:
        logger.info("[messenger:webhook] verified")
        return PlainTextResponse(content=hub_challenge)

    raise HTTPException(status_code=403, detail="Webhook verification failed")


@router.post("/messenger")
async def receive_messenger_webhook(
    payload: dict,
    container: AppContainer = Depends(get_container),
):
    provider = container.channels.get(Channel.facebook)
    if not isinstance(provider, MessengerProvider):
        raise HTTPException(
            status_code=400,
            detail="Messenger channel is not configured on this server.",
        )

    # Production should resolve tenant_id from the Page ID in entry[].id.
    tenant_id = "demo"

    inbound_messages = await provider.handle_webhook(tenant_id=tenant_id, payload=payload)

    for inbound in inbound_messages:
        await sync_messenger_customer_profile(
            container=container,
            tenant_id=tenant_id,
            external_id=inbound.sender_external_id,
            provider=provider,
        )

        conversation = await container.conversation_repository.get_or_create_by_external_customer(
            tenant_id=tenant_id,
            customer_id=inbound.sender_external_id,
            channel=Channel.facebook,
        )

        await container.bot_runtime.handle_inbound_customer_message(
            tenant_id=tenant_id,
            conversation=conversation,
            customer_message=InboundCustomerMessage(
                content=inbound.text,
                external_message_id=inbound.external_message_id,
            ),
        )

    return {"status": "ok"}
