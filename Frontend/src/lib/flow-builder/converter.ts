import type { Edge, Node } from "@xyflow/react";
import type { FlowDefinition, FlowGraphEdge, FlowNodeType } from "@/lib/types";
import {
  conditionHandle,
  DEFAULT_HANDLE,
  NEXT_HANDLE,
} from "@/lib/flow-builder/constants";
import { toReactFlowNodeType } from "@/lib/flow-builder/react-flow-types";

export interface FlowNodeData extends Record<string, unknown> {
  nodeType: FlowNodeType;
  text?: string;
  field?: string;
  conditions?: { expression: string }[];
  default_next?: string;
  name?: string;
  value?: string;
  summary?: string;
}

export type FlowCanvasNode = Node<FlowNodeData>;
export type FlowCanvasEdge = Edge;

const EDGE_HANDLE_SEP = "::";

export function encodeEdgeFrom(
  sourceId: string,
  sourceHandle?: string | null,
): string {
  const handle = sourceHandle ?? NEXT_HANDLE;
  if (handle === NEXT_HANDLE) return sourceId;
  return `${sourceId}${EDGE_HANDLE_SEP}${handle}`;
}

export function decodeEdgeFrom(from: string): {
  sourceId: string;
  sourceHandle: string;
} {
  const index = from.indexOf(EDGE_HANDLE_SEP);
  if (index === -1) {
    return { sourceId: from, sourceHandle: NEXT_HANDLE };
  }
  return {
    sourceId: from.slice(0, index),
    sourceHandle: from.slice(index + EDGE_HANDLE_SEP.length),
  };
}

function canvasEdge(
  source: string,
  target: string,
  sourceHandle?: string | null,
): FlowCanvasEdge {
  const handle = sourceHandle ?? NEXT_HANDLE;
  return {
    id: `${source}-${handle}-${target}`,
    source,
    target,
    sourceHandle: handle,
    targetHandle: "target",
  };
}

function readPosition(record: Record<string, unknown>): { x: number; y: number } {
  const position = record.position;
  if (
    position &&
    typeof position === "object" &&
    "x" in position &&
    "y" in position
  ) {
    const point = position as { x: unknown; y: unknown };
    return {
      x: typeof point.x === "number" ? point.x : 0,
      y: typeof point.y === "number" ? point.y : 0,
    };
  }

  return { x: 0, y: 0 };
}

function readNodeType(record: Record<string, unknown>): FlowNodeType | null {
  return typeof record.type === "string" ? (record.type as FlowNodeType) : null;
}

function readConditions(
  record: Record<string, unknown>,
): { expression: string }[] | undefined {
  if (!Array.isArray(record.conditions)) return undefined;
  return record.conditions.map((item) => {
    if (item && typeof item === "object" && "expression" in item) {
      return {
        expression:
          typeof (item as { expression?: unknown }).expression === "string"
            ? (item as { expression: string }).expression
            : "",
      };
    }
    return { expression: "" };
  });
}

function recordToNodeData(
  type: FlowNodeType,
  record: Record<string, unknown>,
): FlowNodeData {
  const data: FlowNodeData = { nodeType: type };

  if (typeof record.text === "string") data.text = record.text;
  if (typeof record.field === "string") data.field = record.field;
  if (typeof record.name === "string") data.name = record.name;
  if (typeof record.value === "string") data.value = record.value;
  if (typeof record.summary === "string") data.summary = record.summary;
  if (typeof record.default_next === "string") {
    data.default_next = record.default_next;
  }

  const conditions = readConditions(record);
  if (conditions) data.conditions = conditions;

  return data;
}

function legacyEdgesFromNodes(
  nodes: Array<Record<string, unknown>>,
): FlowGraphEdge[] {
  const edges: FlowGraphEdge[] = [];

  for (const record of nodes) {
    const id = typeof record.id === "string" ? record.id : null;
    const type = readNodeType(record);
    if (!id || !type) continue;

    if (type === "condition") {
      const conditions = Array.isArray(record.conditions) ? record.conditions : [];
      conditions.forEach((condition, index) => {
        if (
          condition &&
          typeof condition === "object" &&
          typeof (condition as { next?: unknown }).next === "string"
        ) {
          edges.push({
            from: encodeEdgeFrom(id, conditionHandle(index)),
            to: (condition as { next: string }).next,
          });
        }
      });

      if (typeof record.default_next === "string") {
        edges.push({
          from: encodeEdgeFrom(id, DEFAULT_HANDLE),
          to: record.default_next,
        });
      }
      continue;
    }

    if (type !== "end" && typeof record.next === "string") {
      edges.push({ from: encodeEdgeFrom(id), to: record.next });
    }
  }

  return edges;
}

