import { cn } from "@/lib/utils";

interface UnassignedBadgeProps {
  className?: string;
}

export function UnassignedBadge({ className }: UnassignedBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-amber-500/12 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-500/25 dark:text-amber-300",
        className,
      )}
    >
      Unassigned
    </span>
  );
}
