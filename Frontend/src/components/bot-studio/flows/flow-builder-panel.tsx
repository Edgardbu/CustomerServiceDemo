"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { TENANT_ID } from "@/lib/constants";
import type { BotFlow } from "@/lib/types";
import { EMPTY_FLOW_DEFINITION } from "@/lib/flow-builder/constants";
import { useToast } from "@/components/providers/toast-provider";
import { BotStudioErrorState } from "@/components/bot-studio/bot-studio-tab-shell";
import { CreateFlowDialog, type FlowFormValues } from "@/components/bot-studio/flows/create-flow-dialog";
import { DeleteFlowDialog } from "@/components/bot-studio/flows/delete-flow-dialog";
import { FlowEditor } from "@/components/bot-studio/flows/flow-editor";
import { FlowList } from "@/components/bot-studio/flows/flow-list";
import { Button } from "@/components/ui/button";

export function FlowBuilderPanel() {
  const { showSuccess, showError } = useToast();

  const [flows, setFlows] = useState<BotFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<BotFlow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadFlows = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setListError(null);

    try {
      const data = await api.getBotFlows(TENANT_ID);
      setFlows(
        [...data].sort((a, b) => a.name.localeCompare(b.name)),
      );
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Failed to load flows");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadFlows();
  }, [loadFlows]);

  async function handleCreateFlow(values: FlowFormValues) {
    setCreateSaving(true);
    setCreateError(null);

    try {
      const created = await api.createBotFlow({
        tenant_id: TENANT_ID,
        name: values.name,
        description: values.description,
        trigger_intents: values.trigger_intents,
        enabled: values.enabled,
        version: 1,
        definition: EMPTY_FLOW_DEFINITION,
      });
      showSuccess("Flow created", "Open the visual editor to add nodes.");
      setCreateOpen(false);
      await loadFlows(true);
      setEditingFlowId(created.id);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create flow";
      setCreateError(message);
      showError("Create failed", message);
    } finally {
      setCreateSaving(false);
    }
  }

  async function handleDeleteFlow() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);

    try {
      await api.deleteBotFlow(deleteTarget.id, TENANT_ID);
      showSuccess("Flow deleted", `"${deleteTarget.name}" was removed.`);
      if (editingFlowId === deleteTarget.id) setEditingFlowId(null);
      setDeleteTarget(null);
      await loadFlows(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete flow";
      setDeleteError(message);
      showError("Delete failed", message);
    } finally {
      setDeleting(false);
    }
  }

  if (editingFlowId) {
    return (
      <FlowEditor
        flowId={editingFlowId}
        onBack={() => setEditingFlowId(null)}
        onSaved={() => void loadFlows(true)}
      />
    );
  }

  if (!loading && listError && flows.length === 0) {
    return (
      <BotStudioErrorState
        title="Unable to load flows"
        message={listError}
        onRetry={() => void loadFlows()}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Flow Builder</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Design conversation paths visually with drag-and-drop nodes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadFlows(true)}
              disabled={refreshing || loading}
            >
              {refreshing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Refresh
            </Button>
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Create flow
            </Button>
          </div>
        </div>

        {listError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {listError}
          </div>
        ) : null}

        <FlowList
          flows={flows}
          loading={loading}
          onEdit={(flow) => setEditingFlowId(flow.id)}
          onDelete={setDeleteTarget}
        />
      </div>

      <CreateFlowDialog
        open={createOpen}
        saving={createSaving}
        error={createError}
        onOpenChange={(open) => {
          if (!open && !createSaving) {
            setCreateOpen(false);
            setCreateError(null);
          }
        }}
        onSubmit={handleCreateFlow}
      />

      <DeleteFlowDialog
        open={Boolean(deleteTarget)}
        flow={deleteTarget}
        deleting={deleting}
        error={deleteError}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
        onConfirm={handleDeleteFlow}
      />
    </div>
  );
}
