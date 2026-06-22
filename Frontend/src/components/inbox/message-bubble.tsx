import { Bot, CheckCheck, FlaskConical, Sparkles, User } from "lucide-react";
import type { Message, SenderType } from "@/lib/types";
import { isSimulatedDemoMessage } from "@/lib/demo-channel";
import { formatMessageTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function senderLabel(senderType: SenderType, aiGenerated?: boolean): string {
  if (senderType === "bot") return "AI Assistant";
  if (senderType === "agent" && aiGenerated) return "You";
  switch (senderType) {
    case "customer":
      return "Customer";
    case "agent":
      return "You";
    case "system":
      return "System";
    default:
      return senderType;
  }
}

function outgoingStatusLabel(message: Message): string | null {
  if (message.sender_type === "agent" && message.ai_generated) {
    return "Sent by agent · AI-written";
  }
  if (message.ai_generated) return "AI-written";
  return null;
}

interface MessageBubbleProps {
  message: Message;
  customerName: string;
  showMeta?: boolean;
  showStatus?: boolean;
}

export function MessageBubble({
  message,
  customerName,
  showMeta = true,
  showStatus = true,
}: MessageBubbleProps) {
  const { sender_type: sender } = message;
  const outgoing = sender === "agent" || sender === "bot";
  const isSystem = sender === "system";
  const aiLabel = outgoingStatusLabel(message);
  const simulatedSend = isSimulatedDemoMessage(message);

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <span className="rounded-full bg-muted/60 px-3 py-1 text-[11px] text-muted-foreground">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex gap-3",
        outgoing ? "flex-row-reverse" : "flex-row",
        showMeta ? "mt-1" : "mt-0.5",
      )}
    >
      <div className="w-8 shrink-0">
        {showMeta ? (
          <div
            className={cn(
              "flex size-8 items-center justify-center rounded-full text-white shadow-sm",
              sender === "agent"
                ? "bg-gradient-to-br from-primary to-violet-500"
                : sender === "bot"
                  ? "bg-gradient-to-br from-violet-500 to-fuchsia-500"
                  : "bg-gradient-to-br from-slate-500 to-slate-600",
            )}
            aria-hidden
          >
            {sender === "bot" ? (
              <Bot className="size-4" />
            ) : sender === "agent" && message.ai_generated ? (
              <Sparkles className="size-4" />
            ) : (
              <User className="size-4" />
            )}
          </div>
        ) : null}
      </div>

      <div className={cn("flex max-w-[78%] flex-col", outgoing ? "items-end" : "items-start")}>
        {showMeta ? (
          <div className="mb-1 flex flex-wrap items-center gap-2 px-1 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground/70">
              {outgoing ? senderLabel(sender, message.ai_generated) : customerName}
            </span>
            <span>{formatMessageTime(message.created_at)}</span>
            {message.ai_generated && sender === "bot" ? (
              <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-300">
                AI-written
              </span>
            ) : null}
          </div>
        ) : null}

        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed shadow-sm",
            outgoing
              ? "rounded-ee-md bg-gradient-to-br from-primary to-indigo-600 text-primary-foreground"
              : "rounded-es-md border border-border bg-secondary text-foreground",
            sender === "bot" && "from-violet-600 to-fuchsia-600",
          )}
        >
          <p dir="auto" className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
            {message.content}
          </p>
        </div>

        {outgoing && showStatus ? (
          <div className="mt-1 flex flex-wrap items-center gap-1 px-1 text-[10px] text-muted-foreground">
            {simulatedSend ? (
              <Tooltip>
                <TooltipTrigger
                  className="inline-flex cursor-default items-center gap-1 rounded-sm underline decoration-dotted underline-offset-2"
                  type="button"
                >
                  <FlaskConical className="size-3 text-amber-600 dark:text-amber-400" />
                  Simulated send
                </TooltipTrigger>
                <TooltipContent>
                  This message was not sent to the real external platform.
                </TooltipContent>
              </Tooltip>
            ) : (
              <>
                <CheckCheck className="size-3 text-primary" />
                {aiLabel ?? "Delivered"}
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
