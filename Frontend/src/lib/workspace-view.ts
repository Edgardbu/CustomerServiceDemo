export type WorkspaceView = "inbox" | "ai-settings" | "analytics";

export function workspaceViewFromSearchParam(
  value: string | null | undefined,
): WorkspaceView {
  if (value === "analytics") return "analytics";
  if (value === "ai-settings") return "ai-settings";
  return "inbox";
}
