import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException

from app.api.dependencies import get_container
from app.core.config import Settings, get_settings
from app.core.container import AppContainer
from app.schemas.demo_channels import (
    SUPPORTED_DEMO_CHANNEL_NAMES,
    DemoChannelConfigResponse,
    DemoChannelInboundRequest,
    DemoChannelInboundResponse,
)
from app.services.demo_channel_inbound import handle_omnichannel_demo_inbound

router = APIRouter()


def _ensure_demo_channels_enabled(settings: Settings) -> None:
    if not settings.demo_channels_enabled:
        raise HTTPException(status_code=404, detail="Not found")


def _validate_demo_secret(
    settings: Settings,
    x_demo_secret: str | None,
) -> None:
    expected = settings.demo_channel_secret
    if not expected or not x_demo_secret:
        raise HTTPException(status_code=403, detail="Invalid demo secret")
    if not secrets.compare_digest(x_demo_secret, expected):
        raise HTTPException(status_code=403, detail="Invalid demo secret")


def require_demo_channel_access(
    settings: Annotated[Settings, Depends(get_settings)],
    x_demo_secret: Annotated[str | None, Header(alias="X-Demo-Secret")] = None,
) -> Settings:
    _ensure_demo_channels_enabled(settings)
    _validate_demo_secret(settings, x_demo_secret)
    return settings


@router.get("/config", response_model=DemoChannelConfigResponse)
async def get_demo_channels_config(
    settings: Annotated[Settings, Depends(require_demo_channel_access)],
):
    return DemoChannelConfigResponse(
        enabled=settings.demo_channels_enabled,
        channels=SUPPORTED_DEMO_CHANNEL_NAMES,
    )


@router.post("/inbound", response_model=DemoChannelInboundResponse)
async def post_demo_channel_inbound(
    payload: DemoChannelInboundRequest,
    container: AppContainer = Depends(get_container),
    _settings: Annotated[Settings, Depends(require_demo_channel_access)] = None,
):
    result = await handle_omnichannel_demo_inbound(
        container=container,
        payload=payload,
    )
    return DemoChannelInboundResponse.model_validate(result)
