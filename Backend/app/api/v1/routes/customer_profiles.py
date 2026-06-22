from fastapi import APIRouter, Depends, Header, HTTPException

from app.api.dependencies import get_container
from app.core.container import AppContainer
from app.domain.models.conversation import Channel
from app.schemas.customer_profiles import CustomerProfileRead, CustomerProfileUpdate
from app.services.current_user import DEMO_USER_HEADER, resolve_current_user
from app.services.customer_profile_admin import (
    assert_can_edit_customer_profile,
    assert_can_view_customer_profile,
    get_customer_profile_read,
    update_customer_profile_by_agent,
)

router = APIRouter()


def _parse_channel(channel: str) -> Channel:
    try:
        return Channel(channel)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid channel: {channel}") from exc


@router.get("/{channel}/{external_id}", response_model=CustomerProfileRead)
async def get_customer_profile(
    channel: str,
    external_id: str,
    tenant_id: str,
    container: AppContainer = Depends(get_container),
    x_demo_user_id: str | None = Header(default=None, alias=DEMO_USER_HEADER),
):
    current_user = await resolve_current_user(
        tenant_id=tenant_id,
        user_repository=container.user_repository,
        demo_user_id=x_demo_user_id,
    )
    assert_can_view_customer_profile(current_user)

    return await get_customer_profile_read(
        container=container,
        tenant_id=tenant_id,
        channel=_parse_channel(channel),
        external_id=external_id,
    )


@router.put("/{channel}/{external_id}", response_model=CustomerProfileRead)
async def update_customer_profile(
    channel: str,
    external_id: str,
    payload: CustomerProfileUpdate,
    container: AppContainer = Depends(get_container),
    x_demo_user_id: str | None = Header(default=None, alias=DEMO_USER_HEADER),
):
    parsed_channel = _parse_channel(channel)

    current_user = await resolve_current_user(
        tenant_id=payload.tenant_id,
        user_repository=container.user_repository,
        demo_user_id=x_demo_user_id,
    )
    assert_can_edit_customer_profile(current_user)

    return await update_customer_profile_by_agent(
        container=container,
        tenant_id=payload.tenant_id,
        channel=parsed_channel,
        external_id=external_id,
        payload=payload,
        current_user=current_user,
    )
