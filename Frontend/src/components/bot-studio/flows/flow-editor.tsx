"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import type { Viewport } from "@xyflow/react";
import { api } from "@/lib/api";
import { TENANT_ID } from "@/lib/constants";
import type { BotFlow, BotIntent } from "@/lib/types";
import {
  canvasToDefinition,
  definitionToCanvas,
  flowDefinitionSignature,
  type FlowCanvasEdge,
  type FlowCanvasNode,
  type FlowNodeData,
} from "@/lib/flow-builder/converter";
import { toReactFlowNodeType } from "@/lib/flow-builder/react-flow-types";
import { validateFlowForSave } from "@/lib/flow-builder/validation";
import { useToast } from "@/components/providers/toast-provider";
import { IntentPicker } from "@/components/bot-studio/flows/intent-picker";
import { NodeEditorPanel } from "@/components/bot-studio/flows/node-editor-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const FlowCanvas = dynamic(
  () =>
    import("@/components/bot-studio/flows/flow-canvas").then(
      (mod) => mod.FlowCanvas,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
      </div>
    ),
  },
);

interface FlowEditorSnapshot {
  name: string;
  description: string;
  trigger_intents: BotIntent[];
  enabled: boolean;
  definitionSignature: string;
}

function buildSnapshot(
  name: string,
  description: string,
  triggerIntents: BotIntent[],
  enabled: boolean,
  nodes: FlowCanvasNode[],
  edges: FlowCanvasEdge[],
): FlowEditorSnapshot {
  return {
    name: name.trim(),
    description: description.trim(),
    trigger_intents: [...triggerIntents].sort(),
    enabled,
    definitionSignature: flowDefinitionSignature(
      canvasToDefinition(nodes, edges),
    ),
  };
}

function snapshotsEqual(a: FlowEditorSnapshot, b: FlowEditorSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

interface FlowEditorProps {
  flowId: string;
  onBack: () => void;
  onSaved: () => void;
}

export function FlowEditor({ flowId, onBack, onSaved }: FlowEditorProps) {
  const { showSuccess, showError } = useToast();

  const [flow, setFlow] = useState<BotFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<FlowEditorSnapshot | null>(
    null,
  );

  const [nodes, setNodes] = useState<FlowCanvasNode[]>([]);
  const [edges, setEdges] = useState<FlowCanvasEdge[]>([]);
  const [viewport, setViewport] = useState<Viewport | undefined>();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerIntents, setTriggerIntents] = useState<BotIntent[]>([]);
  const [enabled, setEnabled] = useState(true);

  const currentSnapshot = useMemo(
    () =>
      buildSnapshot(name, description, triggerIntents, enabled, nodes, edges),
    [description, edges, enabled, name, nodes, triggerIntents],
  );

  const isDirty = useMemo(() => {
    if (!savedSnapshot) return false;
    return !snapshotsEqual(currentSnapshot, savedSnapshot);
  }, [currentSnapshot, savedSnapshot]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    api
      .getBotFlow(flowId, TENANT_ID)
      .then((data) => {
        if (!active) return;
        setFlow(data);
        setName(data.name);
        setDescription(data.description);
        setTriggerIntents(data.trigger_intents);
        setEnabled(data.enabled);
        const canvas = definitionToCanvas(data.definition);
        setNodes(canvas.nodes);
        setEdges(canvas.edges);
        setViewport(undefined);
        setSelectedNodeId(null);
        setSavedSnapshot(
          buildSnapshot(
            data.name,
            data.description,
            data.trigger_intents,
            data.enabled,
            canvas.nodes,
            canvas.edges,
          ),
        );
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load flow");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [flowId]);

  useEffect(() => {
    if (!isDirty) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  function updateNodeData(nodeId: string, data: FlowNodeData) {
    setNodes((current) =>
      current.map((node) =>
        node.id === nodeId
          ? { ...node, data, type: toReactFlowNodeType(data.nodeType) }
          : node,
      ),
    );
  }

  function handleBack() {
    if (
      isDirty &&
      !window.confirm(
        "You have unsaved changes. Leave without saving?",
      )
    ) {
      return;
    }
    onBack();
  }

  async function handleSave() {
    if (!flow) return;

    const validationError = validateFlowForSave(name, nodes);
    if (validationError) {
      setError(validationError);
      showError("Cannot save flow", validationError);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const definition = canvasToDefinition(nodes, edges);
      const updated = await api.updateBotFlow(flow.id, {
        tenant_id: TENANT_ID,
        name: name.trim(),
        description: description.trim(),
        trigger_intents: triggerIntents,
        enabled,
        version: flow.version,
        definition,
      });
      setFlow(updated);
      const canvas = definitionToCanvas(updated.definition);
      setSavedSnapshot(
        buildSnapshot(
          updated.name,
          updated.description,
          updated.trigger_intents,
          updated.enabled,
          canvas.nodes,
          canvas.edges,
        ),
      );
      showSuccess("Flow saved", "Your conversation flow was updated.");
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save flow";
      setError(message);
      showError("Save failed", message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading flow…
      </div>
    );
  }

  if (error && !flow) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Back to flows
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border bg-card/40 px-4 py-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">{flow?.name}</p>
                {isDirty ? (
                  <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-500/30 dark:text-amber-300">
                    Unsaved changes
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Version {flow?.version} · {nodes.length} nodes
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !isDirty}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save flow
          </Button>
        </div>

        {isDirty ? (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
            You have unsaved changes. Save before leaving to keep your edits.
          </p>
        ) : null}

        {error ? (
          <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Flow name"
            aria-invalid={!name.trim()}
          />
          <div className="rounded-lg border border-border bg-background px-3 py-2">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Trigger intents
            </p>
            <IntentPicker
              value={triggerIntents}
              onChange={setTriggerIntents}
              compact
            />
          </div>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
            <span className="text-sm font-medium">Enabled</span>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled((value) => !value)}
              className={cn(
                "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                enabled ? "bg-primary" : "bg-muted",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
                  enabled ? "start-5" : "start-0.5",
                )}
              />
            </button>
          </label>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]">
        <FlowCanvas
          nodes={nodes}
          edges={edges}
          viewport={viewport}
          selectedNodeId={selectedNodeId}
          onNodesChange={setNodes}
          onEdgesChange={setEdges}
          onSelectNode={setSelectedNodeId}
          onViewportChange={setViewport}
        />
        <div className="min-h-[280px] border-t border-border bg-card/30 xl:min-h-0 xl:border-s xl:border-t-0">
          <NodeEditorPanel node={selectedNode} onChange={updateNodeData} />
        </div>
      </div>
    </div>
  );
}
