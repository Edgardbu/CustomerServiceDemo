from typing import Protocol

from app.domain.models.user import User, UserRole, UserStatus


class UserRepository(Protocol):
    async def create(self, user: User) -> User:
        ...

    async def get_by_id(self, tenant_id: str, user_id: str) -> User | None:
        ...

    async def get_by_email(self, tenant_id: str, email: str) -> User | None:
        ...

    async def list_by_tenant(self, tenant_id: str) -> list[User]:
        ...

    async def get_many_by_ids(
        self,
        tenant_id: str,
        user_ids: list[str],
    ) -> dict[str, User]:
        ...

    async def get_first_admin_or_owner(self, tenant_id: str) -> User | None:
        ...

    async def update(self, user: User) -> User:
        ...

    async def count_by_tenant(self, tenant_id: str) -> int:
        ...

    async def has_active_owner_or_admin(self, tenant_id: str) -> bool:
        ...
