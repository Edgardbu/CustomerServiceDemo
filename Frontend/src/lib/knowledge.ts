import type { KnowledgeDocumentType } from "./types";

export const KNOWLEDGE_SEARCH_LIMIT = 10;

export const KNOWLEDGE_DOCUMENT_TYPES: {
  value: KnowledgeDocumentType;
  label: string;
  badgeClass: string;
}[] = [
  {
    value: "faq",
    label: "FAQ",
    badgeClass:
      "bg-violet-500/12 text-violet-700 ring-violet-500/25 dark:text-violet-300",
  },
  {
    value: "menu",
    label: "Menu",
    badgeClass:
      "bg-orange-500/12 text-orange-700 ring-orange-500/25 dark:text-orange-300",
  },
  {
    value: "policy",
    label: "Policy",
    badgeClass:
      "bg-sky-500/12 text-sky-700 ring-sky-500/25 dark:text-sky-300",
  },
  {
    value: "guide",
    label: "Guide",
    badgeClass:
      "bg-emerald-500/12 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300",
  },
  {
    value: "script",
    label: "Script",
    badgeClass:
      "bg-amber-500/12 text-amber-700 ring-amber-500/25 dark:text-amber-300",
  },
  {
    value: "other",
    label: "Other",
    badgeClass: "bg-muted text-muted-foreground ring-border",
  },
];

export function getDocumentTypeLabel(type: KnowledgeDocumentType): string {
  return (
    KNOWLEDGE_DOCUMENT_TYPES.find((item) => item.value === type)?.label ?? type
  );
}

export function getDocumentTypeBadgeClass(type: KnowledgeDocumentType): string {
  return (
    KNOWLEDGE_DOCUMENT_TYPES.find((item) => item.value === type)?.badgeClass ??
    "bg-muted text-muted-foreground ring-border"
  );
}
