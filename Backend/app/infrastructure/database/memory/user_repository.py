from datetime import datetime, timezone

from app.domain.models.user import User, UserRole, UserStatus


class InMemoryUserRepository:
    def __init__(self) -> None:
        self._users: dict[str, User] = {}

    def _key(self, tenant_id: str, user_id: str) -> str:
        return f"{tenant_id}:{user_id}"

    async def create(self, user: User) -> User:
        normalized = user.model_copy(
            update={
                "email": user.email.lower().strip(),
                "display_name": user.display_name.strip(),
            }
        )
        self._users[self._key(user.tenant_id, user.id)] = normalized
        return normalized

    async def get_by_id(self, tenant_id: str, user_id: str) -> User | None:
        return self._users.get(self._key(tenant_id, user_id))

    async def get_by_email(self, tenant_id: str, email: str) -> User | None:
        normalized = email.lower().strip()
        for user in self._users.values():
            if user.tenant_id == tenant_id and user.email == normalized:
                return user
        return None

    async def list_by_tenant(self, tenant_id: str) -> list[User]:
        return sorted(
            [user for user in self._users.values() if user.tenant_id == tenant_id],
            key=lambda user: user.created_at,
        )

    async def get_many_by_ids(
        self,
        tenant_id: str,
        user_ids: list[str],
    ) -> dict[str, User]:
        return {
            user_id: user
            for user_id in user_ids
            if (user := self._users.get(self._key(tenant_id, user_id))) is not None
        }

    async def get_first_admin_or_owner(self, tenant_id: str) -> User | None:
        candidates = [
            user
            for user in self._users.values()
            if user.tenant_id == tenant_id
            and user.status == UserStatus.active
            and user.role in {UserRole.owner, UserRole.admin}
        ]
        if not candidates:
            return None
        candidates.sort(
            key=lambda user: (0 if user.role == UserRole.owner else 1, user.created_at)
        )
        return candidates[0]

    async def has_active_owner_or_admin(self, tenant_id: str) -> bool:
        return await self.get_first_admin_or_owner(tenant_id) is not None

    async def update(self, user: User) -> User:
        key = self._key(user.tenant_id, user.id)
        if key not in self._users:
            raise ValueError("User not found")
        updated = user.model_copy(update={"updated_at": datetime.now(timezone.utc)})
        self._users[key] = updated
        return updated

    async def count_by_tenant(self, tenant_id: str) -> int:
        return sum(1 for user in self._users.values() if user.tenant_id == tenant_id)
