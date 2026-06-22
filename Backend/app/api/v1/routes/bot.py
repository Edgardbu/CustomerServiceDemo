from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response

from app.api.dependencies import get_container
from app.core.container import AppContainer
from app.domain.models.bot_flow import BotFlow
from app.schemas.bot_flow import (
    BotFlowCreate,
    BotFlowRead,
    BotFlowUpdate,
)

router = APIRouter()


@router.get("/flows", response_model=list[BotFlowRead])
async def list_bot_flows(
    tenant_id: str,
    container: AppContainer = Depends(get_container),
):
    flows = await container.bot_flow_repository.list_by_tenant(tenant_id)
    return [BotFlowRead.from_domain(flow) for flow in flows]


@router.post("/flows", response_model=BotFlowRead, status_code=201)
async def create_bot_flow(
    payload: BotFlowCreate,
    container: AppContainer = Depends(get_container),
):
    now = datetime.now(timezone.utc)
    flow = BotFlow(
        id=str(uuid4()),
        tenant_id=payload.tenant_id,
        name=payload.name.strip(),
        description=payload.description.strip(),
        trigger_intents=payload.trigger_intents,
        enabled=payload.enabled,
        version=payload.version,
        definition=payload.definition,
        created_at=now,
        updated_at=now,
    )
    flow = await container.bot_flow_repository.create(flow)
    return BotFlowRead.from_domain(flow)


@router.get("/flows/{flow_id}", response_model=BotFlowRead)
async def get_bot_flow(
    flow_id: str,
    tenant_id: str,
    container: AppContainer = Depends(get_container),
):
    flow = await container.bot_flow_repository.get_by_id(tenant_id, flow_id)
    if flow is None:
        raise HTTPException(status_code=404, detail="Bot flow not found")
    return BotFlowRead.from_domain(flow)


@router.put("/flows/{flow_id}", response_model=BotFlowRead)
async def update_bot_flow(
    flow_id: str,
    payload: BotFlowUpdate,
    container: AppContainer = Depends(get_container),
):
    existing = await container.bot_flow_repository.get_by_id(payload.tenant_id, flow_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Bot flow not found")

    flow = existing.model_copy(
        update={
            "name": payload.name.strip(),
            "description": payload.description.strip(),
            "trigger_intents": payload.trigger_intents,
            "enabled": payload.enabled,
            "version": payload.version,
            "definition": payload.definition,
            "updated_at": datetime.now(timezone.utc),
        }
    )
    flow = await container.bot_flow_repository.update(flow)
    return BotFlowRead.from_domain(flow)


@router.delete("/flows/{flow_id}", status_code=204)
async def delete_bot_flow(
    flow_id: str,
    tenant_id: str,
    container: AppContainer = Depends(get_container),
):
    existing = await container.bot_flow_repository.get_by_id(tenant_id, flow_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Bot flow not found")
    await container.bot_flow_repository.delete(tenant_id, flow_id)
    return Response(status_code=204)
