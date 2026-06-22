import { DemoChannelSimulator } from "@/components/settings/demo-simulator/demo-channel-simulator";
import { getSettingsTab } from "@/lib/settings-nav";

const tab = getSettingsTab("/settings/demo-simulator")!;

export default function SettingsDemoSimulatorPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1400px] space-y-4 p-4 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{tab.label}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{tab.description}</p>
        </div>
        <DemoChannelSimulator />
      </div>
    </div>
  );
}
