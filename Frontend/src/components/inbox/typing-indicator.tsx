import { cn } from "@/lib/utils";

interface TypingIndicatorProps {
  /** Name to show, e.g. "Tomer B." or "Agent". */
  name: string;
  /** Outgoing (agent) typing renders on the right. */
  outgoing?: boolean;
}

export function TypingIndicator({ name, outgoing = false }: TypingIndicatorProps) {
  return (
    <div className={cn("flex", outgoing ? "justify-end" : "justify-start")}>
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-secondary px-3.5 py-2.5 shadow-sm">
        <span className="flex items-center gap-1" aria-hidden>
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.3s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.15s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70" />
        </span>
        <span className="text-xs text-muted-foreground">{name} is typing…</span>
      </div>
    </div>
  );
}
