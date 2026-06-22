import type { AISettings } from "@/lib/types";

export const EMPTY_AI_SETTINGS: AISettings = {
  ai_enabled: false,
  auto_reply_enabled: false,
  business_backstory: "",
  approval_rules: "",
  tone_instructions: "",
  approval_handoff_message: "",
};

export function normalizeAISettings(
  data: Partial<AISettings> & { faq?: string; ai_purpose?: string },
): AISettings {
  return {
    tenant_id: data.tenant_id,
    ai_enabled: data.ai_enabled ?? EMPTY_AI_SETTINGS.ai_enabled,
    auto_reply_enabled:
      data.auto_reply_enabled ?? EMPTY_AI_SETTINGS.auto_reply_enabled,
    business_backstory: data.business_backstory ?? "",
    approval_rules: data.approval_rules ?? "",
    tone_instructions: data.tone_instructions ?? "",
    approval_handoff_message: data.approval_handoff_message ?? "",
  };
}

export function aiSettingsEqual(a: AISettings, b: AISettings): boolean {
  return (
    a.ai_enabled === b.ai_enabled &&
    a.auto_reply_enabled === b.auto_reply_enabled &&
    a.business_backstory === b.business_backstory &&
    a.approval_rules === b.approval_rules &&
    a.tone_instructions === b.tone_instructions &&
    (a.approval_handoff_message ?? "") === (b.approval_handoff_message ?? "")
  );
}
