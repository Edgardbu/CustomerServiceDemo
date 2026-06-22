export type Channel =
  | "whatsapp"
  | "web_chat"
  | "email"
  | "sms"
  | "facebook"
  | "instagram";

export type ConversationStatus = "open" | "pending" | "resolved" | "closed";

export type SenderType = "customer" | "agent" | "bot" | "system";

export interface Attachment {
  id?: string;
  url?: string;
  name?: string;
  type?: string;
}

export type AiStatus = "active" | "paused" | "waiting_for_approval" | null;

export interface MessageExternalRawResponse {
  provider?: string;
  [key: string]: unknown;
}

export interface Message {
  id: string;
  conversation_id: string;
  tenant_id?: string;
  sender_type: SenderType;
  content: string;
  attachments: Attachment[];
  created_at: string;
  ai_generated?: boolean;
  external_raw_response?: MessageExternalRawResponse | null;
}

export interface CustomerProfile {
  external_id: string;
  channel: Channel;
  display_name: string | null;
  username: string | null;
  profile_picture_url: string | null;
  agent_label?: string | null;
  agent_notes?: string | null;
  profile_overridden?: boolean;
}

export interface UpdateCustomerProfileRequest {
  tenant_id: string;
  display_name: string | null;
  username: string | null;
  profile_picture_url: string | null;
  agent_label: string | null;
  agent_notes: string | null;
}

export interface Conversation {
  id: string;
  tenant_id: string;
  customer_id: string;
  channel: Channel;
  status: ConversationStatus;
  assigned_agent_id?: string | null;
  assigned_agent?: AssignedAgent | null;
  tags?: string[];
  messages?: Message[];
  customer_profile?: CustomerProfile | null;
  ai_status?: AiStatus;
  ai_auto_reply_enabled?: boolean | null;
  pending_ai_approval?: AIApprovalRequest | null;
  created_at?: string;
  updated_at?: string;
}

export interface Tenant {
  tenant_id: string;
  name: string;
  status: string;
}

export interface AssignedAgent {
  id: string;
  display_name: string;
  email: string;
  role: string;
  status: string;
}

export type ConversationQueue =
  | "human_needed"
  | "unassigned"
  | "mine"
  | "all"
  | "resolved";

export type TenantUserRole = "owner" | "admin" | "agent" | "viewer";
export type TenantUserStatus = "active" | "disabled";

export interface TenantUser {
  id: string;
  tenant_id: string;
  email: string;
  display_name: string;
  role: TenantUserRole;
  status: TenantUserStatus;
  created_at: string;
  updated_at: string;
  last_seen_at: string | null;
}

export interface CreateTenantUserRequest {
  tenant_id: string;
  email: string;
  display_name: string;
  role: TenantUserRole;
  status: TenantUserStatus;
}

export interface UpdateTenantUserRequest {
  display_name?: string;
  role?: TenantUserRole;
  status?: TenantUserStatus;
}

export interface BootstrapStatus {
  bootstrap_enabled: boolean;
  has_owner_or_admin: boolean;
  bootstrap_required: boolean;
}

export interface BootstrapOwnerRequest {
  tenant_id: string;
  email: string;
  display_name: string;
  bootstrap_secret: string;
}

export type DemoSimulatorChannel =
  | "instagram"
  | "facebook"
  | "whatsapp"
  | "sms"
  | "email";

