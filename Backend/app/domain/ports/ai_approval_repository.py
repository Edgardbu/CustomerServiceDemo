from typing import Protocol

from app.domain.models.ai import AIApprovalRequest, ApprovalStatus


class AIApprovalRepository(Protocol):
    async def create(self, request: AIApprovalRequest) -> AIApprovalRequest:
        ...

    async def get_by_id(
        self,
        tenant_id: str,
        approval_id: str,
    ) -> AIApprovalRequest | None:
        ...

    async def list_by_tenant(
        self,
        tenant_id: str,
        *,
        status: ApprovalStatus | None = None,
    ) -> list[AIApprovalRequest]:
        ...

    async def get_pending_by_conversation(
        self,
        tenant_id: str,
        conversation_id: str,
    ) -> AIApprovalRequest | None:
        ...

    async def update(self, request: AIApprovalRequest) -> AIApprovalRequest:
        ...
