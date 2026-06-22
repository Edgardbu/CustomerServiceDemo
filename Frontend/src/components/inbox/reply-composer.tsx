"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Paperclip, SendHorizontal, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmojiPicker } from "@/components/inbox/emoji-picker";
import { cn } from "@/lib/utils";

const MAX_TEXTAREA_HEIGHT = 180;

interface ReplyComposerProps {
  disabled?: boolean;
  sending: boolean;
  onSend: (content: string) => Promise<void>;
}

export function ReplyComposer({ disabled, sending, onSend }: ReplyComposerProps) {
  const [draft, setDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-expand the textarea up to a max height.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [draft]);

  async function handleSend() {
    const content = draft.trim();
    if (!content || sending || disabled) return;
    setError(null);
    try {
      await onSend(content);
      setDraft("");
    } catch {
      setError("Couldn't send. Check your connection and try again.");
    }
  }

  return (
    <div className="sticky bottom-0 shrink-0 border-t border-border bg-card/80 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/60 sm:px-6">
      <div className="mx-auto max-w-3xl">
        {error ? (
          <p className="mb-1.5 px-1 text-xs text-destructive">{error}</p>
        ) : null}
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-background p-2 shadow-sm transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/30">
          <div className="flex items-center gap-0.5 pb-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={disabled}
              aria-label="Attach file"
              title="Attachments (coming soon)"
            >
              <Paperclip className="size-4 text-muted-foreground" />
            </Button>

            <div className="relative">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={disabled}
                aria-label="Insert emoji"
                aria-expanded={emojiOpen}
                onClick={() => setEmojiOpen((v) => !v)}
              >
                <Smile className="size-4 text-muted-foreground" />
              </Button>
              <EmojiPicker
                open={emojiOpen}
                onClose={() => setEmojiOpen(false)}
                onSelect={(emoji) => {
                  setDraft((d) => d + emoji);
                  textareaRef.current?.focus();
                }}
              />
            </div>
          </div>

          <textarea
            ref={textareaRef}
            placeholder={disabled ? "View-only access" : "Write a reply…"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={1}
            dir="auto"
            disabled={disabled}
            className="max-h-[180px] min-h-[40px] flex-1 resize-none self-center bg-transparent py-2 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />

          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || disabled || !draft.trim()}
            aria-label="Send message"
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition-all",
              "bg-gradient-to-br from-primary to-violet-500 hover:brightness-110 active:scale-95",
              "disabled:cursor-not-allowed disabled:from-muted disabled:to-muted disabled:text-muted-foreground disabled:shadow-none",
            )}
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <SendHorizontal className="size-4" />
            )}
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
          Press <kbd className="font-sans font-medium text-foreground/70">Enter</kbd> to send ·{" "}
          <kbd className="font-sans font-medium text-foreground/70">Shift+Enter</kbd> for new line
        </p>
      </div>
    </div>
  );
}
