"""Temporary current-user resolution for development.

Reads X-Demo-User-Id header. Falls back to first active owner/admin in tenant.
Replace this module with JWT auth later.
"""

from datetime import datetime, timezone

from fastapi import Depends, Header, HTTPException, Query, status

from app.api.dependencies import get_container
from app.core.container import AppContainer
from app.domain.models.user import User, UserStatus
from app.domain.ports.user_repository import UserRepository

DEMO_USER_HEADER = "X-Demo-User-Id"


async def resolve_current_user(
    *,
    tenant_id: str,
    user_repository: UserRepository,
    demo_user_id: str | None,
) -> User:
    if demo_user_id:
        user = await user_repository.get_by_id(tenant_id, demo_user_id.strip())
        if user is not None and user.status == UserStatus.active:
            user = user.model_copy(update={"last_seen_at": datetime.now(timezone.utc)})
            return user

    fallback = await user_repository.get_first_admin_or_owner(tenant_id)
    if fallback is not None:
        return fallback

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="No active user available for tenant",
    )


async def get_current_user(
    tenant_id: str = Query(...),
    container: AppContainer = Depends(get_container),
    x_demo_user_id: str | None = Header(default=None, alias=DEMO_USER_HEADER),
) -> User:
    return await resolve_current_user(
        tenant_id=tenant_id,
        user_repository=container.user_repository,
        demo_user_id=x_demo_user_id,
    )
