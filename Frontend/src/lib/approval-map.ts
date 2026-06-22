import type { AIApproval } from "./types";

/** Raw shape returned by FastAPI `/api/v1/ai/approvals`. */
export interface AIApprovalApiResponse {
  id: string;
  tenant_id?: string;
  conversation_id: string;
  status?: string;
  customer_summary?: string | null;
  ai_reasoning_summary?: string | null;
  reasoning_summary?: string | null;
  suggested_response?: string;
  suggested_action_type?: string | null;
  risk_level?: string | null;
  requires_approval?: boolean;
  customer_notified_handoff?: boolean;
  created_at?: string;
  updated_at?: string;
}

export function isPendingApproval(approval: AIApproval): boolean {
  return !approval.status || approval.status === "pending";
}

export function approvalFromApi(data: AIApprovalApiResponse): AIApproval {
  return {
    id: data.id,
    conversation_id: data.conversation_id,
    tenant_id: data.tenant_id,
    customer_summary: data.customer_summary ?? null,
    reasoning_summary:
      data.ai_reasoning_summary ?? data.reasoning_summary ?? null,
    suggested_action_type: data.suggested_action_type ?? null,
    risk_level: data.risk_level ?? null,
    suggested_response: data.suggested_response ?? "",
    status: data.status,
    customer_notified_handoff: data.customer_notified_handoff ?? false,
    created_at: data.created_at,
  };
}
