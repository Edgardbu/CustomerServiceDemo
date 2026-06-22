import type { FlowCanvasNode } from "@/lib/flow-builder/converter";

export function validateFlowForSave(
  name: string,
  nodes: FlowCanvasNode[],
): string | null {
  if (!name.trim()) {
    return "Flow name is required.";
  }

  for (const node of nodes) {
    if (!node.id?.trim()) {
      return "Every node must have an id.";
    }
    if (!node.data?.nodeType) {
      return `Node "${node.id}" is missing a type.`;
    }
  }

  return null;
}
