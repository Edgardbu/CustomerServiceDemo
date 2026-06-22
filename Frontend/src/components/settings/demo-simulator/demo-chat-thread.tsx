"use client";

import { useEffect, useRef } from "react";
import { Bot, User } from "lucide-react";
import type { Message } from "@/lib/types";
import { formatMessageTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface DemoChatThreadProps {
  messages: Message[];
  customerName: string;
  loading?: boolean;
}

function senderTitle(message: Message): string {
  switch (message.sender_type) {
    case "customer":
      return "You";
    case "agent":
      return "Agent";
    case "bot":
      return "AI";
    case "system":
      return "System";
    default:
      return message.sender_type;
  }
}

function DemoChatBubble({
  message,
  customerName,
}: {
  message: Message;
  customerName: string;
}) {
  if (message.sender_type === "system") {
    return (
      <div className="flex justify-center">
        <span className="rounded-full bg-muted/60 px-3 py-1 text-[11px] text-muted-foreground">
          {message.content}
        </span>
      </div>
    );
  }

  const isCustomer = message.sender_type === "customer";

  return (
    <div
      className={cn(
        "flex gap-2",
        isCustomer ? "justify-end" : "justify-start",
      )}
    >
      {!isCustomer ? (
        <div
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full text-white shadow-sm",
            message.sender_type === "bot"
              ? "bg-gradient-to-br from-violet-500 to-fuchsia-500"
              : "bg-gradient-to-br from-primary to-violet-500",
          )}
          aria-hidden
        >
          {message.sender_type === "bot" ? (
            <Bot className="size-3.5" />
          ) : (
            <User className="size-3.5" />
          )}
        </div>
      ) : null}

      <div
        className={cn(
          "max-w-[85%] space-y-1",
          isCustomer ? "items-end text-end" : "items-start",
        )}
      >
        <p className="px-1 text-[10px] font-medium text-muted-foreground">
          {isCustomer ? customerName || "You" : senderTitle(message)}
        </p>
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2.5 text-sm shadow-sm",
            isCustomer
              ? "rounded-br-md bg-primary text-primary-foreground"
              : "rounded-bl-md bg-muted text-foreground",
          )}
        >
          {message.content}
        </div>
        <p className="px-1 text-[10px] text-muted-foreground">
          {formatMessageTime(message.created_at)}
        </p>
      </div>
    </div>
  );
}

export function DemoChatThread({
  messages,
  customerName,
  loading,
}: DemoChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loading]);

  if (loading && messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Loading conversation…
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
        Send a customer message to start the demo chat. Replies from agents and
        AI will appear here in real time.
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pe-1">
      {messages.map((message) => (
        <DemoChatBubble
          key={message.id}
          message={message}
          customerName={customerName}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
