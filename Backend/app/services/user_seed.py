"""Optional demo users for local development only.

Disabled by default. Enable with SEED_DEMO_USERS=true when APP_ENV=local.
Production and bootstrap flows should not use this.
"""

from datetime import datetime, timezone

from app.core.config import Settings
from app.domain.models.user import User, UserRole, UserStatus
from app.domain.ports.user_repository import UserRepository

DEMO_TENANT_ID = "demo"
DEMO_OWNER_ID = "demo-user-owner"
DEMO_AGENT_ID = "demo-user-agent"


async def ensure_demo_users(
    user_repository: UserRepository,
    *,
    settings: Settings,
) -> None:
    if settings.app_env != "local" or not settings.seed_demo_users:
        return

    if await user_repository.count_by_tenant(DEMO_TENANT_ID) > 0:
        return

    now = datetime.now(timezone.utc)
    await user_repository.create(
        User(
            id=DEMO_OWNER_ID,
            tenant_id=DEMO_TENANT_ID,
            email="owner@demo.local",
            display_name="Demo Owner",
            role=UserRole.owner,
            status=UserStatus.active,
            created_at=now,
            updated_at=now,
        )
    )
    await user_repository.create(
        User(
            id=DEMO_AGENT_ID,
            tenant_id=DEMO_TENANT_ID,
            email="agent@demo.local",
            display_name="Demo Agent",
            role=UserRole.agent,
            status=UserStatus.active,
            created_at=now,
            updated_at=now,
        )
    )
