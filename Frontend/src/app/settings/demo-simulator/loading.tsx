import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsDemoSimulatorLoading() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1400px] space-y-4 p-4 sm:p-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_300px]">
          <Skeleton className="h-[640px] rounded-xl" />
          <Skeleton className="h-[640px] rounded-xl" />
          <Skeleton className="h-[640px] rounded-xl" />
        </div>
      </div>
    </div>
  );
}
