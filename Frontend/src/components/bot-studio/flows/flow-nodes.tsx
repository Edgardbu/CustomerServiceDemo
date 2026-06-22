"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { FlowCanvasNode, FlowNodeData } from "@/lib/flow-builder/converter";
import {
  conditionHandle,
  DEFAULT_HANDLE,
  getFlowNodeTypeConfig,
  NEXT_HANDLE,
} from "@/lib/flow-builder/constants";
import { resolveFlowNodeType } from "@/lib/flow-builder/react-flow-types";
import { cn } from "@/lib/utils";

function previewText(data: FlowNodeData): string {
  switch (data.nodeType) {
    case "message":
      return data.text?.trim() || "Empty message";
    case "input":
      return data.field?.trim() ? `Field: ${data.field}` : "No field set";
    case "condition":
      return `${data.conditions?.length ?? 0} condition(s)`;
    case "action":
      return data.name?.trim()
        ? `${data.name}${data.value ? ` = ${data.value}` : ""}`
        : "Unnamed action";
    case "approval":
      return data.text?.trim() || "Approval required";
    case "handoff":
      return "Transfer to agent";
    case "end":
      return "Flow ends here";
    default:
      return "";
  }
}

function FlowStepNodeComponent({
  id,
  data,
  selected,
  type,
}: NodeProps<FlowCanvasNode>) {
  const nodeType = resolveFlowNodeType(type ?? "", data.nodeType);
  const config = getFlowNodeTypeConfig(nodeType);
  const Icon = config.icon;
  const isCondition = nodeType === "condition";
  const isEnd = nodeType === "end";
  const conditions = data.conditions ?? [];

  return (
    <div
      className={cn(
        "relative min-w-[200px] max-w-[260px] rounded-xl border bg-card px-3 py-2.5 shadow-sm ring-1 ring-foreground/5 transition-shadow",
        config.colorClass,
        selected && "ring-2 ring-primary shadow-md",
      )}
    >
      <Handle
        type="target"
        id="target"
        position={Position.Left}
        className="!size-2.5 !border-2 !border-background !bg-primary"
      />

      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-background/70">
          <Icon className="size-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
            {config.label}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-foreground/90">
            {previewText(data as FlowNodeData)}
          </p>
        </div>
      </div>

      {isCondition ? (
        <div className="mt-3 space-y-2 border-t border-border/50 pt-2">
          {conditions.map((condition, index) => (
            <div
              key={`${id}-condition-${index}`}
              className="relative flex items-center justify-end pe-4 text-[10px] text-muted-foreground"
            >
              <span className="line-clamp-1 text-end">
                {condition.expression?.trim() || `Condition ${index + 1}`}
              </span>
              <Handle
                type="source"
                id={conditionHandle(index)}
                position={Position.Right}
                className="!-end-3 !top-1/2 !size-2.5 !border-2 !border-background !bg-amber-500"
              />
            </div>
          ))}
          <div className="relative flex items-center justify-end pe-4 text-[10px] font-medium text-muted-foreground">
            Default
            <Handle
              type="source"
              id={DEFAULT_HANDLE}
              position={Position.Right}
              className="!-end-3 !top-1/2 !size-2.5 !border-2 !border-background !bg-slate-500"
            />
          </div>
        </div>
      ) : null}

      {!isCondition && !isEnd ? (
        <Handle
          type="source"
          id={NEXT_HANDLE}
          position={Position.Right}
          className="!size-2.5 !border-2 !border-background !bg-primary"
        />
      ) : null}
    </div>
  );
}

export const FlowStepNode = memo(FlowStepNodeComponent);

export const flowNodeTypes = {
  message: FlowStepNode,
  "flow-input": FlowStepNode,
  condition: FlowStepNode,
  action: FlowStepNode,
  approval: FlowStepNode,
  handoff: FlowStepNode,
  end: FlowStepNode,
};
