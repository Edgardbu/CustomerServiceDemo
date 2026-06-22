from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException

from app.api.dependencies import get_container
from app.core.container import AppContainer
from app.domain.models.user import User, UserRole, UserStatus
from app.schemas.users import UserCreate, UserRead, UserUpdate
from app.services.current_user import DEMO_USER_HEADER, get_current_user, resolve_current_user
from app.services.permissions import Permission, assert_can_manage_target_user, require_permission

router = APIRouter()


@router.get("", response_model=list[UserRead])
async def list_users(
    tenant_id: str,
    container: AppContainer = Depends(get_container),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, Permission.manage_users)
    users = await container.user_repository.list_by_tenant(tenant_id)
    return [UserRead.from_domain(user) for user in users]


@router.post("", response_model=UserRead, status_code=201)
async def create_user(
    payload: UserCreate,
    container: AppContainer = Depends(get_container),
    x_demo_user_id: str | None = Header(default=None, alias=DEMO_USER_HEADER),
):
    current_user = await resolve_current_user(
        tenant_id=payload.tenant_id,
        user_repository=container.user_repository,
        demo_user_id=x_demo_user_id,
    )
    assert_can_manage_target_user(current_user, target=None, new_role=payload.role)

    existing = await container.user_repository.get_by_email(payload.tenant_id, payload.email)
    if existing is not None:
        raise HTTPException(status_code=409, detail="User with this email already exists")

    now = datetime.now(timezone.utc)
    user = User(
        id=str(uuid4()),
        tenant_id=payload.tenant_id,
        email=payload.email.lower().strip(),
        display_name=payload.display_name.strip(),
        role=payload.role,
        status=payload.status,
        created_at=now,
        updated_at=now,
    )
    created = await container.user_repository.create(user)
    return UserRead.from_domain(created)


@router.get("/{user_id}", response_model=UserRead)
async def get_user(
    user_id: str,
    tenant_id: str,
    container: AppContainer = Depends(get_container),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, Permission.manage_users)
    user = await container.user_repository.get_by_id(tenant_id, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return UserRead.from_domain(user)


@router.put("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: str,
    payload: UserUpdate,
    tenant_id: str,
    container: AppContainer = Depends(get_container),
    current_user: User = Depends(get_current_user),
):
    user = await container.user_repository.get_by_id(tenant_id, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    new_role = payload.role if payload.role is not None else user.role
    assert_can_manage_target_user(current_user, target=user, new_role=new_role)

    updates: dict = {"updated_at": datetime.now(timezone.utc)}
    if payload.display_name is not None:
        updates["display_name"] = payload.display_name.strip()
    if payload.role is not None:
        updates["role"] = payload.role
    if payload.status is not None:
        updates["status"] = payload.status

    updated = user.model_copy(update=updates)
    saved = await container.user_repository.update(updated)
    return UserRead.from_domain(saved)


@router.delete("/{user_id}", response_model=UserRead)
async def delete_user(
    user_id: str,
    tenant_id: str,
    container: AppContainer = Depends(get_container),
    current_user: User = Depends(get_current_user),
):
    user = await container.user_repository.get_by_id(tenant_id, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    assert_can_manage_target_user(current_user, target=user)

    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot disable the current user")

    disabled = user.model_copy(
        update={
            "status": UserStatus.disabled,
            "updated_at": datetime.now(timezone.utc),
        }
    )
    saved = await container.user_repository.update(disabled)
    return UserRead.from_domain(saved)
