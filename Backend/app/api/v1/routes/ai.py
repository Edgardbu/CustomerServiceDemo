from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_container
from app.core.container import AppContainer
from app.domain.models.ai import AISettings, ApprovalStatus, DEFAULT_APPROVAL_HANDOFF_MESSAGE
from app.schemas.ai import (
    AIApprovalRead,
    AISettingsRead,
    AISettingsUpdate,
    ApprovalActionRequest,
    EditAndSendRequest,
)
from app.services.ai_approvals import approve_request, edit_and_send_request, reject_request

router = APIRouter()


def _default_settings(tenant_id: str) -> AISettingsRead:
    return AISettingsRead.from_domain(AISettings(tenant_id=tenant_id))


def _settings_from_update(
    *,
    tenant_id: str,
    payload: AISettingsUpdate,
    existing: AISettings | None,
) -> AISettings:
    """Map API update to domain model, preserving deprecated DB columns unchanged."""
    now = datetime.now(timezone.utc)
    return AISettings(
        id=existing.id if existing else str(uuid4()),
        tenant_id=tenant_id,
        enabled=payload.enabled,
        auto_reply_enabled=payload.auto_reply_enabled,
        business_context=payload.business_context,
        tone_instructions=payload.tone_instructions,
        approval_rules=payload.approval_rules,
        approval_handoff_message=payload.approval_handoff_message or DEFAULT_APPROVAL_HANDOFF_MESSAGE,
        # Deprecated columns: preserve existing DB values; ignore payload faq/ai_purpose.
        ai_purpose=existing.ai_purpose if existing else "",
        faq=existing.faq if existing else "",
        created_at=existing.created_at if existing else now,
        updated_at=now,
    )


@router.get("/settings", response_model=AISettingsRead)
async def get_ai_settings(
    tenant_id: str,
    container: AppContainer = Depends(get_container),
):
    settings = await container.ai_settings_repository.get_by_tenant(tenant_id)
    if settings is None:
        return _default_settings(tenant_id)
    return AISettingsRead.from_domain(settings)


@router.put("/settings", response_model=AISettingsRead)
async def update_ai_settings(
    payload: AISettingsUpdate,
    tenant_id: str,
    container: AppContainer = Depends(get_container),
):
    existing = await container.ai_settings_repository.get_by_tenant(tenant_id)
    settings = _settings_from_update(
        tenant_id=tenant_id,
        payload=payload,
        existing=existing,
    )
    saved = await container.ai_settings_repository.upsert(settings)
    return AISettingsRead.from_domain(saved)


@router.get("/approvals", response_model=list[AIApprovalRead])
async def list_approvals(
    tenant_id: str,
    status: ApprovalStatus | None = ApprovalStatus.pending,
    container: AppContainer = Depends(get_container),
):
    approvals = await container.ai_approval_repository.list_by_tenant(
        tenant_id=tenant_id,
        status=status,
    )
    return [AIApprovalRead.from_domain(approval) for approval in approvals]


@router.post("/approvals/{approval_id}/approve", response_model=AIApprovalRead)
async def approve_ai_response(
    approval_id: str,
    payload: ApprovalActionRequest,
    container: AppContainer = Depends(get_container),
):
    try:
        approval = await approve_request(
            container=container,
            tenant_id=payload.tenant_id,
            approval_id=approval_id,
        )
        return AIApprovalRead.from_domain(approval)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/approvals/{approval_id}/reject", response_model=AIApprovalRead)
async def reject_ai_response(
    approval_id: str,
    payload: ApprovalActionRequest,
    container: AppContainer = Depends(get_container),
):
    try:
        approval = await reject_request(
            container=container,
            tenant_id=payload.tenant_id,
            approval_id=approval_id,
        )
        return AIApprovalRead.from_domain(approval)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/approvals/{approval_id}/edit-and-send", response_model=AIApprovalRead)
async def edit_and_send_ai_response(
    approval_id: str,
    payload: EditAndSendRequest,
    container: AppContainer = Depends(get_container),
):
    try:
        approval = await edit_and_send_request(
            container=container,
            tenant_id=payload.tenant_id,
            approval_id=approval_id,
            final_response=payload.final_response,
        )
        return AIApprovalRead.from_domain(approval)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
