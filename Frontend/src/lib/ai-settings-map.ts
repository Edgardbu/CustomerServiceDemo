import type { AISettings } from "./types";

/** Raw shape returned by FastAPI `/api/v1/ai/settings`. */
export interface AISettingsApiResponse {
  id?: string;
  tenant_id?: string;
  enabled: boolean;
  auto_reply_enabled: boolean;
  business_context: string;
  approval_rules: string;
  tone_instructions: string;
  approval_handoff_message?: string;
  created_at?: string;
  updated_at?: string;
  /** Legacy fields — ignored if present in cached or stale responses. */
  ai_purpose?: string;
  faq?: string;
}

export function aiSettingsFromApi(data: AISettingsApiResponse): AISettings {
  return {
    tenant_id: data.tenant_id,
    ai_enabled: Boolean(data.enabled),
    auto_reply_enabled: Boolean(data.auto_reply_enabled),
    business_backstory: data.business_context ?? "",
    approval_rules: data.approval_rules ?? "",
    tone_instructions: data.tone_instructions ?? "",
    approval_handoff_message: data.approval_handoff_message ?? "",
  };
}

export function aiSettingsToApi(
  settings: AISettings,
  tenantId: string,
): AISettingsApiResponse {
  return {
    tenant_id: tenantId,
    enabled: settings.ai_enabled,
    auto_reply_enabled: settings.auto_reply_enabled,
    business_context: settings.business_backstory,
    approval_rules: settings.approval_rules,
    tone_instructions: settings.tone_instructions,
    approval_handoff_message: settings.approval_handoff_message ?? "",
  };
}
