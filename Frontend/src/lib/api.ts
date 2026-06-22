import type {
  AIApproval,
  AISettings,
  AISuggestionResponse,
  Conversation,
  ConversationAINotes,
  ConversationQueue,
  CustomerProfile,
  CreateConversationRequest,
  EditAndSendApprovalRequest,
  HealthResponse,
  KnowledgeDocument,
  KnowledgeSearchRequest,
  KnowledgeSearchResponse,
  CreateKnowledgeDocumentRequest,
  UpdateKnowledgeDocumentRequest,
  BotFlow,
  BotFlowSession,
  CreateBotFlowRequest,
  UpdateBotFlowRequest,
  FlowDefinition,
  Message,
  SendMessageRequest,
  SuggestReplyRequest,
  Tenant,
  TenantUser,
  UpdateCustomerProfileRequest,
  CreateTenantUserRequest,
  UpdateTenantUserRequest,
  BootstrapStatus,
  BootstrapOwnerRequest,
  Channel,
  DemoChannelInboundRequest,
  DemoChannelInboundResponse,
} from "./types";
import { getApiUrl } from "./env";
import { getStoredDemoUserId } from "./demo-auth";
import {
  aiSettingsFromApi,
  aiSettingsToApi,
  type AISettingsApiResponse,
} from "./ai-settings-map";
import {
  approvalFromApi,
  isPendingApproval,
  type AIApprovalApiResponse,
} from "./approval-map";

