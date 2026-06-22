from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_container
from app.core.container import AppContainer
from app.domain.errors import ChannelSendError
from app.domain.models.conversation import Channel
from app.infrastructure.channels.instagram.instagram_provider import InstagramProvider
from app.infrastructure.channels.messenger.messenger_provider import MessengerProvider
from app.infrastructure.channels.whatsapp.whatsapp_provider import WhatsAppProvider
from app.infrastructure.channels.sms.sms_provider import DemoSMSProvider
from app.infrastructure.channels.email.email_provider import SmtpEmailProvider
from app.schemas.demo_channels import DemoChannelInboundRequest
from app.services.demo_channel_inbound import handle_omnichannel_demo_inbound

router = APIRouter()


class InstagramTestSendRequest(BaseModel):
    tenant_id: str = "demo"
    recipient_id: str
    text: str = Field(min_length=1, max_length=1000)


@router.get("/instagram/profile")
async def get_instagram_profile(
    container: AppContainer = Depends(get_container),
):
    provider = container.channels.get(Channel.instagram)
    if not isinstance(provider, InstagramProvider):
        raise HTTPException(
            status_code=400,
            detail=(
                "Instagram is not configured. "
                "Set INSTAGRAM_ACCESS_TOKEN in your environment."
            ),
        )

    try:
        profile = await provider.get_profile()
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch Instagram profile: {exc}",
        ) from exc

    return profile


@router.post("/instagram/test-send")
async def test_send_instagram_message(
    payload: InstagramTestSendRequest,
    container: AppContainer = Depends(get_container),
):
    provider = container.channels.get(Channel.instagram)
    if not isinstance(provider, InstagramProvider):
        raise HTTPException(
            status_code=400,
            detail=(
                "Instagram is not configured for outbound messaging. "
                "Set INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_ACCOUNT_ID in your environment."
            ),
        )

    try:
        result = await provider.send_message(
            tenant_id=payload.tenant_id,
            recipient_id=payload.recipient_id,
            text=payload.text,
        )
    except ChannelSendError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to send Instagram message: {exc.message}",
        ) from exc

    return {
        "success": result.success,
        "external_message_id": result.external_message_id,
        "recipient_id": result.recipient_id,
    }


@router.get("/instagram/users/{user_id}/profile")
async def get_instagram_user_profile(
    user_id: str,
    container: AppContainer = Depends(get_container),
):
    provider = container.channels.get(Channel.instagram)
    if not isinstance(provider, InstagramProvider):
        raise HTTPException(
            status_code=400,
            detail=(
                "Instagram is not configured. "
                "Set INSTAGRAM_ACCESS_TOKEN or META_PAGE_ACCESS_TOKEN in your environment."
            ),
        )

    profile = await provider.get_user_profile(user_id)
    return {
        "external_id": profile.external_id,
        "display_name": profile.display_name,
        "username": profile.username,
        "profile_picture_url": profile.profile_picture_url,
    }


class MessengerTestSendRequest(BaseModel):
    tenant_id: str = "demo"
    recipient_id: str
    text: str = Field(min_length=1, max_length=1000)


def _get_messenger_provider(container: AppContainer) -> MessengerProvider:
    provider = container.channels.get(Channel.facebook)
    if not isinstance(provider, MessengerProvider):
        raise HTTPException(
            status_code=400,
            detail=(
                "Messenger is not configured. "
                "Set META_PAGE_ACCESS_TOKEN and META_PAGE_ID in your environment."
            ),
        )
    return provider


@router.get("/messenger/users/{user_id}/profile")
async def get_messenger_user_profile(
    user_id: str,
    container: AppContainer = Depends(get_container),
):
    provider = _get_messenger_provider(container)
    profile = await provider.get_user_profile(user_id)
    return {
        "external_id": profile.external_id,
        "display_name": profile.display_name,
        "username": profile.username,
        "profile_picture_url": profile.profile_picture_url,
        "raw_profile": profile.raw_profile,
    }


@router.post("/messenger/test-send")
async def test_send_messenger_message(
    payload: MessengerTestSendRequest,
    container: AppContainer = Depends(get_container),
):
    provider = _get_messenger_provider(container)

    try:
        result = await provider.send_message(
            tenant_id=payload.tenant_id,
            recipient_id=payload.recipient_id,
            text=payload.text,
        )
    except ChannelSendError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to send Messenger message: {exc.message}",
        ) from exc

    return {
        "success": result.success,
        "external_message_id": result.external_message_id,
        "recipient_id": result.recipient_id,
    }


@router.post("/messenger/subscribe-page")
async def subscribe_messenger_page(
    container: AppContainer = Depends(get_container),
):
    provider = _get_messenger_provider(container)

    try:
        result = await provider.subscribe_page()
    except ChannelSendError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to subscribe page: {exc.message}",
        ) from exc

    return result


@router.get("/messenger/subscribed-apps")
async def get_messenger_subscribed_apps(
    container: AppContainer = Depends(get_container),
):
    provider = _get_messenger_provider(container)

    try:
        result = await provider.get_subscribed_apps()
    except ChannelSendError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch subscribed apps: {exc.message}",
        ) from exc

    return result


class WhatsAppTestSendRequest(BaseModel):
    tenant_id: str = "demo"
    recipient_id: str
    text: str = Field(min_length=1, max_length=4096)


