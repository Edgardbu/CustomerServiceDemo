"use client";

import { useCallback } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { FlowNodeType } from "@/lib/types";
import {
  createNodeId,
  defaultNodeData,
  type FlowCanvasEdge,
  type FlowCanvasNode,
} from "@/lib/flow-builder/converter";
import { flowNodeTypes } from "@/components/bot-studio/flows/flow-nodes";
import "@/components/bot-studio/flows/flow-canvas.css";
import { FLOW_NODE_TYPES } from "@/lib/flow-builder/constants";
import { toReactFlowNodeType } from "@/lib/flow-builder/react-flow-types";
import { Button } from "@/components/ui/button";
import { applyEdgeChanges, applyNodeChanges } from "@xyflow/react";

interface FlowCanvasProps {
  nodes: FlowCanvasNode[];
  edges: FlowCanvasEdge[];
  viewport?: Viewport;
  selectedNodeId: string | null;
  onNodesChange: (nodes: FlowCanvasNode[]) => void;
  onEdgesChange: (edges: FlowCanvasEdge[]) => void;
  onSelectNode: (nodeId: string | null) => void;
  onViewportChange?: (viewport: Viewport) => void;
}

function FlowCanvasInner({
  nodes,
  edges,
  viewport,
  selectedNodeId,
  onNodesChange,
  onEdgesChange,
  onSelectNode,
  onViewportChange,
}: FlowCanvasProps) {
  const { screenToFlowPosition, getViewport } = useReactFlow();

  const displayNodes = nodes.map((node) => ({
    ...node,
    selected: node.id === selectedNodeId,
  }));

  const handleNodesChange = useCallback(
    (changes: NodeChange<FlowCanvasNode>[]) => {
      const next = applyNodeChanges(changes, nodes);
      onNodesChange(next);
      if (changes.some((change) => change.type === "position" && !change.dragging)) {
        onViewportChange?.(getViewport());
      }
    },
    [getViewport, nodes, onNodesChange, onViewportChange],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange<FlowCanvasEdge>[]) => {
      onEdgesChange(applyEdgeChanges(changes, edges));
    },
    [edges, onEdgesChange],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const filtered = edges.filter(
        (edge) =>
          !(
            edge.source === connection.source &&
            (edge.sourceHandle ?? "next") === (connection.sourceHandle ?? "next")
          ),
      );
      onEdgesChange([
        ...filtered,
        {
          id: `${connection.source}-${connection.sourceHandle ?? "next"}-${connection.target}`,
          source: connection.source!,
          target: connection.target!,
          sourceHandle: connection.sourceHandle,
          targetHandle: connection.targetHandle ?? "target",
        },
      ]);
    },
    [edges, onEdgesChange],
  );

  const onNodesDelete = useCallback(
    (deleted: FlowCanvasNode[]) => {
      const deletedIds = new Set(deleted.map((node) => node.id));
      onNodesChange(nodes.filter((node) => !deletedIds.has(node.id)));
      onEdgesChange(
        edges.filter(
          (edge) => !deletedIds.has(edge.source) && !deletedIds.has(edge.target),
        ),
      );
      if (deletedIds.has(selectedNodeId ?? "")) onSelectNode(null);
    },
    [edges, nodes, onEdgesChange, onNodesChange, onSelectNode, selectedNodeId],
  );

  function addNode(type: FlowNodeType) {
    const id = createNodeId(type);
    const center = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    const node: FlowCanvasNode = {
      id,
      type: toReactFlowNodeType(type),
      position: {
        x: center.x + nodes.length * 24,
        y: center.y + nodes.length * 24,
      },
      data: defaultNodeData(type),
    };
    onNodesChange([...nodes, node]);
    onSelectNode(id);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap gap-2 border-b border-border bg-card/40 px-3 py-2">
        {FLOW_NODE_TYPES.map((item) => {
          const Icon = item.icon;
          return (
            <Button
              key={item.type}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => addNode(item.type)}
              className="h-8"
            >
              <Icon className="size-3.5" />
              {item.label}
            </Button>
          );
        })}
      </div>

      <div className="flow-canvas relative min-h-0 flex-1 bg-muted/20">
        {nodes.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
            <div className="max-w-sm rounded-xl border border-dashed border-border bg-card/80 px-6 py-8 text-center shadow-sm backdrop-blur">
              <p className="text-sm font-medium">Empty canvas</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add nodes from the palette above to start building this flow.
              </p>
            </div>
          </div>
        ) : null}
        <ReactFlow
          nodes={displayNodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onNodesDelete={onNodesDelete}
          onNodeClick={(_, node) => onSelectNode(node.id)}
          onPaneClick={() => onSelectNode(null)}
          onMoveEnd={() => onViewportChange?.(getViewport())}
          nodeTypes={flowNodeTypes}
          fitView
          deleteKeyCode={["Backspace", "Delete"]}
          defaultViewport={viewport}
          className="h-full w-full"
        >
          <Background gap={18} size={1} />
          <MiniMap pannable zoomable className="!bg-card/90" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}

export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
