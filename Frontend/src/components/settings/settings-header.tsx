import { Settings } from "lucide-react";

export function SettingsHeader() {
  return (
    <div className="border-b border-border bg-gradient-to-r from-sky-500/8 via-transparent to-transparent px-4 py-5 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-primary text-primary-foreground shadow-sm">
          <Settings className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage workspace configuration and team access.
          </p>
        </div>
      </div>
    </div>
  );
}
