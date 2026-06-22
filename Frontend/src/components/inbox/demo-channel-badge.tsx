import { cn } from "@/lib/utils";

interface DemoChannelBadgeProps {
  className?: string;
}

export function DemoChannelBadge({ className }: DemoChannelBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-amber-500/12 px-2 py-0.5 text-[10px] font-medium text-amber-800 ring-1 ring-inset ring-amber-500/25 dark:text-amber-200",
        className,
      )}
    >
      Demo
    </span>
  );
}