export interface DemoChannelInboundRequest {
  tenant_id: string;
  channel: DemoSimulatorChannel;
  customer_id: string;
  display_name: string;
  username?: string | null;
  profile_picture_url?: string | null;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface DemoChannelInboundResponse {
  status?: string;
  conversation_id: string;
  external_message_id: string;
  channel: DemoSimulatorChannel;
}

export interface CreateConversationRequest {
  tenant_id: string;
  customer_id: string;
  channel: Channel;
}

export interface SendMessageRequest {
  tenant_id: string;
  sender_type: SenderType;
  content: string;
  attachments: Attachment[];
}

export interface SuggestReplyRequest {
  tenant_id: string;
  extra_instruction?: string;
}

export interface AIUsedKnowledge {
  document_id: string;
  title: string;
  chunk: string;
}

export interface AISuggestionResponse {
  conversation_id: string;
  suggested_reply: string;
  why_it_fits: string;
  confidence: number;
  used_knowledge: AIUsedKnowledge[];
}

export interface HealthResponse {
  status: string;
  env?: string;
  database?: string;
  database_status?: string;
  database_detail?: string | null;
  realtime?: string;
  storage?: string;
  ai?: string;
}

export interface ConversationFilters {
  queue?: ConversationQueue;
  channel?: Channel | "all";
  search?: string;
}

export interface AISettings {
  tenant_id?: string;
  ai_enabled: boolean;
  auto_reply_enabled: boolean;
  business_backstory: string;
  approval_rules: string;
  tone_instructions: string;
  approval_handoff_message: string;
}

export interface ConversationAINotes {
  conversation_id?: string;
  notes: string;
}

export interface AIApproval {
  id: string;
  conversation_id: string;
  tenant_id?: string;
  customer_summary?: string | null;
  reasoning_summary?: string | null;
  suggested_action_type?: string | null;
  risk_level?: string | null;
  suggested_response: string;
  status?: string;
  customer_notified_handoff?: boolean;
  created_at?: string;
}

export type AIApprovalRequest = AIApproval;

export const BOT_RUNTIME_TAGS = [
  "waiting_for_ai_approval",
  "handoff_to_human",
] as const;

export type BotRuntimeTag = (typeof BOT_RUNTIME_TAGS)[number];

export interface EditAndSendApprovalRequest {
  final_response: string;
}

export type KnowledgeDocumentType =
  | "faq"
  | "menu"
  | "policy"
  | "guide"
  | "script"
  | "other";

export interface KnowledgeDocument {
  id: string;
  tenant_id?: string;
  title: string;
  content: string;
  document_type: KnowledgeDocumentType;
  tags: string[];
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateKnowledgeDocumentRequest {
  tenant_id: string;
  title: string;
  content: string;
  document_type: KnowledgeDocumentType;
  tags: string[];
  enabled: boolean;
}

export interface UpdateKnowledgeDocumentRequest {
  tenant_id: string;
  title: string;
  content: string;
  document_type: KnowledgeDocumentType;
  tags: string[];
  enabled: boolean;
}

export interface KnowledgeSearchRequest {
  tenant_id: string;
  query: string;
  limit?: number;
}

export interface KnowledgeSearchChunk {
  id: string;
  tenant_id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  score: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface KnowledgeSearchResponse {
  query: string;
  chunks: KnowledgeSearchChunk[];
  documents: KnowledgeDocument[];
}

export type FlowNodeType =
  | "message"
  | "input"
  | "condition"
  | "action"
  | "approval"
  | "handoff"
  | "end";

export type BotIntent =
  | "faq_question"
  | "order_start"
  | "order_update"
  | "price_question"
  | "menu_question"
  | "delivery_question"
  | "payment_question"
  | "complaint"
  | "refund_request"
  | "discount_request"
  | "human_request"
  | "unknown";

export interface FlowGraphEdge {
  from: string;
  to: string;
}

export interface FlowDefinition {
  nodes: Array<Record<string, unknown>>;
  edges: FlowGraphEdge[];
}

export interface BotFlow {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  trigger_intents: BotIntent[];
  enabled: boolean;
  version: number;
  definition: FlowDefinition;
  created_at: string;
  updated_at: string;
}

export interface CreateBotFlowRequest {
  tenant_id: string;
  name: string;
  description?: string;
  trigger_intents: BotIntent[];
  enabled: boolean;
  version?: number;
  definition: FlowDefinition;
}

export interface UpdateBotFlowRequest {
  tenant_id: string;
  name: string;
  description?: string;
  trigger_intents: BotIntent[];
  enabled: boolean;
  version?: number;
  definition: FlowDefinition;
}

export type BotFlowSessionStatus =
  | "active"
  | "completed"
  | "cancelled"
  | "handed_off";

export interface BotFlowSession {
  id: string;
  tenant_id: string;
  conversation_id: string;
  flow_id: string;
  flow_name?: string | null;
  current_node_id: string | null;
  state: Record<string, unknown>;
  status: BotFlowSessionStatus;
  created_at: string;
  updated_at: string;
}