def _get_whatsapp_provider(container: AppContainer) -> WhatsAppProvider:
    provider = container.channels.get(Channel.whatsapp)
    if not isinstance(provider, WhatsAppProvider):
        raise HTTPException(
            status_code=400,
            detail=(
                "WhatsApp is not configured. "
                "Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in your environment."
            ),
        )
    return provider


@router.get("/whatsapp/config-check")
async def whatsapp_config_check(
    container: AppContainer = Depends(get_container),
):
    provider = _get_whatsapp_provider(container)
    return provider.config_check()


@router.post("/whatsapp/test-send")
async def test_send_whatsapp_message(
    payload: WhatsAppTestSendRequest,
    container: AppContainer = Depends(get_container),
):
    provider = _get_whatsapp_provider(container)

    try:
        result = await provider.send_message(
            tenant_id=payload.tenant_id,
            recipient_id=payload.recipient_id,
            text=payload.text,
        )
    except ChannelSendError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to send WhatsApp message: {exc.message}",
        ) from exc

    return result.raw_response


@router.post("/whatsapp/subscribe-waba")
async def subscribe_whatsapp_waba(
    container: AppContainer = Depends(get_container),
):
    provider = _get_whatsapp_provider(container)

    try:
        result = await provider.subscribe_waba()
    except ChannelSendError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to subscribe WABA: {exc.message}",
        ) from exc

    return result


@router.get("/whatsapp/subscribed-apps")
async def get_whatsapp_subscribed_apps(
    container: AppContainer = Depends(get_container),
):
    provider = _get_whatsapp_provider(container)

    try:
        result = await provider.get_subscribed_apps()
    except ChannelSendError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch subscribed apps: {exc.message}",
        ) from exc

    return result


class SmsDemoInboundRequest(BaseModel):
    tenant_id: str = "demo"
    from_number: str = Field(alias="from")
    text: str = Field(min_length=1)

    model_config = {"populate_by_name": True}


class SmsTestSendRequest(BaseModel):
    tenant_id: str = "demo"
    recipient_id: str
    text: str = Field(min_length=1, max_length=1000)


class EmailDemoInboundRequest(BaseModel):
    tenant_id: str = "demo"
    from_email: str
    from_name: str | None = None
    subject: str = Field(min_length=1)
    text: str = Field(min_length=1)


class EmailTestSendRequest(BaseModel):
    tenant_id: str = "demo"
    recipient_id: str
    subject: str = "Test email"
    text: str = Field(min_length=1)


def _get_sms_provider(container: AppContainer) -> DemoSMSProvider:
    provider = container.channels.get(Channel.sms)
    if not isinstance(provider, DemoSMSProvider):
        raise HTTPException(
            status_code=400,
            detail="SMS channel is not configured.",
        )
    return provider


def _get_email_provider(container: AppContainer) -> SmtpEmailProvider:
    provider = container.channels.get(Channel.email)
    if not isinstance(provider, SmtpEmailProvider):
        raise HTTPException(
            status_code=400,
            detail="Email channel is not configured.",
        )
    return provider


@router.get("/sms/config-check")
async def sms_config_check(
    container: AppContainer = Depends(get_container),
):
    provider = _get_sms_provider(container)
    return provider.config_check()


@router.post("/sms/test-send")
async def test_send_sms_message(
    payload: SmsTestSendRequest,
    container: AppContainer = Depends(get_container),
):
    provider = _get_sms_provider(container)

    try:
        result = await provider.send_message(
            tenant_id=payload.tenant_id,
            recipient_id=payload.recipient_id,
            text=payload.text,
        )
    except ChannelSendError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to send SMS message: {exc.message}",
        ) from exc

    return {
        "success": result.success,
        "external_message_id": result.external_message_id,
        "recipient_id": result.recipient_id,
        "raw_response": result.raw_response,
    }


@router.post("/sms/demo-inbound")
async def demo_sms_inbound(
    payload: SmsDemoInboundRequest,
    container: AppContainer = Depends(get_container),
):
    _get_sms_provider(container)
    return await handle_omnichannel_demo_inbound(
        container=container,
        payload=DemoChannelInboundRequest(
            tenant_id=payload.tenant_id,
            channel="sms",
            customer_id=payload.from_number,
            display_name=payload.from_number,
            content=payload.text,
        ),
    )


@router.get("/email/config-check")
async def email_config_check(
    container: AppContainer = Depends(get_container),
):
    provider = _get_email_provider(container)
    return provider.config_check()


@router.post("/email/test-send")
async def test_send_email_message(
    payload: EmailTestSendRequest,
    container: AppContainer = Depends(get_container),
):
    provider = _get_email_provider(container)

    try:
        result = await provider.send_message(
            tenant_id=payload.tenant_id,
            recipient_id=payload.recipient_id,
            text=payload.text,
            subject=payload.subject,
        )
    except ChannelSendError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to send email: {exc.message}",
        ) from exc

    return {
        "success": result.success,
        "external_message_id": result.external_message_id,
        "recipient_id": result.recipient_id,
        "raw_response": result.raw_response,
    }


@router.post("/email/demo-inbound")
async def demo_email_inbound(
    payload: EmailDemoInboundRequest,
    container: AppContainer = Depends(get_container),
):
    _get_email_provider(container)
    return await handle_omnichannel_demo_inbound(
        container=container,
        payload=DemoChannelInboundRequest(
            tenant_id=payload.tenant_id,
            channel="email",
            customer_id=payload.from_email,
            display_name=payload.from_name,
            content=payload.text,
            metadata={"subject": payload.subject},
        ),
    )
