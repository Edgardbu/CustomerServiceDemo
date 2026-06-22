from datetime import datetime, timezone

from app.domain.models.ai import AIApprovalRequest, ApprovalStatus


class InMemoryAIApprovalRepository:
    def __init__(self) -> None:
        self._requests: dict[str, AIApprovalRequest] = {}

    def _key(self, tenant_id: str, approval_id: str) -> str:
        return f"{tenant_id}:{approval_id}"

    async def create(self, request: AIApprovalRequest) -> AIApprovalRequest:
        self._requests[self._key(request.tenant_id, request.id)] = request
        return request

    async def get_by_id(
        self,
        tenant_id: str,
        approval_id: str,
    ) -> AIApprovalRequest | None:
        return self._requests.get(self._key(tenant_id, approval_id))

    async def list_by_tenant(
        self,
        tenant_id: str,
        *,
        status: ApprovalStatus | None = None,
    ) -> list[AIApprovalRequest]:
        items = [
            request
            for request in self._requests.values()
            if request.tenant_id == tenant_id
        ]

        if status is not None:
            items = [request for request in items if request.status == status]

        return sorted(items, key=lambda request: request.created_at, reverse=True)

    async def get_pending_by_conversation(
        self,
        tenant_id: str,
        conversation_id: str,
    ) -> AIApprovalRequest | None:
        matches = [
            request
            for request in self._requests.values()
            if request.tenant_id == tenant_id
            and request.conversation_id == conversation_id
            and request.status == ApprovalStatus.pending
        ]
        if not matches:
            return None
        return max(matches, key=lambda request: request.created_at)

    async def update(self, request: AIApprovalRequest) -> AIApprovalRequest:
        key = self._key(request.tenant_id, request.id)
        if key not in self._requests:
            raise ValueError("Approval request not found")

        updated = request.model_copy(
            update={"updated_at": datetime.now(timezone.utc)}
        )
        self._requests[key] = updated
        return updated
