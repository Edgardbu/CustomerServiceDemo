import type { FlowNodeType } from "@/lib/types";

/** React Flow built-in type names to avoid (input, default, output, group). */
const RESERVED_REACT_FLOW_TYPES = new Set([
  "input",
  "default",
  "output",
  "group",
]);

export function toReactFlowNodeType(type: FlowNodeType): string {
  if (RESERVED_REACT_FLOW_TYPES.has(type)) {
    return `flow-${type}`;
  }
  return type;
}

export function resolveFlowNodeType(
  reactFlowType: string,
  dataNodeType?: FlowNodeType,
): FlowNodeType {
  if (dataNodeType) return dataNodeType;
  if (reactFlowType.startsWith("flow-")) {
    return reactFlowType.slice(5) as FlowNodeType;
  }
  return reactFlowType as FlowNodeType;
}
