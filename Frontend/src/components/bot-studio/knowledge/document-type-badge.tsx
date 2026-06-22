"use client";

import type { KnowledgeDocumentType } from "@/lib/types";
import {
  getDocumentTypeBadgeClass,
  getDocumentTypeLabel,
} from "@/lib/knowledge";
import { cn } from "@/lib/utils";

export function DocumentTypeBadge({
  type,
  className,
}: {
  type: KnowledgeDocumentType;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset",
        getDocumentTypeBadgeClass(type),
        className,
      )}
    >
      {getDocumentTypeLabel(type)}
    </span>
  );
}
