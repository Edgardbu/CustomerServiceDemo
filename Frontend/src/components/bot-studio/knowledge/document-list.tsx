"use client";

import { Pencil, Trash2 } from "lucide-react";
import type { KnowledgeDocument } from "@/lib/types";
import { formatRelativeTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentTypeBadge } from "@/components/bot-studio/knowledge/document-type-badge";
import { cn } from "@/lib/utils";

interface DocumentListProps {
  documents: KnowledgeDocument[];
  loading?: boolean;
  isEmptyLibrary?: boolean;
  onEdit: (document: KnowledgeDocument) => void;
  onDelete: (document: KnowledgeDocument) => void;
}

export function DocumentList({
  documents,
  loading = false,
  isEmptyLibrary = false,
  onEdit,
  onDelete,
}: DocumentListProps) {
  if (loading) {
    return (
      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="ml-auto h-4 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
        {isEmptyLibrary ? (
          <>
            <p className="text-sm font-medium">No knowledge documents yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add your first knowledge document. FAQs, menus, pricing, policies,
              and guides belong here.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium">No documents match your filters</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a document or adjust search and type filters.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-start text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Tags</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Updated</th>
              <th className="px-4 py-3 text-end font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {documents.map((document) => (
              <tr
                key={document.id}
                className="group transition-colors hover:bg-muted/30"
              >
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onEdit(document)}
                    className="max-w-[280px] truncate text-start font-medium text-foreground transition-colors group-hover:text-primary"
                  >
                    {document.title}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <DocumentTypeBadge type={document.document_type} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex max-w-[220px] flex-wrap gap-1">
                    {document.tags.length > 0 ? (
                      document.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-[10px] font-normal"
                        >
                          {tag}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                      document.enabled
                        ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        document.enabled ? "bg-emerald-500" : "bg-muted-foreground",
                      )}
                    />
                    {document.enabled ? "Enabled" : "Disabled"}
                  </span>
                </td>
                <td
                  className="px-4 py-3 text-xs text-muted-foreground"
                  title={
                    document.updated_at
                      ? new Date(document.updated_at).toLocaleString()
                      : undefined
                  }
                >
                  {formatRelativeTime(document.updated_at) || "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-0.5 opacity-80 transition-opacity group-hover:opacity-100">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onEdit(document)}
                      aria-label={`Edit ${document.title}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onDelete(document)}
                      aria-label={`Delete ${document.title}`}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
