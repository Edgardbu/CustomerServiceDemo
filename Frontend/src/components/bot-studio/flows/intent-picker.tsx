"use client";

import type { BotIntent } from "@/lib/types";
import {
  BOT_INTENT_LABELS,
  BOT_INTENTS,
} from "@/lib/flow-builder/intents";
import { cn } from "@/lib/utils";

interface IntentPickerProps {
  value: BotIntent[];
  onChange: (value: BotIntent[]) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function IntentPicker({
  value,
  onChange,
  disabled = false,
  compact = false,
}: IntentPickerProps) {
  function toggle(intent: BotIntent) {
    if (disabled) return;
    if (value.includes(intent)) {
      onChange(value.filter((item) => item !== intent));
      return;
    }
    onChange([...value, intent]);
  }

  return (
    <div
      className={cn(
        "flex flex-wrap gap-1.5",
        compact ? "max-h-24 overflow-y-auto" : "",
      )}
    >
      {BOT_INTENTS.map((intent) => {
        const selected = value.includes(intent);
        return (
          <button
            key={intent}
            type="button"
            disabled={disabled}
            onClick={() => toggle(intent)}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
              selected
                ? "bg-primary/12 text-primary ring-primary/30"
                : "bg-muted/40 text-muted-foreground ring-border hover:bg-muted",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            {BOT_INTENT_LABELS[intent]}
          </button>
        );
      })}
    </div>
  );
}
