"use client";

import { useMemo, useState } from "react";
import { FileText, Loader2, Search } from "lucide-react";
import type {
  KnowledgeDocument,
  KnowledgeSearchChunk,
  KnowledgeSearchResponse,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DocumentTypeBadge } from "@/components/bot-studio/knowledge/document-type-badge";
import { cn } from "@/lib/utils";

interface KnowledgeSearchPanelProps {
  loading?: boolean;
  response: KnowledgeSearchResponse | null;
  error?: string | null;
  onSearch: (query: string) => Promise<void>;
}

function formatScore(score: number | null): string {
  if (score == null) return "—";
  if (score <= 1) return `${Math.round(score * 100)}%`;
  return score.toFixed(2);
}

export function KnowledgeSearchPanel({
  loading = false,
  response,
  error,
  onSearch,
}: KnowledgeSearchPanelProps) {
  const [query, setQuery] = useState("");

  const documentTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const doc of response?.documents ?? []) {
      map.set(doc.id, doc.title);
    }
    return map;
  }, [response?.documents]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    await onSearch(trimmed);
  }

  const chunks = response?.chunks ?? [];
  const relatedDocuments = response?.documents ?? [];

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="border-b border-border/60 bg-muted/20">
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="size-4 text-primary" />
          Semantic search
        </CardTitle>
        <CardDescription>
          Test retrieval against indexed chunks and preview related documents.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        <form onSubmit={(event) => void handleSubmit(event)} className="flex gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ask what customers might search for…"
            disabled={loading}
            className="h-9 bg-background"
          />
          <Button
            type="submit"
            size="sm"
            disabled={loading || !query.trim()}
            className="shrink-0"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            Search
          </Button>
        </form>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {response && relatedDocuments.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Related documents ({relatedDocuments.length})
            </p>
            <div className="space-y-2">
              {relatedDocuments.map((document) => (
                <RelatedDocumentCard key={document.id} document={document} />
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Matched chunks
            {response ? ` (${chunks.length})` : ""}
          </p>
          {chunks.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/15 px-4 py-8 text-center text-sm text-muted-foreground">
              {loading
                ? "Searching knowledge base…"
                : response
                  ? "No chunks matched this query."
                  : "Run a query to preview matched knowledge chunks."}
            </p>
          ) : (
            <div className="space-y-2">
              {chunks.map((chunk) => (
                <ChunkCard
                  key={chunk.id}
                  chunk={chunk}
                  documentTitle={
                    documentTitleById.get(chunk.document_id) ?? chunk.document_id
                  }
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RelatedDocumentCard({ document }: { document: KnowledgeDocument }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card/60 px-3 py-2.5">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
        <FileText className="size-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{document.title}</p>
          <DocumentTypeBadge type={document.document_type} />
        </div>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {document.content}
        </p>
      </div>
    </div>
  );
}

function ChunkCard({
  chunk,
  documentTitle,
}: {
  chunk: KnowledgeSearchChunk;
  documentTitle: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{documentTitle}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Chunk #{chunk.chunk_index + 1}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary ring-1 ring-inset ring-primary/20",
          )}
        >
          {formatScore(chunk.score)}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
        {chunk.content || "—"}
      </p>
    </div>
  );
}
