from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.domain.models.user import User, UserRole, UserStatus
from app.infrastructure.database.postgres.models import UserModel


def _to_domain(model: UserModel) -> User:
    return User(
        id=model.id,
        tenant_id=model.tenant_id,
        email=model.email,
        display_name=model.display_name,
        role=UserRole(model.role),
        status=UserStatus(model.status),
        created_at=model.created_at,
        updated_at=model.updated_at,
        last_seen_at=model.last_seen_at,
    )


class PostgresUserRepository:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def create(self, user: User) -> User:
        async with self._session_factory() as session:
            model = UserModel(
                id=user.id,
                tenant_id=user.tenant_id,
                email=user.email.lower().strip(),
                display_name=user.display_name.strip(),
                role=user.role.value,
                status=user.status.value,
                created_at=user.created_at,
                updated_at=user.updated_at,
                last_seen_at=user.last_seen_at,
            )
            session.add(model)
            await session.commit()
            await session.refresh(model)
            return _to_domain(model)

    async def get_by_id(self, tenant_id: str, user_id: str) -> User | None:
        async with self._session_factory() as session:
            stmt = select(UserModel).where(
                UserModel.tenant_id == tenant_id,
                UserModel.id == user_id,
            )
            result = await session.execute(stmt)
            model = result.scalar_one_or_none()
            return _to_domain(model) if model else None

    async def get_by_email(self, tenant_id: str, email: str) -> User | None:
        async with self._session_factory() as session:
            stmt = select(UserModel).where(
                UserModel.tenant_id == tenant_id,
                UserModel.email == email.lower().strip(),
            )
            result = await session.execute(stmt)
            model = result.scalar_one_or_none()
            return _to_domain(model) if model else None

    async def list_by_tenant(self, tenant_id: str) -> list[User]:
        async with self._session_factory() as session:
            stmt = (
                select(UserModel)
                .where(UserModel.tenant_id == tenant_id)
                .order_by(UserModel.created_at.asc())
            )
            result = await session.execute(stmt)
            return [_to_domain(model) for model in result.scalars().all()]

    async def get_many_by_ids(
        self,
        tenant_id: str,
        user_ids: list[str],
    ) -> dict[str, User]:
        if not user_ids:
            return {}

        async with self._session_factory() as session:
            stmt = select(UserModel).where(
                UserModel.tenant_id == tenant_id,
                UserModel.id.in_(user_ids),
            )
            result = await session.execute(stmt)
            return {model.id: _to_domain(model) for model in result.scalars().all()}

    async def get_first_admin_or_owner(self, tenant_id: str) -> User | None:
        users = await self.list_by_tenant(tenant_id)
        candidates = [
            user
            for user in users
            if user.status == UserStatus.active
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
        async with self._session_factory() as session:
            stmt = select(UserModel).where(
                UserModel.tenant_id == user.tenant_id,
                UserModel.id == user.id,
            )
            result = await session.execute(stmt)
            model = result.scalar_one_or_none()
            if model is None:
                raise ValueError("User not found")

            model.email = user.email.lower().strip()
            model.display_name = user.display_name.strip()
            model.role = user.role.value
            model.status = user.status.value
            model.updated_at = datetime.now(timezone.utc)
            model.last_seen_at = user.last_seen_at

            await session.commit()
            await session.refresh(model)
            return _to_domain(model)

    async def count_by_tenant(self, tenant_id: str) -> int:
        async with self._session_factory() as session:
            stmt = select(UserModel).where(UserModel.tenant_id == tenant_id)
            result = await session.execute(stmt)
            return len(result.scalars().all())
