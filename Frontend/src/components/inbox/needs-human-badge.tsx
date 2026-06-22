import { cn } from "@/lib/utils";

interface NeedsHumanBadgeProps {
  className?: string;
}

export function NeedsHumanBadge({ className }: NeedsHumanBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-rose-500/12 px-2 py-0.5 text-[10px] font-medium text-rose-700 ring-1 ring-inset ring-rose-500/25 dark:text-rose-300",
        className,
      )}
    >
      Needs human
    </span>
  );
}
