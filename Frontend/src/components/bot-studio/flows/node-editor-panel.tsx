"use client";

import { Plus, Trash2 } from "lucide-react";
import type { FlowCanvasNode, FlowNodeData } from "@/lib/flow-builder/converter";
import { getFlowNodeTypeConfig } from "@/lib/flow-builder/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface NodeEditorPanelProps {
  node: FlowCanvasNode | null;
  onChange: (nodeId: string, data: FlowNodeData) => void;
}

export function NodeEditorPanel({ node, onChange }: NodeEditorPanelProps) {
  if (!node) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Select a node on the canvas to edit its properties.
      </div>
    );
  }

  const config = getFlowNodeTypeConfig(node.data.nodeType);
  const Icon = config.icon;
  const current = node;

  function update(patch: Partial<FlowNodeData>) {
    onChange(current.id, { ...current.data, ...patch });
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-border px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
            <Icon className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">{config.label} node</p>
            <p className="text-xs text-muted-foreground">{node.id}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {current.data.nodeType === "message" ? (
          <Field label="Message text">
            <Textarea
              value={node.data.text ?? ""}
              onChange={(event) => update({ text: event.target.value })}
              rows={8}
              className="min-h-[180px] resize-y"
              placeholder="What should the bot say?"
            />
          </Field>
        ) : null}

        {node.data.nodeType === "input" ? (
          <Field label="Input field">
            <Input
              value={node.data.field ?? ""}
              onChange={(event) => update({ field: event.target.value })}
              placeholder="e.g. customer_email"
            />
          </Field>
        ) : null}

        {node.data.nodeType === "condition" ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Conditions</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  update({
                    conditions: [
                      ...(node.data.conditions ?? []),
                      { expression: "" },
                    ],
                  })
                }
              >
                <Plus className="size-3.5" />
                Add
              </Button>
            </div>
            {(node.data.conditions ?? []).map((condition, index) => (
              <div key={index} className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Condition {index + 1}
                  </p>
                  {(node.data.conditions?.length ?? 0) > 1 ? (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() =>
                        update({
                          conditions: node.data.conditions?.filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
                        })
                      }
                      aria-label={`Remove condition ${index + 1}`}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  ) : null}
                </div>
                <Textarea
                  value={condition.expression}
                  onChange={(event) => {
                    const next = [...(node.data.conditions ?? [])];
                    next[index] = { expression: event.target.value };
                    update({ conditions: next });
                  }}
                  rows={3}
                  placeholder="e.g. intent == 'pricing'"
                />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Connect each condition handle to its next step. Use the Default
              handle for the fallback path.
            </p>
          </div>
        ) : null}

        {node.data.nodeType === "action" ? (
          <>
            <Field label="Action name">
              <Input
                value={node.data.name ?? ""}
                onChange={(event) => update({ name: event.target.value })}
                placeholder="e.g. set_tag"
              />
            </Field>
            <Field label="Action value">
              <Input
                value={node.data.value ?? ""}
                onChange={(event) => update({ value: event.target.value })}
                placeholder="e.g. vip"
              />
            </Field>
          </>
        ) : null}

        {node.data.nodeType === "approval" ? (
          <>
            <Field label="Approval text">
              <Textarea
                value={node.data.text ?? ""}
                onChange={(event) => update({ text: event.target.value })}
                rows={5}
                placeholder="Message shown while waiting for approval"
              />
            </Field>
            <Field label="Summary">
              <Textarea
                value={node.data.summary ?? ""}
                onChange={(event) => update({ summary: event.target.value })}
                rows={4}
                placeholder="Short summary for the reviewing agent"
              />
            </Field>
          </>
        ) : null}

        {node.data.nodeType === "handoff" ? (
          <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
            Handoff nodes transfer the conversation to a human agent. Connect
            the output handle to the next step if needed.
          </p>
        ) : null}

        {node.data.nodeType === "end" ? (
          <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
            End nodes finish the flow. They have no outgoing connections.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
