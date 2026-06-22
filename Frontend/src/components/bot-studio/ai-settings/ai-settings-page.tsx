"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Loader2,
  MessageSquareText,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  aiSettingsEqual,
  EMPTY_AI_SETTINGS,
  normalizeAISettings,
} from "@/lib/ai-settings-form";
import { TENANT_ID } from "@/lib/constants";
import type { AISettings } from "@/lib/types";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function AISettingsPage() {
  const { showSuccess, showError } = useToast();

  const [settings, setSettings] = useState<AISettings>(EMPTY_AI_SETTINGS);
  const [savedSettings, setSavedSettings] =
    useState<AISettings>(EMPTY_AI_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isDirty = !aiSettingsEqual(settings, savedSettings);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = normalizeAISettings(await api.getAISettings(TENANT_ID));
      setSettings(data);
      setSavedSettings(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load AI settings";
      setLoadError(message);
      showError("Unable to load settings", message);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (!isDirty) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  function updateField<K extends keyof AISettings>(
    key: K,
    value: AISettings[K],
  ) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = normalizeAISettings(
        await api.updateAISettings(TENANT_ID, settings),
      );
      setSettings(updated);
      setSavedSettings(updated);
      showSuccess("Settings saved", "AI configuration was updated successfully.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save AI settings";
      showError("Save failed", message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <AISettingsSkeleton />;
  }

  if (loadError && aiSettingsEqual(settings, EMPTY_AI_SETTINGS)) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Unable to load AI settings</CardTitle>
            <CardDescription>{loadError}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" onClick={() => void loadSettings()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="sticky top-0 z-10 border-b border-border bg-background/90 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-violet-500" />
              <h1 className="text-xl font-semibold tracking-tight">AI Settings</h1>
              {isDirty ? (
                <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-500/30 dark:text-amber-300">
                  Unsaved changes
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Configure AI behavior, tone, and approval rules. Put factual
              content in Knowledge Base.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !isDirty}
            className="shrink-0"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save changes
          </Button>
        </div>

        {isDirty ? (
          <div className="mx-auto mt-3 flex max-w-4xl items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              You have unsaved changes. Save before leaving this page to keep
              your updates.
            </span>
          </div>
        ) : null}
      </div>

      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
        <SettingsSection
          icon={SlidersHorizontal}
          title="General"
          description="Control whether AI is active and can reply automatically."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <ToggleCard
              label="AI Enabled"
              description="Turn on AI assistance for agents and automated customer replies."
              checked={settings.ai_enabled}
              onChange={(value) => {
                updateField("ai_enabled", value);
                if (!value) updateField("auto_reply_enabled", false);
              }}
              disabled={saving}
            />
            <ToggleCard
              label="Auto Reply Enabled"
              description="Allow the AI to send responses without agent intervention."
              checked={settings.auto_reply_enabled}
              onChange={(value) => updateField("auto_reply_enabled", value)}
              disabled={saving || !settings.ai_enabled}
            />
          </div>
        </SettingsSection>

        <SettingsSection
          icon={Building2}
          title="Business Context"
          description="A short overview of your business for the AI."
        >
          <TextField
            label="Business context"
            hint="Short high-level description of the business. Do not put menus, prices, or FAQs here."
            value={settings.business_backstory}
            onChange={(value) => updateField("business_backstory", value)}
            placeholder="We are a cloud hosting provider serving SMBs. We offer managed VPS and 24/7 support…"
            rows={8}
            disabled={saving}
          />
        </SettingsSection>

        <SettingsSection
          icon={MessageSquareText}
          title="Tone Instructions"
          description="Guide how the AI should sound in customer conversations."
        >
          <TextField
            label="Tone instructions"
            hint="How the AI should sound when replying to customers."
            value={settings.tone_instructions}
            onChange={(value) => updateField("tone_instructions", value)}
            placeholder="Professional, concise, friendly. Reply in the customer's language."
            rows={6}
            disabled={saving}
          />
        </SettingsSection>

        <SettingsSection
          icon={ShieldCheck}
          title="Approval Rules"
          description="When the AI must pause for human review or hand off."
        >
          <TextField
            label="Approval rules"
            hint="Rules for when the AI must ask for human approval or hand off to a human."
            value={settings.approval_rules}
            onChange={(value) => updateField("approval_rules", value)}
            placeholder="Always require approval for custom pricing, refunds, legal requests, or angry customers threatening to cancel…"
            rows={7}
            disabled={saving}
          />
        </SettingsSection>

        <SettingsSection
          icon={Sparkles}
          title="Approval Handoff Message"
          description="Automatic customer message while waiting for human review."
        >
          <TextField
            label="Approval handoff message"
            hint="Message automatically sent to the customer when the AI needs human review."
            value={settings.approval_handoff_message}
            onChange={(value) => updateField("approval_handoff_message", value)}
            placeholder="One moment — I'm checking with a team member to make sure you get an accurate answer."
            rows={5}
            disabled={saving}
          />
        </SettingsSection>
      </div>
    </div>
  );
}

function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="border-b border-border/60 bg-muted/20">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-5">{children}</CardContent>
    </Card>
  );
}

function ToggleCard({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-border bg-card/60 p-4 transition-colors hover:bg-card">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted",
          disabled && "opacity-50",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
            checked ? "start-5" : "start-0.5",
          )}
        />
      </button>
    </label>
  );
}

function TextField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  rows,
  disabled,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows: number;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div>
        <label className="text-sm font-medium">{label}</label>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className="min-h-[120px] resize-y bg-background text-sm leading-relaxed"
      />
    </div>
  );
}

export function AISettingsSkeleton() {
  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-full max-w-md" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