const API_PREFIX = "/api/v1";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${getApiUrl()}${path}`;

  const demoUserId = getStoredDemoUserId();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (demoUserId) {
    headers["X-Demo-User-Id"] = demoUserId;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      "Unable to reach the backend. Make sure the API server is running.",
    );
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (typeof body?.detail === "string") message = body.detail;
      else if (Array.isArray(body?.detail))
        message = body.detail.map((d: { msg?: string }) => d.msg).join(", ");
      else if (typeof body?.message === "string") message = body.message;
    } catch {
      const text = await response.text().catch(() => "");
      if (text) message = text;
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function normalizeList<T>(data: T[] | { items?: T[] }): T[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}

function normalizeBotFlow(data: BotFlow): BotFlow {
  return {
    ...data,
    description: data.description ?? "",
    trigger_intents: Array.isArray(data.trigger_intents)
      ? (data.trigger_intents as BotFlow["trigger_intents"])
      : [],
    enabled: Boolean(data.enabled),
    version: typeof data.version === "number" ? data.version : 1,
    created_at: data.created_at ?? "",
    updated_at: data.updated_at ?? "",
    definition: normalizeFlowDefinition(data.definition),
  };
}

function normalizeBotFlowSession(data: BotFlowSession): BotFlowSession {
  return {
    ...data,
    flow_name: data.flow_name ?? null,
    current_node_id: data.current_node_id ?? null,
    state:
      data.state && typeof data.state === "object" && !Array.isArray(data.state)
        ? data.state
        : {},
    created_at: data.created_at ?? "",
    updated_at: data.updated_at ?? "",
  };
}

function normalizeFlowDefinition(definition: FlowDefinition | undefined): FlowDefinition {
  if (!definition || typeof definition !== "object") {
    return { nodes: [], edges: [] };
  }
  return {
    nodes: Array.isArray(definition.nodes) ? definition.nodes : [],
    edges: Array.isArray(definition.edges) ? definition.edges : [],
  };
}

function normalizeKnowledgeDocument(data: KnowledgeDocument): KnowledgeDocument {
  return {
    ...data,
    tags: Array.isArray(data.tags) ? data.tags : [],
    enabled: Boolean(data.enabled),
  };
}

function normalizeSearchChunk(
  item: Record<string, unknown>,
): KnowledgeSearchResponse["chunks"][number] {
  return {
    id: typeof item.id === "string" ? item.id : "",
    tenant_id: typeof item.tenant_id === "string" ? item.tenant_id : "",
    document_id:
      typeof item.document_id === "string" ? item.document_id : "",
    content: typeof item.content === "string" ? item.content : "",
    chunk_index:
      typeof item.chunk_index === "number" ? item.chunk_index : 0,
    score: typeof item.score === "number" ? item.score : null,
    metadata:
      item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
        ? (item.metadata as Record<string, unknown>)
        : null,
    created_at:
      typeof item.created_at === "string" ? item.created_at : "",
  };
}

function normalizeSearchResults(data: unknown): KnowledgeSearchResponse {
  const record =
    data && typeof data === "object"
      ? (data as Record<string, unknown>)
      : {};

  const chunks = Array.isArray(record.chunks)
    ? record.chunks
    : Array.isArray(record.results)
      ? record.results
      : Array.isArray(record.matched_chunks)
        ? record.matched_chunks
        : [];

  const documents = Array.isArray(record.documents)
    ? record.documents.map((doc) =>
        normalizeKnowledgeDocument(doc as KnowledgeDocument),
      )
    : [];

  return {
    query: typeof record.query === "string" ? record.query : "",
    chunks: chunks.map((item) =>
      normalizeSearchChunk(item as Record<string, unknown>),
    ),
    documents,
  };
}

function readPendingApproval(
  value: unknown,
): AIApproval | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!value || typeof value !== "object") return undefined;
  const approval = approvalFromApi(value as AIApprovalApiResponse);
  return isPendingApproval(approval) ? approval : null;
}

function normalizeCustomerProfile(data: CustomerProfile): CustomerProfile {
  return {
    external_id: data.external_id,
    channel: data.channel,
    display_name: data.display_name ?? null,
    username: data.username ?? null,
    profile_picture_url: data.profile_picture_url ?? null,
    agent_label: data.agent_label ?? null,
    agent_notes: data.agent_notes ?? null,
    profile_overridden: Boolean(data.profile_overridden),
  };
}

function normalizeConversation(data: Conversation): Conversation {
  const record = data as Conversation & { pending_ai_approval?: unknown };
  const pending_ai_approval = readPendingApproval(record.pending_ai_approval);

  return {
    ...data,
    tags: Array.isArray(data.tags) ? data.tags : [],
    ...(pending_ai_approval !== undefined ? { pending_ai_approval } : {}),
  };
}

function normalizeConversations(
  data: Conversation[] | { items?: Conversation[] },
): Conversation[] {
  return normalizeList(data).map(normalizeConversation);
}

export const api = {
  health(): Promise<HealthResponse> {
    return request<HealthResponse>("/health");
  },

  getTenant(tenantId: string): Promise<Tenant> {
    return request<Tenant>(`${API_PREFIX}/tenants/${tenantId}`);
  },

  async getConversations(params: {
    tenant_id: string;
    queue?: ConversationQueue;
    channel?: string;
  }): Promise<Conversation[]> {
    const search = new URLSearchParams({ tenant_id: params.tenant_id });
    if (params.queue) search.set("queue", params.queue);
    if (params.channel) search.set("channel", params.channel);

    const data = await request<Conversation[] | { items?: Conversation[] }>(
      `${API_PREFIX}/conversations?${search.toString()}`,
    );
    return normalizeConversations(data);
  },

  async getConversation(
    conversationId: string,
    tenantId: string,
  ): Promise<Conversation> {
    const search = new URLSearchParams({ tenant_id: tenantId });
    const data = await request<Conversation>(
      `${API_PREFIX}/conversations/${conversationId}?${search.toString()}`,
    );
    return normalizeConversation(data);
  },

  async createConversation(body: CreateConversationRequest): Promise<Conversation> {
    const data = await request<Conversation>(`${API_PREFIX}/conversations`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return normalizeConversation(data);
  },

  claimConversation(
    conversationId: string,
    tenantId: string,
  ): Promise<Conversation> {
    return request<Conversation>(
      `${API_PREFIX}/conversations/${conversationId}/claim`,
      {
        method: "POST",
        body: JSON.stringify({ tenant_id: tenantId }),
      },
    ).then(normalizeConversation);
  },

  assignConversation(
    conversationId: string,
    tenantId: string,
    agentId: string,
  ): Promise<Conversation> {
    return request<Conversation>(
      `${API_PREFIX}/conversations/${conversationId}/assign`,
      {
        method: "POST",
        body: JSON.stringify({ tenant_id: tenantId, agent_id: agentId }),
      },
    ).then(normalizeConversation);
  },

  transferConversation(
    conversationId: string,
    tenantId: string,
    agentId: string,
  ): Promise<Conversation> {
    return request<Conversation>(
      `${API_PREFIX}/conversations/${conversationId}/transfer`,
      {
        method: "POST",
        body: JSON.stringify({ tenant_id: tenantId, agent_id: agentId }),
      },
    ).then(normalizeConversation);
  },

  sendMessage(
    conversationId: string,
    body: SendMessageRequest,
  ): Promise<Message> {
    return request<Message>(
      `${API_PREFIX}/conversations/${conversationId}/messages`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  },

  updateCustomerProfile(
    channel: Channel,
    externalId: string,
    body: UpdateCustomerProfileRequest,
  ): Promise<CustomerProfile> {
    const encoded = encodeURIComponent(externalId);
    return request<CustomerProfile>(
      `${API_PREFIX}/customer-profiles/${channel}/${encoded}`,
      {
        method: "PUT",
        body: JSON.stringify(body),
      },
    ).then(normalizeCustomerProfile);
  },

  suggestReply(
    conversationId: string,
    body: SuggestReplyRequest,
  ): Promise<AISuggestionResponse> {
    return request<AISuggestionResponse>(
      `${API_PREFIX}/conversations/${conversationId}/ai/suggest-reply`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  },

  async getAISettings(tenantId: string): Promise<AISettings> {
    const search = new URLSearchParams({ tenant_id: tenantId });
    const data = await request<AISettingsApiResponse>(
      `${API_PREFIX}/ai/settings?${search.toString()}`,
    );
    return aiSettingsFromApi(data);
  },

  async updateAISettings(
    tenantId: string,
    body: AISettings,
  ): Promise<AISettings> {
    const search = new URLSearchParams({ tenant_id: tenantId });
    const data = await request<AISettingsApiResponse>(
      `${API_PREFIX}/ai/settings?${search.toString()}`,
      {
        method: "PUT",
        body: JSON.stringify(aiSettingsToApi(body, tenantId)),
      },
    );
    return aiSettingsFromApi(data);
  },

  getConversationAINotes(
    conversationId: string,
    tenantId: string,
  ): Promise<ConversationAINotes> {
    const search = new URLSearchParams({ tenant_id: tenantId });
    return request<ConversationAINotes>(
      `${API_PREFIX}/conversations/${conversationId}/ai-notes?${search.toString()}`,
    );
  },

  updateConversationAINotes(
    conversationId: string,
    tenantId: string,
    notes: string,
  ): Promise<ConversationAINotes> {
    const search = new URLSearchParams({ tenant_id: tenantId });
    return request<ConversationAINotes>(
      `${API_PREFIX}/conversations/${conversationId}/ai-notes?${search.toString()}`,
      {
        method: "PUT",
        body: JSON.stringify({ notes }),
      },
    );
  },

  pauseConversationAI(
    conversationId: string,
    tenantId: string,
  ): Promise<Conversation> {
    const search = new URLSearchParams({ tenant_id: tenantId });
    return request<Conversation>(
      `${API_PREFIX}/conversations/${conversationId}/ai/pause?${search.toString()}`,
      { method: "POST" },
    );
  },

  resumeConversationAI(
    conversationId: string,
    tenantId: string,
  ): Promise<Conversation> {
    const search = new URLSearchParams({ tenant_id: tenantId });
    return request<Conversation>(
      `${API_PREFIX}/conversations/${conversationId}/ai/resume?${search.toString()}`,
      { method: "POST" },
    );
  },

  async getPendingApprovals(tenantId: string): Promise<AIApproval[]> {
    const search = new URLSearchParams({
      tenant_id: tenantId,
      status: "pending",
    });
    const data = await request<AIApprovalApiResponse[]>(
      `${API_PREFIX}/ai/approvals?${search.toString()}`,
    );
    const list = Array.isArray(data) ? data : [];
    return list.map(approvalFromApi).filter(isPendingApproval);
  },

  async getConversationApproval(
    conversationId: string,
    tenantId: string,
  ): Promise<AIApproval | null> {
    const search = new URLSearchParams({ tenant_id: tenantId });
    try {
      const data = await request<AIApprovalApiResponse>(
        `${API_PREFIX}/conversations/${conversationId}/ai/approval?${search.toString()}`,
      );
      const approval = approvalFromApi(data);
      return isPendingApproval(approval) ? approval : null;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        const pending = await this.getPendingApprovals(tenantId);
        return (
          pending.find((item) => item.conversation_id === conversationId) ??
          null
        );
      }
      throw err;
    }
  },

  approveAIApproval(approvalId: string, tenantId: string): Promise<unknown> {
    return request(`${API_PREFIX}/ai/approvals/${approvalId}/approve`, {
      method: "POST",
      body: JSON.stringify({ tenant_id: tenantId }),
    });
  },

  editAndSendAIApproval(
    approvalId: string,
    tenantId: string,
    body: EditAndSendApprovalRequest,
  ): Promise<unknown> {
    return request(`${API_PREFIX}/ai/approvals/${approvalId}/edit-and-send`, {
      method: "POST",
      body: JSON.stringify({ tenant_id: tenantId, ...body }),
    });
  },

  rejectAIApproval(approvalId: string, tenantId: string): Promise<unknown> {
    return request(`${API_PREFIX}/ai/approvals/${approvalId}/reject`, {
      method: "POST",
      body: JSON.stringify({ tenant_id: tenantId }),
    });
  },

  async getKnowledgeDocuments(tenantId: string): Promise<KnowledgeDocument[]> {
    const search = new URLSearchParams({ tenant_id: tenantId });
    const data = await request<KnowledgeDocument[] | { items?: KnowledgeDocument[] }>(
      `${API_PREFIX}/knowledge/documents?${search.toString()}`,
    );
    return normalizeList(data).map(normalizeKnowledgeDocument);
  },

  async getKnowledgeDocument(
    documentId: string,
    tenantId: string,
  ): Promise<KnowledgeDocument> {
    const search = new URLSearchParams({ tenant_id: tenantId });
    const data = await request<KnowledgeDocument>(
      `${API_PREFIX}/knowledge/documents/${documentId}?${search.toString()}`,
    );
    return normalizeKnowledgeDocument(data);
  },

  async createKnowledgeDocument(
    body: CreateKnowledgeDocumentRequest,
  ): Promise<KnowledgeDocument> {
    const data = await request<KnowledgeDocument>(
      `${API_PREFIX}/knowledge/documents`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
    return normalizeKnowledgeDocument(data);
  },

  async updateKnowledgeDocument(
    documentId: string,
    body: UpdateKnowledgeDocumentRequest,
  ): Promise<KnowledgeDocument> {
    const data = await request<KnowledgeDocument>(
      `${API_PREFIX}/knowledge/documents/${documentId}`,
      {
        method: "PUT",
        body: JSON.stringify(body),
      },
    );
    return normalizeKnowledgeDocument(data);
  },

  deleteKnowledgeDocument(
    documentId: string,
    tenantId: string,
  ): Promise<void> {
    const search = new URLSearchParams({ tenant_id: tenantId });
    return request<void>(
      `${API_PREFIX}/knowledge/documents/${documentId}?${search.toString()}`,
      { method: "DELETE" },
    );
  },

  async searchKnowledge(
    body: KnowledgeSearchRequest,
  ): Promise<KnowledgeSearchResponse> {
    const payload = {
      tenant_id: body.tenant_id,
      query: body.query,
      limit: body.limit ?? 10,
    };
    const data = await request<unknown>(`${API_PREFIX}/knowledge/search`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return normalizeSearchResults(data);
  },

  async getBotFlows(tenantId: string): Promise<BotFlow[]> {
    const search = new URLSearchParams({ tenant_id: tenantId });
    const data = await request<BotFlow[] | { items?: BotFlow[] }>(
      `${API_PREFIX}/bot/flows?${search.toString()}`,
    );
    return normalizeList(data).map(normalizeBotFlow);
  },

  async getBotFlow(flowId: string, tenantId: string): Promise<BotFlow> {
    const search = new URLSearchParams({ tenant_id: tenantId });
    const data = await request<BotFlow>(
      `${API_PREFIX}/bot/flows/${flowId}?${search.toString()}`,
    );
    return normalizeBotFlow(data);
  },

  async createBotFlow(body: CreateBotFlowRequest): Promise<BotFlow> {
    const data = await request<BotFlow>(`${API_PREFIX}/bot/flows`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return normalizeBotFlow(data);
  },

  async updateBotFlow(
    flowId: string,
    body: UpdateBotFlowRequest,
  ): Promise<BotFlow> {
    const data = await request<BotFlow>(`${API_PREFIX}/bot/flows/${flowId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return normalizeBotFlow(data);
  },

  deleteBotFlow(flowId: string, tenantId: string): Promise<void> {
    const search = new URLSearchParams({ tenant_id: tenantId });
    return request<void>(
      `${API_PREFIX}/bot/flows/${flowId}?${search.toString()}`,
      { method: "DELETE" },
    );
  },

  async getConversationFlowSession(
    conversationId: string,
    tenantId: string,
  ): Promise<BotFlowSession | null> {
    const search = new URLSearchParams({ tenant_id: tenantId });
    try {
      const data = await request<BotFlowSession>(
        `${API_PREFIX}/conversations/${conversationId}/flow-session?${search.toString()}`,
      );
      return normalizeBotFlowSession(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        return null;
      }
      throw err;
    }
  },

  cancelConversationFlowSession(
    conversationId: string,
    tenantId: string,
  ): Promise<void> {
    return request<void>(
      `${API_PREFIX}/conversations/${conversationId}/flow-session/cancel`,
      {
        method: "POST",
        body: JSON.stringify({ tenant_id: tenantId }),
      },
    );
  },

  getTenantUsers(tenantId: string): Promise<TenantUser[]> {
    const search = new URLSearchParams({ tenant_id: tenantId });
    return request<TenantUser[]>(`${API_PREFIX}/users?${search.toString()}`);
  },

  createTenantUser(body: CreateTenantUserRequest): Promise<TenantUser> {
    return request<TenantUser>(`${API_PREFIX}/users`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  updateTenantUser(
    userId: string,
    body: UpdateTenantUserRequest,
  ): Promise<TenantUser> {
    return request<TenantUser>(`${API_PREFIX}/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  disableTenantUser(userId: string, tenantId: string): Promise<void> {
    const search = new URLSearchParams({ tenant_id: tenantId });
    return request<void>(
      `${API_PREFIX}/users/${userId}?${search.toString()}`,
      { method: "DELETE" },
    );
  },

  getBootstrapStatus(tenantId: string): Promise<BootstrapStatus> {
    const search = new URLSearchParams({ tenant_id: tenantId });
    return request<BootstrapStatus>(
      `${API_PREFIX}/bootstrap/status?${search.toString()}`,
    );
  },

  bootstrapOwner(body: BootstrapOwnerRequest): Promise<TenantUser> {
    return request<TenantUser>(`${API_PREFIX}/bootstrap/owner`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  demoChannelInbound(
    body: DemoChannelInboundRequest,
    demoSecret: string,
  ): Promise<DemoChannelInboundResponse> {
    return request<DemoChannelInboundResponse>(
      `${API_PREFIX}/demo/channels/inbound`,
      {
        method: "POST",
        headers: { "X-Demo-Secret": demoSecret },
        body: JSON.stringify(body),
      },
    );
  },
};
