"use client";

import type { ReactNode } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { BotStudioTab } from "@/lib/bot-studio-nav";

interface BotStudioTabShellProps {
  tab: BotStudioTab;
  children?: ReactNode;
}

export function BotStudioTabShell({ tab, children }: BotStudioTabShellProps) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{tab.label}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{tab.description}</p>
        </div>

        {children ?? (
          <Card>
            <CardHeader>
              <CardTitle>Coming soon</CardTitle>
              <CardDescription>
                This section is scaffolded and ready for implementation in the
                next step.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                API integration, forms, and editors will be added here without
                changing the navigation structure.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export function BotStudioLoadingState() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <Card>
          <CardHeader className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full max-w-md" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </div>
      </div>
    </div>
  );
}

interface BotStudioErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function BotStudioErrorState({
  title = "Something went wrong",
  message = "Unable to load this section. Please try again.",
  onRetry,
}: BotStudioErrorStateProps) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="size-5" />
            <CardTitle>{title}</CardTitle>
          </div>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        {onRetry ? (
          <CardContent>
            <button
              type="button"
              onClick={onRetry}
              className="text-sm font-medium text-primary hover:underline"
            >
              Try again
            </button>
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}
