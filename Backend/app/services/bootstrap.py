"""First-owner bootstrap for fresh tenants.

Creates the initial owner once per tenant when no active owner/admin exists.
"""

import logging
import secrets
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException, status

from app.core.config import Settings
from app.domain.models.user import User, UserRole, UserStatus
from app.domain.ports.user_repository import UserRepository
from app.schemas.bootstrap import BootstrapStatusRead
from app.schemas.users import UserRead

logger = logging.getLogger(__name__)

DEFAULT_BOOTSTRAP_TENANT_ID = "demo"


class BootstrapError(Exception):
    def __init__(self, message: str, status_code: int) -> None:
        super().__init__(message)
        self.status_code = status_code


def _require_bootstrap_enabled(settings: Settings) -> None:
    if not settings.bootstrap_enabled:
        raise BootstrapError("Not found", status.HTTP_404_NOT_FOUND)


def _validate_bootstrap_secret(settings: Settings, provided_secret: str) -> None:
    expected = settings.bootstrap_secret.strip()
    provided = provided_secret.strip()
    if not expected or not secrets.compare_digest(provided, expected):
        raise BootstrapError("Invalid bootstrap secret", status.HTTP_403_FORBIDDEN)


async def get_bootstrap_status(
    *,
    settings: Settings,
    user_repository: UserRepository,
    tenant_id: str,
) -> BootstrapStatusRead:
    has_owner_or_admin = await user_repository.has_active_owner_or_admin(tenant_id)
    bootstrap_required = settings.bootstrap_enabled and not has_owner_or_admin
    return BootstrapStatusRead(
        bootstrap_enabled=settings.bootstrap_enabled,
        has_owner_or_admin=has_owner_or_admin,
        bootstrap_required=bootstrap_required,
    )


async def bootstrap_owner(
    *,
    settings: Settings,
    user_repository: UserRepository,
    tenant_id: str,
    email: str,
    display_name: str,
    bootstrap_secret: str,
) -> UserRead:
    _require_bootstrap_enabled(settings)
    _validate_bootstrap_secret(settings, bootstrap_secret)

    if await user_repository.has_active_owner_or_admin(tenant_id):
        raise BootstrapError("Bootstrap already completed", status.HTTP_409_CONFLICT)

    normalized_email = email.lower().strip()
    existing = await user_repository.get_by_email(tenant_id, normalized_email)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists",
        )

    now = datetime.now(timezone.utc)
    user = User(
        id=str(uuid4()),
        tenant_id=tenant_id,
        email=normalized_email,
        display_name=display_name.strip(),
        role=UserRole.owner,
        status=UserStatus.active,
        created_at=now,
        updated_at=now,
    )
    created = await user_repository.create(user)

    if await _count_active_owners_or_admins(user_repository, tenant_id) > 1:
        logger.error(
            "[bootstrap] multiple owners/admins detected after bootstrap tenant=%s",
            tenant_id,
        )

    logger.info(
        "[bootstrap] created first owner tenant=%s user_id=%s email=%s",
        tenant_id,
        created.id,
        created.email,
    )
    return UserRead.from_domain(created)


async def _count_active_owners_or_admins(
    user_repository: UserRepository,
    tenant_id: str,
) -> int:
    users = await user_repository.list_by_tenant(tenant_id)
    return sum(
        1
        for user in users
        if user.status == UserStatus.active
        and user.role in {UserRole.owner, UserRole.admin}
    )


async def log_bootstrap_startup(
    *,
    settings: Settings,
    user_repository: UserRepository,
    tenant_id: str = DEFAULT_BOOTSTRAP_TENANT_ID,
) -> None:
    if not settings.bootstrap_enabled:
        return

    if await user_repository.has_active_owner_or_admin(tenant_id):
        logger.info("[bootstrap] owner/admin already exists")
        return

    logger.info("[bootstrap] first owner required for tenant %s", tenant_id)
