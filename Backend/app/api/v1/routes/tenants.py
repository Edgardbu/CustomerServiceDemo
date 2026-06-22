from fastapi import APIRouter

router = APIRouter()


@router.get("/{tenant_id}")
async def get_tenant(tenant_id: str):
    return {
        "tenant_id": tenant_id,
        "name": "Demo Tenant",
        "status": "active",
    }
