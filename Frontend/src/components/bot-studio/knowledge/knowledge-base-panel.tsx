"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Loader2, Plus, RefreshCw, Search } from "lucide-react";
import { api } from "@/lib/api";
import { TENANT_ID } from "@/lib/constants";
import {
  KNOWLEDGE_DOCUMENT_TYPES,
  KNOWLEDGE_SEARCH_LIMIT,
} from "@/lib/knowledge";
import type {
  KnowledgeDocument,
  KnowledgeDocumentType,
  KnowledgeSearchResponse,
} from "@/lib/types";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DocumentList } from "@/components/bot-studio/knowledge/document-list";
import {
  DocumentFormModal,
  type DocumentFormValues,
} from "@/components/bot-studio/knowledge/document-form-modal";
import { DeleteDocumentDialog } from "@/components/bot-studio/knowledge/delete-document-dialog";
import { KnowledgeSearchPanel } from "@/components/bot-studio/knowledge/knowledge-search-panel";
import { BotStudioErrorState } from "@/components/bot-studio/bot-studio-tab-shell";

type ModalMode = "create" | "edit" | null;
type TypeFilter = KnowledgeDocumentType | "all";

const EMPTY_SEARCH: KnowledgeSearchResponse = {
  query: "",
  chunks: [],
  documents: [],
};

export function KnowledgeBasePanel() {
  const { showSuccess, showError } = useToast();

  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [listQuery, setListQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedDocument, setSelectedDocument] =
    useState<KnowledgeDocument | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<KnowledgeDocument | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResponse, setSearchResponse] =
    useState<KnowledgeSearchResponse | null>(null);

  const loadDocuments = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setListError(null);

    try {
      const data = await api.getKnowledgeDocuments(TENANT_ID);
      setDocuments(
        [...data].sort((a, b) => {
          const aTime = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
          const bTime = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
          return bTime - aTime;
        }),
      );
    } catch (err) {
      setListError(
        err instanceof Error ? err.message : "Failed to load knowledge documents",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const filteredDocuments = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    return documents.filter((document) => {
      if (typeFilter !== "all" && document.document_type !== typeFilter) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        document.title,
        document.content,
        ...document.tags,
        document.document_type,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [documents, listQuery, typeFilter]);

  function openCreateModal() {
    setSelectedDocument(null);
    setFormError(null);
    setModalMode("create");
  }

  async function openEditModal(document: KnowledgeDocument) {
    setFormError(null);
    setModalMode("edit");
    setSelectedDocument(document);
    setFormLoading(true);

    try {
      const fresh = await api.getKnowledgeDocument(document.id, TENANT_ID);
      setSelectedDocument(fresh);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to load document details",
      );
    } finally {
      setFormLoading(false);
    }
  }

  function closeModal() {
    if (formSaving) return;
    setModalMode(null);
    setSelectedDocument(null);
    setFormError(null);
    setFormLoading(false);
  }

  async function handleSaveDocument(values: DocumentFormValues) {
    setFormSaving(true);
    setFormError(null);

    try {
      if (modalMode === "create") {
        await api.createKnowledgeDocument({
          tenant_id: TENANT_ID,
          ...values,
        });
        showSuccess("Document created", "The knowledge article was added.");
      } else if (modalMode === "edit" && selectedDocument) {
        await api.updateKnowledgeDocument(selectedDocument.id, {
          tenant_id: TENANT_ID,
          ...values,
        });
        showSuccess("Document updated", "Your changes were saved.");
      }

      closeModal();
      await loadDocuments(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save document";
      setFormError(message);
      showError("Save failed", message);
    } finally {
      setFormSaving(false);
    }
  }

  async function handleDeleteDocument() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);

    try {
      await api.deleteKnowledgeDocument(deleteTarget.id, TENANT_ID);
      showSuccess("Document deleted", `"${deleteTarget.title}" was removed.`);
      setDeleteTarget(null);
      await loadDocuments(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete document";
      setDeleteError(message);
      showError("Delete failed", message);
    } finally {
      setDeleting(false);
    }
  }

  async function handleSearch(query: string) {
    setSearchLoading(true);
    setSearchError(null);

    try {
      const response = await api.searchKnowledge({
        tenant_id: TENANT_ID,
        query,
        limit: KNOWLEDGE_SEARCH_LIMIT,
      });
      setSearchResponse(response);
      if (response.chunks.length === 0 && response.documents.length === 0) {
        showSuccess("Search complete", "No matching knowledge was found.");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Knowledge search failed";
      setSearchError(message);
      setSearchResponse(EMPTY_SEARCH);
      showError("Search failed", message);
    } finally {
      setSearchLoading(false);
    }
  }

  if (!loading && listError && documents.length === 0) {
    return (
      <BotStudioErrorState
        title="Unable to load knowledge base"
        message={listError}
        onRetry={() => void loadDocuments()}
      />
    );
  }

  const countLabel =
    filteredDocuments.length === documents.length
      ? `${documents.length} document${documents.length === 1 ? "" : "s"}`
      : `${filteredDocuments.length} of ${documents.length} documents`;

  return (
    <div className="h-full overflow-y-auto">
      <div className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <BookOpen className="size-5 text-primary" />
                <h1 className="text-xl font-semibold tracking-tight">
                  Knowledge Base
                </h1>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Curate articles and sources your bot can retrieve during
                conversations.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadDocuments(true)}
                disabled={refreshing || loading}
              >
                {refreshing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Refresh
              </Button>
              <Button type="button" size="sm" onClick={openCreateModal}>
                <Plus className="size-4" />
                New document
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={listQuery}
                onChange={(event) => setListQuery(event.target.value)}
                placeholder="Filter documents by title, tag, or content…"
                className="h-9 bg-background ps-9"
              />
            </div>
            <Select
              value={typeFilter}
              onValueChange={(value) => {
                if (value) setTypeFilter(value as TypeFilter);
              }}
            >
              <SelectTrigger className="h-9 w-full lg:w-[180px]">
                <SelectValue placeholder="Document type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {KNOWLEDGE_DOCUMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs font-medium text-muted-foreground lg:ms-1">
              {countLabel}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
          Put customer-facing facts here: prices, products, menus, opening hours,
          delivery policy, refund policy, and common questions. The AI uses this
          knowledge when answering customers.
        </div>

        {listError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {listError}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,1fr)]">
          <section className="min-w-0">
            <DocumentList
              documents={filteredDocuments}
              loading={loading}
              isEmptyLibrary={documents.length === 0}
              onEdit={(document) => void openEditModal(document)}
              onDelete={setDeleteTarget}
            />
          </section>

          <section className="min-w-0">
            <KnowledgeSearchPanel
              loading={searchLoading}
              response={searchResponse}
              error={searchError}
              onSearch={handleSearch}
            />
          </section>
        </div>
      </div>

      <DocumentFormModal
        open={modalMode !== null}
        mode={modalMode === "edit" ? "edit" : "create"}
        document={selectedDocument}
        loading={formLoading}
        saving={formSaving}
        error={formError}
        onOpenChange={(open) => {
          if (!open) closeModal();
        }}
        onSubmit={handleSaveDocument}
      />

      <DeleteDocumentDialog
        open={Boolean(deleteTarget)}
        document={deleteTarget}
        deleting={deleting}
        error={deleteError}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
        onConfirm={handleDeleteDocument}
      />
    </div>
  );
}
