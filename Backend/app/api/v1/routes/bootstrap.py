from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_container
from app.core.config import Settings, get_settings
from app.core.container import AppContainer
from app.schemas.bootstrap import BootstrapOwnerCreate, BootstrapStatusRead
from app.schemas.users import UserRead
from app.services.bootstrap import BootstrapError, bootstrap_owner, get_bootstrap_status

router = APIRouter()


@router.get("/status", response_model=BootstrapStatusRead)
async def bootstrap_status(
    tenant_id: str,
    container: AppContainer = Depends(get_container),
    settings: Settings = Depends(get_settings),
):
    return await get_bootstrap_status(
        settings=settings,
        user_repository=container.user_repository,
        tenant_id=tenant_id,
    )


@router.post("/owner", response_model=UserRead, status_code=201)
async def create_bootstrap_owner(
    payload: BootstrapOwnerCreate,
    container: AppContainer = Depends(get_container),
    settings: Settings = Depends(get_settings),
):
    try:
        return await bootstrap_owner(
            settings=settings,
            user_repository=container.user_repository,
            tenant_id=payload.tenant_id,
            email=payload.email,
            display_name=payload.display_name,
            bootstrap_secret=payload.bootstrap_secret,
        )
    except BootstrapError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