export function definitionToCanvas(definition: FlowDefinition): {
  nodes: FlowCanvasNode[];
  edges: FlowCanvasEdge[];
} {
  const backendNodes = definition.nodes ?? [];
  const backendEdges =
    definition.edges?.length > 0
      ? definition.edges
      : legacyEdgesFromNodes(backendNodes);

  const nodes: FlowCanvasNode[] = [];
  const edges: FlowCanvasEdge[] = [];

  for (const record of backendNodes) {
    const id = typeof record.id === "string" ? record.id : null;
    const type = readNodeType(record);
    if (!id || !type) continue;

    nodes.push({
      id,
      type: toReactFlowNodeType(type),
      position: readPosition(record),
      data: recordToNodeData(type, record),
    });
  }

  for (const item of backendEdges) {
    if (!item.from || !item.to) continue;
    const { sourceId, sourceHandle } = decodeEdgeFrom(item.from);
    edges.push(canvasEdge(sourceId, item.to, sourceHandle));
  }

  return { nodes, edges };
}

function getOutgoingTarget(
  nodeId: string,
  edges: FlowCanvasEdge[],
  sourceHandle: string,
): string | undefined {
  return edges.find(
    (item) =>
      item.source === nodeId &&
      (item.sourceHandle ?? NEXT_HANDLE) === sourceHandle,
  )?.target;
}

function nodeToRecord(node: FlowCanvasNode, edges: FlowCanvasEdge[]): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: node.id,
    type: node.data.nodeType,
    position: { x: node.position.x, y: node.position.y },
  };

  switch (node.data.nodeType) {
    case "message":
      return { ...base, text: node.data.text ?? "" };
    case "input":
      return { ...base, field: node.data.field ?? "" };
    case "condition": {
      const defaultNext = getOutgoingTarget(node.id, edges, DEFAULT_HANDLE);
      return {
        ...base,
        conditions:
          node.data.conditions?.map((condition) => ({
            expression: condition.expression,
          })) ?? [],
        ...(defaultNext ? { default_next: defaultNext } : {}),
      };
    }
    case "action":
      return {
        ...base,
        name: node.data.name ?? "",
        value: node.data.value ?? "",
      };
    case "approval":
      return {
        ...base,
        text: node.data.text ?? "",
        summary: node.data.summary ?? "",
      };
    case "handoff":
    case "end":
      return base;
    default:
      return base;
  }
}

export function canvasToDefinition(
  nodes: FlowCanvasNode[],
  edges: FlowCanvasEdge[],
): FlowDefinition {
  const backendNodes = nodes.map((node) => nodeToRecord(node, edges));
  const backendEdges: FlowGraphEdge[] = [];

  for (const item of edges) {
    if (!item.source || !item.target) continue;
    backendEdges.push({
      from: encodeEdgeFrom(item.source, item.sourceHandle),
      to: item.target,
    });
  }

  return {
    nodes: backendNodes,
    edges: backendEdges,
  };
}

export function createNodeId(type: FlowNodeType): string {
  return `${type}-${crypto.randomUUID().slice(0, 8)}`;
}

export function defaultNodeData(type: FlowNodeType): FlowNodeData {
  switch (type) {
    case "message":
      return { nodeType: type, text: "" };
    case "input":
      return { nodeType: type, field: "" };
    case "condition":
      return {
        nodeType: type,
        conditions: [{ expression: "" }],
      };
    case "action":
      return { nodeType: type, name: "", value: "" };
    case "approval":
      return { nodeType: type, text: "", summary: "" };
    case "handoff":
      return { nodeType: type };
    case "end":
      return { nodeType: type };
    default:
      return { nodeType: "message", text: "" };
  }
}

export function flowDefinitionSignature(definition: FlowDefinition): string {
  return JSON.stringify(definition);
}
