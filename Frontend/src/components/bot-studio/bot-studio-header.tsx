import { Bot } from "lucide-react";

export function BotStudioHeader() {
  return (
    <div className="border-b border-border bg-gradient-to-r from-violet-500/8 via-transparent to-transparent px-4 py-5 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-violet-500 text-primary-foreground shadow-sm">
          <Bot className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Bot Studio</h1>
          <p className="text-sm text-muted-foreground">
            Configure AI settings, knowledge, and conversation flows.
          </p>
        </div>
      </div>
    </div>
  );
}
