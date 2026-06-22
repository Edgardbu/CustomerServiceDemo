"use client";

import { useEffect } from "react";
import { useCurrentUserStore } from "@/stores/current-user-store";

export function CurrentUserHydrator() {
  const hydrate = useCurrentUserStore((state) => state.hydrate);
  const hydrated = useCurrentUserStore((state) => state.hydrated);

  useEffect(() => {
    if (!hydrated) {
      void hydrate();
    }
  }, [hydrate, hydrated]);

  return null;
}
