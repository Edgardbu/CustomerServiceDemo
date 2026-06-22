"use client";

import { useEffect } from "react";
import { BotStudioErrorState } from "@/components/bot-studio/bot-studio-tab-shell";

export default function BotStudioError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <BotStudioErrorState
      title="Bot Studio unavailable"
      message={error.message || "Unable to load Bot Studio."}
      onRetry={reset}
    />
  );
}
