import type { FlowDefinition, FlowNodeType } from "@/lib/types";
import type { LucideIcon } from "lucide-react";
import {
  CircleStop,
  GitBranch,
  Hand,
  Keyboard,
  MessageSquare,
  ShieldCheck,
  Zap,
} from "lucide-react";

export const NEXT_HANDLE = "next";
export const DEFAULT_HANDLE = "default";

export function conditionHandle(index: number): string {
  return `condition-${index}`;
}

export interface FlowNodeTypeConfig {
  type: FlowNodeType;
  label: string;
  description: string;
  icon: LucideIcon;
  colorClass: string;
  hasOutput: boolean;
}

export const FLOW_NODE_TYPES: FlowNodeTypeConfig[] = [
  {
    type: "message",
    label: "Message",
    description: "Send a bot message",
    icon: MessageSquare,
    colorClass: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    hasOutput: true,
  },
  {
    type: "input",
    label: "Input",
    description: "Collect customer input",
    icon: Keyboard,
    colorClass: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    hasOutput: true,
  },
  {
    type: "condition",
    label: "Condition",
    description: "Branch by rules",
    icon: GitBranch,
    colorClass: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    hasOutput: true,
  },
  {
    type: "action",
    label: "Action",
    description: "Run a named action",
    icon: Zap,
    colorClass: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    hasOutput: true,
  },
  {
    type: "approval",
    label: "Approval",
    description: "Request human approval",
    icon: ShieldCheck,
    colorClass: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
    hasOutput: true,
  },
  {
    type: "handoff",
    label: "Handoff",
    description: "Transfer to an agent",
    icon: Hand,
    colorClass: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    hasOutput: true,
  },
  {
    type: "end",
    label: "End",
    description: "Finish the flow",
    icon: CircleStop,
    colorClass: "border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300",
    hasOutput: false,
  },
];

export function getFlowNodeTypeConfig(type: FlowNodeType): FlowNodeTypeConfig {
  return (
    FLOW_NODE_TYPES.find((item) => item.type === type) ?? FLOW_NODE_TYPES[0]
  );
}

export const EMPTY_FLOW_DEFINITION: FlowDefinition = {
  nodes: [],
  edges: [],
};
