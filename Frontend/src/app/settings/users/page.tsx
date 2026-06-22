import { UsersManagementPanel } from "@/components/settings/users/users-management-panel";
import { getSettingsTab } from "@/lib/settings-nav";

const tab = getSettingsTab("/settings/users")!;

export default function SettingsUsersPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{tab.label}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{tab.description}</p>
        </div>
        <UsersManagementPanel />
      </div>
    </div>
  );
}
